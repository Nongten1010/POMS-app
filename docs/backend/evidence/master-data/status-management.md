# หลักฐาน API จัดการสถานะ Admin

[สัญญา API และ frontend handoff](../../api/menus/master-data/status-management.md)

## พฤติกรรมที่ตรวจได้

- ตรวจหน้า production ผ่านแท็บ D-POMS ที่ผู้ใช้ล็อกอินให้: `roleCodes=[admin]`, `userType=officer`
- ไปข้อมูลพื้นฐาน → รายชื่อโรงงาน → จัดการสถานะ หน้าต่างมีโรงงาน จุดตรวจวัด และพารามิเตอร์พร้อมหน่วย
- dropdown โรงงานมี แสดง / ซ่อน / ยกเลิกการเชื่อมต่อ; การเปิดหน้าต่างเรียก `GET /poms-factories/:factoryId`
- ไม่กดบันทึกหรือเปลี่ยนสถานะข้อมูล production
- โค้ด backend ก่อนแก้ไม่มี GET/PATCH status-management และ mapper รายชื่อโรงงานกำหนด `status: 'แสดง'` ตายตัว
- ข้อสรุปจำกัดเฉพาะ backend: ยังไม่มีสัญญาและ persistence สำหรับสถานะตามหน้าต่าง ไม่ได้ยืนยันพฤติกรรมปุ่มบันทึกเดิมด้วยการแก้ production

## RED → GREEN

เส้นทางทดสอบ: `backend/tests/unit/poms-status-management.route.test.ts`

```text
ก่อนเพิ่ม route:
GET /api/v1/poms-factories/F1/status-management
JWT userType=officer, roles=[admin], factories:view + factories:edit
Expected: 200
Received: 404

หลังเพิ่ม route และตรวจ role/scope:
GET/PATCH ของ Admin ผ่าน
ไม่มี JWT → 401
ไม่มี role admin แม้ userType=admin / scope=ALL → 403
ขาด view หรือ edit permission ตอน PATCH → 403
payload ผิด / field เกิน / ID หรือ parameter ซ้ำ → 400
```

ทดสอบ state และ persistence ด้วย current connected-point fixtures: ซ่อน/แสดงทั้งสามระดับ, ยกเลิกโรงงาน/รายจุด, คงค่าลูกหลังเปลี่ยนค่าแม่, parameter key พร้อม label หน่วย, ป้องกันข้ามโรงงาน/ข้ามจุด, revision เก่า, บันทึกซ้ำ, rollback เมื่อ audit ล้มเหลว และอ่านสถานะที่บันทึกกลับมา

ทดสอบ SQL ด้วย Knex MSSQL compiler: parent `UPDLOCK, HOLDLOCK`, parameter binding, JSON checks, foreign keys, revision และ unique audit index

## Verification

| รายการ | ผล |
| --- | --- |
| Build / TypeScript | ผ่าน `npm run build` และ `tsc --noEmit` |
| Lint โค้ด module ใหม่ + OpenAPI ใหม่ + migration | ไม่มี errors/warnings |
| ชุดทดสอบ backend | Release candidate บน origin/main ล่าสุด: 197 suites / 2,023 tests ผ่านทั้งหมด |
| Coverage เฉพาะโค้ดสถานะใหม่ | statements 94.19%, branches 85.86%, functions 100%, lines 95.23% |
| Runtime OpenAPI | สัญญา GET/PATCH อยู่ในเอกสารจริง, body example ผ่าน validator จริง, enum สถานะรายการโรงงานรองรับ 3 ค่า, registry 143 canonical / 152 operations |
| AgentShield 1.4.0 | findings 0 แต่ filesScanned 0 จึงไม่ใช่หลักฐานความปลอดภัยของแอป |
| ขอบเขตการแก้ | backend + canonical docs; ไม่มี frontend หรือการเปลี่ยนสถานะข้อมูล production; release ผ่าน workflow Deploy POMS ตามคำขอผู้ใช้ |

ชุดทดสอบใหม่อยู่ใน `backend/tests/unit/poms-status-management.*.test.ts`; regression การอ่าน status โรงงานอยู่ใน `poms-factories.repository.test.ts`

## ข้อจำกัดและก่อน deploy

- ยังไม่ได้รัน migration บน MSSQL จริง; ทดสอบ transaction ด้วย in-memory executor และ compile SQL เท่านั้น การตรวจ locking ไม่ใช่การทดสอบ concurrent transactions บน SQL Server จริง
- ต้องรัน migration `0113_create_poms_status_management.ts` ก่อน backend รุ่นนี้ เนื่องจากรายการโรงงาน join ตารางสถานะใหม่
- Frontend ต้องผูก GET/PATCH, ส่ง reason/revision และใช้ effective fields ตามสัญญา งานนี้ไม่เปลี่ยนการกรองทุกหน้าหรือปิดรับ telemetry
- หลัง deployment ที่ได้รับอนุญาต ต้องตรวจ runtime OpenAPI และทดสอบ save/read ด้วยข้อมูลทดสอบที่อนุญาต

## Release candidate

- เตรียมจาก clean origin/main ที่ `a289e1b28c4e5c40d0defb29ba04fdcd9b00e7e9` และนำเฉพาะ delta ของงานสถานะ 30 ไฟล์เข้า release
- เปลี่ยนเลข migration งานสถานะเป็น `0113` เพราะ `0112_repair_approved_p0260_parameters.ts` มีอยู่บน main แล้ว
- ชุดทดสอบ backend ทั้งหมดผ่าน 2,023/2,023; build, typecheck, source lint และ diff whitespace check ผ่าน
