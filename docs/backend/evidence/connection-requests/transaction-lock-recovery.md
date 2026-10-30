# ปลด lock รายการคำขอและป้องกัน transaction ค้าง

เอกสารนี้เป็นหลักฐานการตรวจเหตุการณ์ตารางรายการคำขอค้างโหลดบนระบบจริง และการทดสอบแก้ไข backend สนับสนุน [API เมนูขอเชื่อมต่อ](../../api/menus/connection-requests/README.md) โดยไม่เปลี่ยน request, response, permission หรือ error contract

## สิ่งที่ตรวจพบ

- `GET /api/v1/cems-wpms-requests/table-rows` รอเซิร์ฟเวอร์ประมาณ 2.6 นาที ก่อนตอบ `500` พร้อม `INTERNAL_ERROR`
- SQL Server session `87` ของ `knex` อยู่ในสถานะ `sleeping` แต่ยังมี transaction เปิดอยู่ และถือ write/range locks บน `cems_wpms_connection_requests`, `cems_wpms_measurement_points` และตารางประกอบ
- คำสั่งอ่านรอ session นี้ด้วย `LCK_M_S` ขณะที่ `SELECT 1` ยังทำงานได้
- พบ session `82` จาก backend process เดียวกันเปิด transaction ค้างด้วย

ก่อนยกเลิก ตรวจซ้ำด้วย session ID, connection ID, backend process, สถานะ `sleeping`, transaction ที่ยังเปิดอยู่ และการไม่มี active request เพื่อไม่ยกเลิก session ที่ถูกนำกลับไปใช้งานใหม่ การยกเลิกทำให้ SQL Server rollback งานที่ยังไม่ commit

หลังยกเลิกสอง session คำสั่งนับรายการคำขอใช้เวลา 24 ms และไม่พบคำขอที่ยังรอ blocker

ตรวจซ้ำผ่านเว็บจริงพบตารางแสดง `1–25 of 383` โดยมีแถวข้อมูลและไม่มี loading skeleton ส่วนการตรวจฐานข้อมูลครั้งสุดท้ายไม่พบ blocked request หรือ session ว่างของ backend ที่ถือ transaction ค้างเกินหนึ่งนาที

## กลไกที่ทำซ้ำได้

`hydrate(row, trx)` เคยใช้ `Promise.all` อ่านจุดตรวจวัด ประวัติ และ snapshot ผ่าน connection เดียวของ transaction เมื่อ query หนึ่งล้มเหลว ขณะที่อีก query เริ่มทำงานแล้ว Knex MSSQL ปฏิเสธ rollback ด้วยข้อความ:

```text
Can't rollback transaction. There is a request in progress
```

จากนั้น Knex คืน connection เข้าพูลทั้งที่ transaction ยังเปิดอยู่ การไม่มี query ทำงานจึงไม่ได้แปลว่า transaction จบแล้ว และ lock จะยังอยู่จน commit, rollback หรือปิด connection

ทดสอบแยกด้วย transaction ที่มีเพียง synthetic `THROW` และคำสั่งอ่านพร้อมกัน โดยไม่เขียนตารางระบบจริง พบ `@@TRANCOUNT = 1` บน connection ที่ถูกคืนเข้าพูล หลังเพิ่ม guard ทดสอบเดิมได้ connection ใหม่ที่มี `@@TRANCOUNT = 0`

หลักฐานนี้ยืนยันกลไกที่สร้างอาการเดียวกัน แต่ยังไม่มี production log ที่ระบุ SQL error แรกของ transaction เก่าที่ถูกยกเลิก จึงยังไม่ยืนยันว่า query เดิมล้มเหลวด้วย error code ใด

## สิ่งที่แก้

- [Repository](../../../../backend/src/modules/connection-requests/connection-requests.repository.ts): รัน query ใน `hydrate` ตามลำดับเมื่ออยู่ใน transaction เพื่อให้ rollback เกิดหลัง query จบ การอ่านนอก transaction ยังคงใช้ `Promise.all`
- [Pool guard](../../../../backend/src/config/mssql-pool-guard.ts), [database configuration](../../../../backend/src/config/database.ts): ปิด connection ที่ถูกคืนพร้อม transaction หรือ SQL request ที่ยังไม่จบก่อนคืนเข้าพูล เพื่อปล่อย lock ทันที รวมถึงเมื่อไม่มีคนขอ connection ต่อ และรองรับการ destroy connection ที่ปิดไปแล้ว
- บันทึกเฉพาะสถานะ connection และการมี transaction ใน server log โดยไม่บันทึก SQL, bindings หรือข้อมูลยืนยันตัวตน

## Regression test

```bash
cd backend
npm test -- --runInBand tests/unit/database.transaction-lifecycle.test.ts
```

[ชุดทดสอบ](../../../../backend/tests/unit/database.transaction-lifecycle.test.ts) ใช้ repository, transaction implementation และ pool ของ Knex จริง แทนที่เฉพาะ Tedious wire connection จึงไม่ใช้ production credentials หรือเชื่อมฐานข้อมูลจริง

- ก่อนแก้: 1 ผ่าน / 2 ไม่ผ่าน โดยพบ connection ที่ไม่ถูกปิดและ rollback error แทน error ต้นเหตุ
- ตรวจกรณี commit, rollback ปกติ, nested transaction, commit ล้มเหลว, parallel reads ที่ทำให้ rollback ล้มเหลว และ hydration ของ repository จริง
- หลังแก้ต้องไม่เหลือ transaction บน connection ที่นำกลับมาใช้ และเส้นทาง hydration ต้องหยุดก่อนยิง query ถัดไปเมื่อ query แรกล้มเหลว

## ผลตรวจ backend

- Build และ typecheck ผ่าน
- Regression suite ผ่าน 5/5 กรณี โดย pool guard มี statement, branch, function และ line coverage 100%
- Lint ของ configuration, guard และ regression test ผ่านโดยไม่มี warning; repository ไม่มี lint error แต่มีคำเตือน Prettier เดิม 9 จุดนอกส่วนที่แก้
- ชุด backend รอบแรกผ่าน 4,725 กรณี มี 1 กรณี `ECONNRESET` ใน `poms-factories.route.test.ts` และข้าม opt-in tests 18 กรณี เมื่อรัน route suite นั้นซ้ำพร้อม regression suite ผ่านทั้ง 43 กรณี
- ชุด backend รอบสุดท้ายผ่าน 373 suites / 4,726 กรณี และข้าม opt-in tests 18 กรณี โดยไม่มี test ที่ล้มเหลว
- ลิงก์ภายในเอกสารและ diff whitespace ผ่าน ไม่มี temporary debug instrumentation

การปลด lock เป็นการกู้ระบบจริง ส่วนการป้องกันจะมีผลบนเซิร์ฟเวอร์หลังนำ backend ที่แก้แล้วไป deploy เท่านั้น ไม่จำเป็นต้องเปลี่ยน schema หรือ runtime OpenAPI เพราะ API contract เดิมไม่เปลี่ยน

อ้างอิงพฤติกรรม transaction และ rollback: [Knex transactions](https://knexjs.org/guide/transactions.html), [Knex MSSQL transaction implementation](https://github.com/knex/knex/blob/master/lib/dialects/mssql/transaction.js)

## การตรวจชุด release จาก main ล่าสุด

แยกเฉพาะ runtime 3 ไฟล์, regression test และ evidence/index รวม 6 ไฟล์บนฐาน `fc9dbbaade34e588cb91537c856d8455ee96e095` โดยคงโค้ดส่วนอื่นจาก `main` ทั้งหมด

- Build และ typecheck ผ่านบน release checkout
- Regression และ Chat route suites ผ่าน 71/71 กรณีหลังตรวจซ้ำกรณี `ECONNRESET`
- ชุด backend รอบสุดท้ายผ่าน 383 suites / 5,112 กรณี ข้าม opt-in tests 18 กรณี
- ตรวจเซิร์ฟเวอร์ก่อน release: checkout ที่ `a21d02ea89ebdb4c4e05eaaae7ae4407d41b611c` ไม่มี tracked source changes และฐานข้อมูลไม่มี pending migrations
- Runtime OpenAPI และ frontend fingerprints ถูกบันทึกไว้เปรียบเทียบหลัง deploy เพราะชุดแก้นี้ไม่เปลี่ยน API contract หรือ frontend
