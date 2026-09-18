# ผลทดสอบข้อมูลสรุปรายการคำขอแก้ไขโรงงาน POMS

เอกสารนี้บันทึกผลทดสอบในเครื่องสำหรับการปรับ `GET /api/v1/poms-factories/edit-requests` ไม่ใช่หลักฐานว่า deploy แล้ว Contract สำหรับ frontend อยู่ที่ [List summary และจุดเป้าหมาย](../../api/menus/master-data/factory-edit-requests.md#edit-request-list-summary)

## ปัญหาและสาเหตุที่ยืนยัน

List เดิม hydrate factory/measurement snapshots และ event timeline เหมือน detail โดยไม่มีข้อมูลว่าผู้ใช้ส่ง ID จุดใดมาใน create/resubmission การใช้ `proposedMeasurementPoints[0]` ในตารางจึงเลือก WPMS ได้ แม้จุดที่แก้เป็น CEMS การเพิ่ม `connectedPointId` ใน API `/form` ก่อนหน้านี้ไม่ได้แก้ list contract

Regression fixture ใช้คำขอ `point-00024/2569` (`id: 48`): จุด WPMS / P0155 / 10024 อยู่ก่อน CEMS / S0915 / 10021 และเปลี่ยนเฉพาะข้อมูล CEMS ชุดข้อมูลนี้เป็น fixture ในเครื่อง ไม่ใช่การอ่านหรือแก้คำขอจริงบน production

ก่อนแก้ คำสั่งต่อไปนี้ fail เพราะไม่มี `targetMeasurementPoints` ในผลลัพธ์ หลังแก้ผ่าน และไม่คืน snapshot/event fields ที่ไม่ใช้ในตาราง:

```bash
cd backend
npm test -- --runInBand tests/unit/poms-factories.list-summary.test.ts
```

## สิ่งที่ตรวจแล้ว

- เก็บเฉพาะ IDs จาก payload ตอนสร้างและส่งแก้ไข พร้อมบันทึกใน audit event ของรอบนั้นภายใน transaction เดียวกัน; การส่งแก้ไขแทนที่ ID เก่าในแถวคำขอ
- IDs ที่ส่งมีลำดับและจำนวนครบ รวมจุดที่ค่าเดิมเมื่อคำขอมีการเปลี่ยนส่วนอื่น และกรณีแก้เฉพาะข้อมูลติดต่อระดับระบบ
- คำขอเก่าเทียบ snapshot ด้วย ID ได้แม้สลับลำดับ; ไม่เดาจากจุดแรกหรือจากระบบเพียงอย่างเดียว
- หลายจุด ชื่อซ้ำ รหัส `null`, `BASIC_INFO`, ข้อมูลไม่พอ และ IDs/snapshot ไม่สมบูรณ์ ให้ผลตามสถานะแหล่งหลักฐานใน contract
- การเปลี่ยนอีเมลระดับระบบที่กระจายไปทุกจุด และรูปหน้าโรงงาน ไม่สร้างเป้าหมายย้อนหลังที่ไม่มีหลักฐาน
- Query รายการคง filter, data scope และลำดับใหม่ก่อน ใช้ query เดียว ไม่มีการโหลด events หรือ detail แยกทีละแถว และไม่ select factory profile snapshots
- Detail/form, workflow create/resubmit/review/cancel และ OpenAPI tests เดิมยังผ่าน
- Migration สร้าง nullable `nvarchar(max)` สำหรับ `target_measurement_point_ids_json` โดยไม่เติมข้อมูลย้อนหลังจากการคาดเดา; ตรวจ SQL ที่สร้างโดย Knex โดยไม่เชื่อมฐานจริง

## ผล verification

```bash
cd backend
npm test -- --runInBand poms-factories poms-edit-request-target-migration poms-measurement-point-edit-requests api-docs.route api-docs.openapi factory-profiles.openapi
npm run typecheck
```

- 25 test suites / 490 tests ผ่าน
- Typecheck ผ่าน
- ESLint เฉพาะไฟล์ที่เปลี่ยน: ไม่มี error; มี warning เดิมหนึ่งจุดใน `poms-factories.general-info-approval.test.ts` เรื่อง non-null assertion ที่ไม่ได้แก้ในงานนี้
- ตรวจ diff, local links, JSON ตัวอย่าง และการเข้าถึงเอกสารจาก backend hub
- การทดสอบ route รอบหนึ่งถูก sandbox ปิดกั้นการเปิดพอร์ต (`EPERM`); รันทดสอบซ้ำโดยอนุญาตพอร์ตชั่วคราวแล้วผ่าน ไม่มีการแก้ production เพื่อทดสอบ

## การส่งต่อและข้อจำกัด

ต้องรัน [migration 0123](../../../../backend/src/db/migrations/0123_add_poms_edit_request_target_ids.ts) ก่อนเปิด backend รุ่นนี้ และประสาน frontend ให้เลิกอ่าน snapshots จาก list ตาม [breaking-change migration](../../api/CHANGELOG.md#poms-edit-request-list-summary) การแก้ครั้งนี้ไม่แก้ `frontend/`

ยังไม่ได้รัน migration กับ SQL Server จริงหรือ deploy production จึงยังไม่ยืนยันผล authenticated GET ของคำขอจริง หลัง release ต้องตรวจ OpenAPI ที่ production และ list/detail/form ด้วยบัญชีที่มีสิทธิ์ รายการเก่าที่อนุมานได้แสดง `SNAPSHOT_DIFF` ซึ่งอาจไม่ครอบคลุมจุดที่ส่งค่าเดิม; รายการที่หลักฐานไม่พอแสดง `UNKNOWN` โดยไม่แก้ข้อมูลเก่าจากการคาดเดา

Implementation: [target resolution](../../../../backend/src/modules/poms-factories/poms-edit-request-targets.ts), [repository](../../../../backend/src/modules/poms-factories/poms-factories.repository.ts), [regression tests](../../../../backend/tests/unit/poms-factories.list-summary.test.ts)
