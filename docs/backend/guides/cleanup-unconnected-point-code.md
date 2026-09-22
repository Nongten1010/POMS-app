# ล้างจุดที่ยังไม่เชื่อมต่อและคืนรหัสค้าง

ใช้คู่กับ [สัญญาการส่งฟอร์มแก้ไข](../api/menus/connection-requests/request-payloads-and-validation.md#put-apiv1cems-wpms-requestsidform) และ [กติกาการกำหนดรหัส](../api/menus/connection-requests/README.md#point-code-contract) เมื่อจุดในคำขอถูกแทนที่ แต่ทะเบียนรหัสยังผูกกับจุดเก่าที่ถูกลบไว้

## พฤติกรรม backend หลังแก้ไข

การส่งแบบแก้ไขคง ID, รหัส, assignment metadata และเจ้าของการจองของจุด active ที่ได้รับรหัสแล้วและยังอยู่ในฟอร์ม แก้เฉพาะรายละเอียดจุด โดยจับคู่ด้วยรหัสเดิมหรือชื่อเดิมเมื่อไม่ส่งรหัส และไม่อาศัยลำดับ array หากระบุจุดไม่ได้ต้องส่งรหัสเดิมตาม [กติกา resubmit](../api/menus/connection-requests/request-payloads-and-validation.md#put-apiv1cems-wpms-requestsidform) ผู้ประกอบการเปลี่ยนรหัสเองไม่ได้ และการอนุมัติไม่ต้องกำหนดรหัสเดิมซ้ำ

จุดที่มีรหัสซึ่งตัดออกจริงหรือแถวเก่าที่มี `deleted_at` จะถูกลบถาวรและตรวจการคืนรหัส ส่วน snapshot ของจุดที่ยังไม่มีรหัสยังถูกแทนที่และได้รับ ID ใหม่ตาม flow เดิมแม้ยังอยู่ในฟอร์ม คืนเฉพาะรหัสที่ทะเบียนระบุเจ้าของตรงกับจุดและคำขอนั้น การลบและคืนรหัสอยู่ใน transaction เดียวกัน เมื่อมีการอ้างอิงที่ทำให้คืนรหัสไม่ได้ ทั้งคำขอจะไม่เปลี่ยนแปลง สคริปต์ล้างด้านล่างใช้ซ่อมข้อมูลค้างจากพฤติกรรมเก่า ไม่ใช่ขั้นตอนปกติทุกครั้งที่ส่งแบบแก้ไข

ตัวคำขอและ `statusHistory` ยังอยู่ จุดที่สร้างใหม่และ snapshot ที่ถูกแทนที่ได้รับ ID ใหม่ รหัส legacy ที่คืนจากการลบจริงสามารถกำหนดใหม่ด้วย `MANUAL_LEGACY` ในขั้นอนุมัติ หากยังว่างและผ่านกฎช่วง `S/P0001–1999` และ `systemType` เดิม `ADD_PARAMETER` ยังแทนที่ snapshot ของจุดในคำขอและได้รับ ID ใหม่ แต่คงรหัสและการจองของจุดต้นทางที่เชื่อมต่ออยู่

ต้องติดตั้ง [migration 0126](../../../backend/src/db/migrations/0126_allow_unconnected_point_code_release.ts) พร้อม backend ที่ใช้ [cleanup helper](../../../backend/src/modules/connection-requests/connection-request-point-cleanup.ts) เพื่อให้ทะเบียนอนุญาตการลบที่ผ่านเงื่อนไข การแก้ไขแถวทะเบียนด้วย `UPDATE` ยังคงถูกปฏิเสธ การย้อน migration ไม่สามารถสร้างแถวที่ลบไปแล้วกลับคืน

## สคริปต์เฉพาะกรณี S0527

[cleanup-s0527-stale-reservation.sql](../../../backend/scripts/sql/cleanup-s0527-stale-reservation.sql) ตรวจและล้างเฉพาะรายการต่อไปนี้บน `W25-SVR1 / poms`:

| รายการ | เงื่อนไข |
| --- | --- |
| คำขอ `10037` | CEMS, ยังไม่ถูกลบ และอยู่ระหว่างตรวจแบบหรือรอแก้ไข |
| จุดเก่า `10041` | อยู่คำขอ `10037`, รหัส `S0527`, `OFFICER_DIRECT`, มี `deleted_at` |
| ทะเบียน `17` | จอง `S0527` ให้คำขอ `10037` และจุด `10041` แบบ `OFFICER_DIRECT` |
| จุดปัจจุบัน `10067` | อยู่คำขอเดียวกัน, active, รหัสและ assignment mode ยังว่าง; ต้องเก็บไว้ |

สคริปต์หยุดเมื่อพบ connected row ที่อ้างจุดหรือรหัสเดิม แม้เป็น connected row ที่ถูกลบแล้ว รวมถึง active connected point ที่ใช้รหัสเป็นชื่อ จุดคำขออื่นที่ยังใช้รหัส หรือ live device configuration ของรหัสนั้น ไม่ลบการตั้งค่าอุปกรณ์หรือข้อมูลตรวจวัดเพื่อให้การตรวจผ่าน

### วิธีรันผ่าน SSMS

1. เปิดแท็บคำสั่งใหม่ที่เชื่อมต่อฐานข้อมูลเป้าหมาย แล้ววางสคริปต์ทั้งไฟล์ ห้ามรันเฉพาะบางช่วง
2. คง `DECLARE @apply bit = 0;` แล้วรัน ต้องได้ `READY - no changes made` พร้อม ID ตรงตามตารางข้างต้น
3. เมื่อตรวจผลแล้ว เปลี่ยนเป็น `DECLARE @apply bit = 1;` และรันทั้งไฟล์อีกครั้ง การรันนี้ลบจุดเก่าและการจองรหัสถาวร
4. ต้องได้ `APPLIED - old point and reservation deleted; original trigger restored` แล้วตรวจด้วย `SELECT` ว่าจุด `10041` และทะเบียน `S0527` หายไป ส่วนจุด `10067` ยังอยู่ หากยังไม่ได้อนุมัติใหม่ รหัสของจุด `10067` ต้องยังว่าง
5. เจ้าหน้าที่สามารถกลับไปอนุมัติคำขอผ่าน flow ปกติ โดยอ่านสถานะล่าสุดก่อนอนุมัติ และใช้ `measurementPointId: 10067` พร้อม `MANUAL_LEGACY` และ `pointCode: "S0527"` เมื่อคำขอพร้อมรับการอนุมัติ การล้างข้อมูลนี้ไม่ได้อนุมัติคำขอให้อัตโนมัติ

สคริปต์ใช้ table lock ระยะสั้นที่ทะเบียนรหัสและมี lock timeout 10 วินาที การล้างเฉพาะครั้งใช้ข้อยกเว้น trigger ที่รับเฉพาะรายการตามตารางข้างต้น และคืน trigger เดิมก่อน commit จึงใช้ได้ทั้งก่อนและหลัง migration 0126 โดยไม่ติดตั้ง backend ใหม่หรือเปลี่ยนกติกา trigger ถาวร หากคำสั่งใดล้มเหลว ระบบ rollback ทั้งข้อมูลและการเปลี่ยน trigger; อย่าปิดหรือถอด trigger เพื่อข้าม error

สคริปต์จะหยุดถ้าข้อมูลเปลี่ยนไปหรือเคยล้างสำเร็จแล้ว ไม่เปลี่ยน ID ในสคริปต์เพื่อนำไปล้างกรณีอื่นโดยไม่ได้ตรวจเจ้าของและการอ้างอิงใหม่

## การทดสอบและขอบเขตหลักฐาน

[repository regression](../../../backend/tests/unit/connection-requests.current-factory-profile.repository.test.ts) ใช้ฐานข้อมูลจำลองที่มี state ทดสอบการส่งแบบแก้ไขและอนุมัติโดยคงรหัส `S0527`, ID และเจ้าของการจองเดิม การสลับลำดับจุด การปฏิเสธรหัสปลอม/ตัวตนกำกวม/ทะเบียนไม่ตรง การลบเฉพาะจุดที่ตัดออก การคงการจองของเจ้าของอื่น และ rollback เมื่อคืนรหัสไม่ได้ ชุดทดสอบนี้ไม่ใช่การยืนยันว่า migration trigger รันสำเร็จบน SQL Server จริง

```bash
cd backend
npm run typecheck
npm test -- --runInBand tests/unit/connection-requests.current-factory-profile.repository.test.ts tests/unit/connection-requests.point-code-sequence.repository.test.ts tests/unit/connection-requests.resubmit.openapi.test.ts
```
