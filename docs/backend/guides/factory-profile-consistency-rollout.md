# ข้อมูลทั่วไปโรงงานเข้าข่ายและ POMS ชุดเดียวกัน

ระบบคงข้อมูลโรงงาน 3 ส่วนตามหน้าที่เดิม:

| ส่วน | หน้าที่ | การแก้ไขในงานนี้ |
| --- | --- | --- |
| ข้อมูลต้นทาง Fac60k ประมาณ 60,000 โรงงาน | ค้นหาและอ้างอิงทะเบียนต้นทาง | อ่านอย่างเดียว ไม่เปลี่ยนข้อมูลหรือพฤติกรรม API ต้นทาง |
| โรงงานเข้าข่าย | โรงงานที่เลือกเข้าข่ายและข้อมูลการเข้าข่าย | ข้อมูลทั่วไปใช้แหล่งหลักร่วมกับ POMS |
| โรงงานใน POMS | โรงงานที่เชื่อมต่อแล้วและจุดตรวจวัดปัจจุบัน | ข้อมูลทั่วไปใช้แหล่งหลักร่วมกับโรงงานเข้าข่าย; จุดตรวจวัดยังเป็นข้อมูล POMS |

จำนวน 60,000 เป็นขนาดข้อมูลที่ผู้ใช้ระบุ ไม่ใช่ผลนับฐานข้อมูลจริงจากการตรวจรอบนี้ ตาราง `factories` ยังเป็นข้อมูลประกอบตัวตน/สิทธิ์และทะเบียน ส่วนโรงงานที่เชื่อมต่อ POMS คือ active `cems_wpms_connected_measurement_points`.

## โครงสร้างและขอบเขต

ตารางกลาง `factory_profiles` เก็บข้อมูลทั่วไปร่วมของส่วนที่ 2–3 โดยมีหนึ่งรายการต่อ `eligible_factories.id` พร้อม `revision` และ `factory_profile_events` บันทึกการเปลี่ยนข้อมูลทั่วไปใน transaction เดียวกัน API ยังใช้ `factoryId`, เลขทะเบียน, eligible ID และ station ID ตาม contract เดิม ไม่รวมโรงงานด้วยชื่อหรือเปลี่ยนรหัสให้ client.

ข้อมูลทั่วไปที่มีเจ้าของร่วม ได้แก่ ชื่อ ที่อยู่ จังหวัด นิคม พิกัด EIA/ข้อความอื่น/สถานะ EIA ชื่อโครงการ ลักษณะกิจการ ลำดับประเภทโรงงาน และรูปโรงงาน/โลโก้ตาม field ที่แต่ละ API รองรับ ฟอร์มที่ผูกโรงงานเข้าข่ายใน canonical mode ต้องใช้ EIA ตามตัวเลือกที่รองรับ; ข้อความอิสระที่ไม่รองรับต้องแก้ก่อนเลือกเข้าข่าย เพื่อไม่ให้ระบบลบทิ้งระหว่างแปลงค่า การไม่ส่ง field คงค่าเดิม ส่วน `null` ใช้ล้างค่าตาม contract.

ข้อมูลการเข้าข่าย สถานะ workflow รายละเอียดจุดตรวจวัด พารามิเตอร์ เอกสารจุด และเครื่องมือยังอยู่ใน domain เดิม ไม่ได้ย้ายทั้งหมดมาเป็นแถวเดียว.

เมื่อเปิด `FACTORY_PROFILE_MODE=canonical` การอ่านข้อมูลปัจจุบันผ่าน `current_eligible_factories`, `current_connected_measurement_points` และ `current_factory_monitoring_point_forms` จะใช้ค่าจาก profile เดียวกัน รวม `null` ที่ตั้งใจล้าง ค่าเก่าจากทะเบียนหรือคำขอไม่ควรเติมกลับแทนข้อมูลปัจจุบัน.

การแก้ข้อมูลทั่วไปผ่านขั้นอนุมัติเดิมจะปรับ profile และสำเนาที่ API เก่ายังใช้อยู่ใน transaction เดียวกัน การแก้เฉพาะจุดตรวจวัดไม่เพิ่ม revision ของข้อมูลทั่วไปและไม่แก้โรงงานเข้าข่าย การยื่นคำขอที่แก้ทั้งสองส่วนยังต้องตรวจเวอร์ชันทั้งสองส่วนก่อนอนุมัติ.

คำขอเชื่อมต่อครั้งแรกเติมข้อมูลที่ contract อนุญาตผ่าน writer ร่วมเมื่อ revision ที่บันทึกตอนยื่น/ส่งแบบใหม่ยังตรงกับ profile ปัจจุบัน คำขอเก่าที่ไม่มี revision หรือ revision เปลี่ยนต้องโหลดข้อมูลล่าสุดและส่งแบบใหม่ก่อน สำหรับสถานะรอหรือยืนยันเชื่อมต่อ เจ้าหน้าที่ใช้ REQUEST_REVISION ผ่าน POST /cems-wpms-requests/:id/status ตามเงื่อนไข conflict เพื่อส่งกลับให้เจ้าของคำขอเดิมแก้ไข คำขอ direct ยังคงเป็นเจ้าหน้าที่ผู้สร้างเดิมที่ส่งแบบใหม่ สิทธิ์เจ้าของไม่ได้เปลี่ยน ส่วนการเพิ่มจุด/เพิ่มพารามิเตอร์หลังมีจุด active จะใช้ข้อมูลทั่วไปปัจจุบัน ไม่เล่นซ้ำข้อมูลทั่วไปจากคำขอเก่า ประวัติคำขอ `currentFactory`/`proposedFactory` และรายงานที่บันทึกแล้วเป็น snapshot ต่อไป.

รายละเอียด API อยู่ที่ [โรงงานเข้าข่าย](../api/menus/eligible-factories/README.md), [คำขอเชื่อมต่อ](../api/menus/connection-requests/README.md) และ [แก้ไขข้อมูลพื้นฐาน POMS](../api/menus/master-data/factory-edit-requests.md).

## ขั้นตอนเปิดใช้จริง

ค่าเริ่มต้นยังเป็น `FACTORY_PROFILE_MODE=legacy` เพื่อเตรียม schema และตรวจข้อมูลก่อนสลับทุก instance พร้อมกัน ขั้นตอนต่อไปนี้เป็น runbook สำหรับผู้ดูแล ไม่ใช่หลักฐานว่าได้ deploy หรือย้าย production แล้ว.

1. ทดสอบ migrations `0114` และ `0115` บน SQL Server รุ่นเดียวกับระบบจริงในฐานข้อมูลแยก ทดสอบ UTF-8/ภาษาไทย, `null`, decimal coordinates, views, unique/FK/check constraints, transaction rollback และคำขออนุมัติพร้อมกัน ใช้ข้อมูลสมมติหรือสำเนาที่ผ่านการจัดการข้อมูลอ่อนไหวแล้ว.
2. สำรองฐานข้อมูลและตรวจแผนคืนระบบก่อน deploy schema แบบเพิ่มใหม่ โดยยังคง legacy mode. ตรวจ migration number และ schema ของปลายทางอีกครั้งก่อนรัน.
3. รัน audit อ่านอย่างเดียวจากเครื่องที่เข้าถึงฐานข้อมูลได้ คำสั่งจาก `backend/` ใช้ environment ที่ผู้ดูแลจัดไว้แล้ว ห้ามใส่ credential ลง command line หรือรายงาน:

   ```bash
   ./node_modules/.bin/tsx scripts/factory-profile-backfill.ts --dry-run
   ```

   รายงานมีจำนวนรายการ, internal IDs และชื่อ field ที่ขัดแย้ง ไม่มีค่าข้อมูลโรงงาน ไม่มีการเลือกผู้ชนะจาก `updated_at`. การเทียบรหัสประเภทโรงงานใช้กติกา normalize เดิม เช่น `88` เท่ากับ `00088` โดยไม่แก้ค่าต้นทาง. Exit `2` หมายถึงมีข้อขัดแย้งที่ต้องจัดการ; exit `1` คือ options หรือการทำงานล้มเหลว.

4. ตรวจรายการ alias ซ้ำ, eligible link ขาด, แบบฟอร์มเชื่อมหลายโรงงาน, ค่าร่วมขัดแย้ง, EIA ที่ไม่ตรง domain และรูปไม่ตรงกันกับผู้ดูแลข้อมูล ระบุค่าที่ถูกต้องและแผนแก้รายรายการก่อนแก้ข้อมูลจริง เครื่องมือจะไม่แก้ความขัดแย้งหรือเชื่อมรหัสให้เอง.
5. เมื่อผล audit ไม่มี conflict ให้หยุด writers ที่แก้ข้อมูลชุดนี้ในทุก instance/job ระหว่าง cutover แล้วรัน apply ด้วย user ID ผู้ปฏิบัติงานที่มีอยู่จริง:

   ```bash
   ./node_modules/.bin/tsx scripts/factory-profile-backfill.ts --apply --actor-id <USER_ID> --batch-size 100
   ```

   `batch-size` จำกัดจำนวน profile ที่ insert ต่อรอบ แต่ audit และ lock ครอบคลุม active source ทั้งชุด จึงต้องกำหนดช่วงดำเนินงานให้เหมาะกับขนาดจริง ทุก batch ตรวจใหม่ใน transaction ภายใต้ `UPDLOCK,HOLDLOCK`; พบ conflict ใดจะหยุดก่อน insert. รันซ้ำจน `missingProfiles=0` โดยไม่เขียนทับ profile ที่มีอยู่แล้ว.
6. รัน dry-run ซ้ำ ต้องได้ `readyForCanonical=true`, `missingProfiles=0`, `conflicts=0` และตรวจ schema/views/คอลัมน์เวอร์ชันครบก่อนเปลี่ยน config. เปิด canonical mode ทุก API instance พร้อมกันก่อนเปิด writers; ห้ามปล่อย legacy writer ทำงานร่วมกับ canonical writer.
7. ทดสอบด้วยบัญชี/โรงงานทดสอบที่อนุญาต: อ่าน eligible เทียบ POMS; อนุมัติข้อมูลทั่วไปแล้วอ่านทั้งคู่; ล้างค่า; แก้จุดอย่างเดียวแล้วตรวจ profile/eligible คงเดิม; คำขอเก่าต้องไม่ย้อนค่า; ส่งสองคำขอแข่งกันต้องไม่เกิด lost update; ตรวจสิทธิ์จังหวัด/นิคม/โรงงานเจ้าของ, เลขรายงานใหม่ และ integration. ยืนยันทะเบียนต้นทางและประวัติเดิมไม่เปลี่ยน.
8. ตรวจ `/api/v1/openapi.json` ของ release ที่ deploy ว่าสอดคล้องกับ source contract แล้วเก็บผลทดสอบและ deployment identity ใน evidence.

## การคืนระบบและข้อจำกัด

ก่อนเปิด writers สามารถคง legacy mode ไว้ได้ หากต้องคืนระบบหลัง canonical เขียนข้อมูลแล้ว ให้หยุด writers ตรวจว่า compatibility projections ตรงกับ profile และตรวจคำขอค้างก่อนเลือกแผนคืนระบบ โดยต้องรักษา profile/events ไว้ การสลับ config กลับ legacy อย่างเดียวไม่รับประกันว่าจะนำกลับเข้า canonical ได้โดยไม่มี drift.

Migrations `0114` และ `0115` ปฏิเสธการ down เมื่อมี profile/event เพื่อไม่ลบข้อมูลหลักและประวัติ หลังเริ่มใช้งานควรแก้ด้วย forward migration ที่ตรวจแล้ว ไม่ใช้ rollback ลบตาราง.

ผลทดสอบใน workspace ใช้ fixture, HTTP แบบจำลอง และการ compile SQL ของ Knex ผลเหล่านี้ไม่แทนการทดสอบ migrations/transaction isolation บน SQL Server จริง. หลังผู้ดูแลปรับ firewall วันที่ 11 กันยายน 2026 เชื่อมต่อฐาน `poms` และตรวจแบบ SELECT-only สำเร็จ: โรงงานเข้าข่าย 909 รายการ, POMS 12 โรงงาน/13 จุด active, แบบฟอร์มที่ผูก 907 รายการ. ไม่พบความต่างในฟิลด์ทั่วไปร่วมระหว่าง eligible กับ POMS ที่ตรวจ แต่พบ eligible กับแบบฟอร์มที่ผูกต่างกัน 244 โรงงาน จึงยังไม่พร้อม backfill หรือเปิด canonical; ดู [หลักฐานและรายละเอียดความต่าง](../evidence/master-data/factory-profile-consistency.md).

ได้ทดสอบ migrations ใหม่, rollback และ concurrent shared writers บน SQL Server จริงด้วย fixture schema แล้ว 20/20 รายการ และลบฐานทดสอบตามที่ผู้ดูแลยืนยัน. ผลนี้ยังไม่ครอบคลุม schema production ทั้งหมดหรือ authenticated HTTP approvals. ลำดับถัดไปคือจัดทำค่าที่ถูกต้องสำหรับ 244 โรงงานตามขั้น 4 และตรวจขอบเขตที่เหลือก่อน cutover; ห้ามเลือกค่าจาก timestamp หรือถือว่าแบบฟอร์มถูกเสมอ. ยังไม่แก้ข้อมูลจริงหรือเปิด canonical ใน production.

## เมื่อยังไม่มีฐานทดสอบ

เตรียม [สคริปต์สร้างฐานทดสอบ](../../../backend/scripts/sql/create-factory-profile-test-database.sql) สำหรับ SQL Server instance เดียวกับ `poms`. ค่าเริ่มต้นเป็น preview (`@PomsCreateApproved = 0`) และยังไม่สร้างฐาน; เปลี่ยนเป็น 1 เฉพาะหลังผู้ดูแลอนุมัติการสร้างฐานและทดสอบในฐานนั้น.

- ชื่อฐานตายตัว `poms_factory_profile_test`; ถ้ามีอยู่แล้วสคริปต์หยุด ไม่มีการ drop/reset หรือย้ายข้อมูลจาก production.
- Data file เริ่ม 32 MB สูงสุด 512 MB; log เริ่ม 16 MB สูงสุด 256 MB. รวมไฟล์เริ่ม 48 MB สูงสุด 768 MB. ขีดจำกัดนี้ไม่ครอบคลุม CPU, RAM หรือ tempdb ของ instance.
- ใช้ collation `SQL_Latin1_General_CP1_CI_AS` และ compatibility 170 ตาม metadata จริงที่ตรวจ; ถ้า source เปลี่ยน สคริปต์หยุดให้ทบทวนแผน.
- ใช้ recovery SIMPLE และ snapshot settings OFF ในฐานทดสอบ. ตรวจว่า model ไม่มี custom objects ก่อนสร้าง และติด extended property `PomsTestPurpose=factory-profile-integration-synthetic-only` เพื่อยืนยันบทบาทของฐาน.
- ไม่เปลี่ยน application `.env`, login, production database, SQL Agent jobs หรือ instance settings. ไม่ start server/jobs/background workers ระหว่างทดสอบ.
- หากเกิด error หลังสร้างฐาน ให้ตรวจสถานะก่อนทำต่อ ไม่มีการลบฐานทิ้งหรือ retry mutation อัตโนมัติ.

ก่อนเริ่มทุกชุดทดสอบต้องตรวจ `DB_NAME() = 'poms_factory_profile_test'` และ extended property ข้างต้นบน connection ที่จะเขียนจริง. ตั้ง target database ชัดเจน ไม่ใช้ fallback ของ `DB_NAME` ใน environment และไม่เรียก production deploy command. สร้าง schema ที่จำเป็นและข้อมูลสมมติ แล้วทดสอบ migration 0114/0115, การเขียนข้อมูลทั่วไปพร้อม projections, point-only updates, stale revision, rollback และการเขียนพร้อมกันสอง connection. ต้องรายงาน SQL Server integration ว่าผ่านเมื่อรันสำเร็จจริงเท่านั้น.

ฐานแยกบน instance เดียวกันยังใช้ CPU/RAM/disk ร่วมกับ production. เริ่มจาก fixture ขนาดเล็กและ connection จำนวนน้อย; การทดสอบปริมาณมากต้องกำหนดสภาพแวดล้อมหรือช่วงเวลาแยกเพิ่มเติม.

อ้างอิงข้อกำหนด `SIZE/MAXSIZE/FILEGROWTH` และการสร้างไฟล์จาก [Microsoft: CREATE DATABASE](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-database-transact-sql?view=sql-server-ver17).

### รันชุด SQL verification และลบฐานหลังผ่าน

ใช้ [factory-profile-sql-verification.ts](../../../backend/scripts/factory-profile-sql-verification.ts) บนฐานว่างที่ provision แล้วเท่านั้น. กำหนด `POMS_SQL_TEST_HOST`, `POMS_SQL_TEST_DATABASE=poms_factory_profile_test`, `POMS_SQL_TEST_USER`, `POMS_SQL_TEST_PASSWORD` และค่าพอร์ต/encryption/certificate ที่ผู้ดูแลตรวจแล้วใน environment ของ process; ไม่บันทึก secrets ลง source หรือ command history. ไม่ใช้ `DB_*` ของ application เป็น fallback.

จาก `backend/`:

```bash
node --import tsx scripts/factory-profile-sql-verification.ts --run-synthetic-tests
```

สคริปต์ใช้ pool สูงสุด 3 connection (สอง writer และหนึ่งตัวตรวจ lock wait), เรียก migrations 0114/0115 จริงผ่าน Knex และใช้ข้อมูลสมมติ. ไม่เริ่ม server/jobs และไม่เรียก migration ประวัติทั้งโครงการ. บันทึก successful-run marker เฉพาะหลังครบทุก check พร้อม report ที่มี `runId`, `databaseGuid` และ `passed=true`. เก็บรายงานในพื้นที่ภายในที่ไม่เก็บ credentials.

เมื่อผ่านและได้รับอนุมัติให้ cleanup ใช้ [drop-factory-profile-test-database.sql](../../../backend/scripts/sql/drop-factory-profile-test-database.sql): ใส่ `@PomsExpectedDatabaseGuid` และ `@PomsExpectedPassedRun` จาก report, รัน preview ก่อน แล้วเปลี่ยน `@PomsDropApproved=1`. ตรวจชื่อฐาน, GUID, purpose, passed-run marker และต้องไม่มี user session ในฐานนั้น. สคริปต์ไม่มี forced disconnect หรือ automatic retry. หลังลบต้องยืนยัน `DB_ID` เป็น null และ file registrations ของฐานเดิมเป็น 0.

หาก test ล้มเหลว เก็บฐานไว้ตรวจสาเหตุ ไม่ลบอัตโนมัติหรือสั่งรันซ้ำทับฐานเดิม. ฐานทดสอบรอบที่บันทึกใน [หลักฐาน](../evidence/master-data/factory-profile-consistency.md) ผ่านและถูกลบแล้ว.

## ขั้นตรวจโหมดใน workflow production

Workflow [Deploy POMS](../../../.github/workflows/deploy.yml) รัน migrations ก่อนขั้น `Verify factory profile activation prerequisites` แล้วจึงคัดลอกไฟล์ service. ขั้นนี้อ่าน mode จาก environment บนเซิร์ฟเวอร์จริงและพิมพ์ `[factory-profile-deploy] mode=...`.

- `legacy`: deploy ต่อได้ โดยไม่รัน backfill.
- `canonical`: ตรวจ read-only audit และต้องได้ `readyForCanonical=true`; ถ้ามี conflict/profile ขาด/schema ไม่ครบหรือเชื่อม DB ไม่ได้ จะหยุดก่อนคัดลอกและ restart service.

การ deploy code/schema สำเร็จใน legacy ไม่ใช่การเปิดข้อมูลกลางแล้ว. ยังต้องดำเนินการ cutover และยืนยันผลตามขั้นตอนข้างต้นก่อนเปลี่ยน mode.
