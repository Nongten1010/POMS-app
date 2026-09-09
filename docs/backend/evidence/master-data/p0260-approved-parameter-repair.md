# ซ่อมพารามิเตอร์ P0260 ตามคำขอที่อนุมัติแล้ว

คำขอ `point-00001/2569` ของโรงงาน `10100000125241` เปลี่ยนพารามิเตอร์จาก
`BOD (mg/l), COD (mg/l), Watt (kW/hr)` เป็น
`BOD (mg/l), Watt (kW/hr), Flow rate (m3/hr)` แต่ข้อมูล POMS ที่ใช้งานจริงยังเป็นรายการเดิม
หลัง deploy การแก้ approval path แล้ว ข้อมูลที่อนุมัติก่อนหน้านั้นต้องซ่อมแยกต่างหาก

## หลักฐานก่อนซ่อม

ตรวจ production วันที่ 9 กันยายน 2569 เวลา 09:24 UTC:

- `GET /api/v1/public/factory-map-points?systemType=WPMS` สำหรับ `P0260` คืน BOD, COD, Watt จาก `cems_wpms_connected_measurement_points.parameters_json`
- `GET /api/v1/integrations/device-configs/P0260` คืนช่อง BOD address 1, COD address 2, Watt address 3 ของ `P0260/01`
- ข้อมูล POMS และค่าตั้งอุปกรณ์ไม่ตรงกับผลอนุมัติ จึงไม่ใช่เพียง cache หน้าเว็บ

## การซ่อม

[Migration 0112](../../../../backend/src/db/migrations/0112_repair_approved_p0260_parameters.ts)
ทำงานเฉพาะ production และล็อกคำขอที่อนุมัติแล้วตามโรงงาน/เลขคำขอข้างต้น
ตรวจ identity, ผลอนุมัติ, ผู้พิจารณาเดิม, คำขออนุมัติที่ใหม่กว่า และการเปลี่ยนข้อมูลหลังอนุมัติ
ก่อนแก้ไข ต้องผ่านเงื่อนไขของ [ตัววางแผนซ่อม](../../../../backend/src/modules/poms-factories/poms-approved-parameter-repair.ts)

สำรองคำขอ จุดตรวจวัด config และช่องอุปกรณ์ไว้ใน
`poms_p0260_parameter_repair_backup_20260909.snapshot_json` ภายใน transaction เดียวกับการซ่อม
ช่อง `execution` ระบุว่าเป็น migration อัตโนมัติ และ `approval_reviewer_id` อ้างอิงผู้อนุมัติเดิม

การซ่อมเขียน `parameters_json` และปรับ `instruments_json` ของจุด P0260
จากนั้น retire ช่อง COD ที่ไม่อยู่ในผลอนุมัติ โดยคง address ของ BOD/Watt เดิม
ไม่เปลี่ยนสถานะคำขอหรือ replay ข้อมูลโรงงานอื่น และไม่กำหนด address ให้ Flow โดยเดาจากช่อง COD
หน้าอุปกรณ์ตาม [สัญญา API ปัจจุบัน](../../api/menus/connection-requests/device-configs.md)
ต้องแสดง Flow เป็นพารามิเตอร์รอตั้งค่าจนมี address จริง

Migration เป็น forward-only: ไม่ย้อนผลอนุมัติเมื่อ rollback แอป
หากจำเป็นต้องกู้คืน ให้ตรวจข้อมูลปัจจุบันและ backup ก่อนทำ recovery ที่ได้รับอนุญาตแยกต่างหาก

## การทดสอบ

[Regression ของ migration](../../../../backend/tests/unit/poms-p0260-approved-repair-migration.test.ts)
จับกรณีข้อมูล POMS ยังคง COD ก่อนใส่การซ่อม และตรวจการสำรองก่อนเขียน การคง address เดิม
การปฏิเสธข้อมูลเปลี่ยนภายหลัง/ผลอนุมัติผิดเป้าหมาย และการปฏิเสธ update ที่ไม่กระทบหนึ่งแถว
ร่วมกับ tests ของ approval, repair planner และ channel reconciliation รวม 19 เคสผ่าน

หลัง deploy ต้องอ่าน API ทั้งสองชุดซ้ำ: POMS ต้องเป็น BOD/Watt/Flow และ integration ต้องไม่คืน COD
Flow อาจยังไม่มีใน integration จนกว่าจะบันทึกการผูก address อุปกรณ์จริง

Docs impact: updated — เพิ่มหลักฐานการซ่อมข้อมูลตาม [สัญญาคำขอข้อมูลพื้นฐาน](../../api/menus/master-data/factory-edit-requests.md)
โดยไม่เปลี่ยน endpoint, schema, permission หรือ runtime OpenAPI
