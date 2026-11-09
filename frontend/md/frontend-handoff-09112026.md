# Frontend: จัดการผู้มีสิทธิ์ในโรงงานที่เข้าข่าย

เอกสารส่งต่องาน Frontend ไม่ใช่ API contract ที่ Backend ยืนยันแล้ว อ้างอิง [แผนล่าสุดในสาขา docs/operator-eligible-factory-access-plan](https://github.com/Nongten1010/POMS-app/blob/docs/operator-eligible-factory-access-plan/docs/backend/guides/operator-eligible-factory-access-plan.md) ส่วนสัญญา API ที่เผยแพร่จริงให้ดูจาก [ศูนย์เอกสาร Backend](../../docs/backend/README.md)

## เงื่อนไขที่ผู้ใช้ยืนยัน

- จัดการในตารางเดิมของเมนูย่อย **โรงงานที่เข้าข่าย** ไม่เพิ่มเมนูย่อยใหม่
- แอดมินเท่านั้นที่เพิ่ม/ยกเลิกการผูกได้ ไม่อนุญาตเจ้าหน้าที่ทั่วไปหรือ director แม้มี `eligible_factories.edit`
- ผู้ประกอบการต้องเคย login ผ่าน i-industry มาก่อน
- รองรับหลายบัญชีต่อโรงงาน และหลายโรงงานต่อบัญชี
- สิทธิ์รายโรงงานครอบคลุมทุกธุรกรรมเหมือนสิทธิ์ i-industry แต่ไม่ข้าม permission/action validation เดิม
- เหตุผลเพิ่ม/ยกเลิกมีช่องให้กรอก แต่ **ไม่บังคับ** เว้นว่างส่งโดยไม่ใส่ field `reason`
- การสิ้นสุดสิทธิ์ตามสถานะโรงงานให้ยึด MD แผนล่าสุด ไม่ใช่คงสิทธิ์จน i-industry ส่งโรงงานให้เสมอ

## สิ่งที่แก้ Frontend แล้ว

1. ส่ง `roleCodes` จาก App ให้หน้า EligibleFactoriesPage ตรวจ admin โดย `userType=admin` หรือมี role code `admin` พร้อม access token
2. เพิ่มไอคอน **จัดการผู้มีสิทธิ์** ในคอลัมน์ Option/จัดการเฉพาะตารางโรงงานที่เข้าข่าย ไม่แก้เงื่อนไขแก้ไข/นำออก/เลือกเข้าข่ายเดิม
3. แอดมินเปิด dialog ดูรายชื่อและประวัติได้ทุกสถานะ แม้ไม่มีสิทธิ์แก้รายละเอียดโรงงาน แต่ยังต้องมีสิทธิ์เข้าเมนูเดิม
4. ส่วนหัว dialog แสดงโรงงาน เลขทะเบียน สถานะ; tabs ผู้มีสิทธิ์/ประวัติ และปุ่มรีเฟรชแบบกดเอง ไม่มี polling
5. ตารางผู้มีสิทธิ์แสดงชื่อ เลขบัตรแบบปิดบัง สถานะ วันที่ผูก ผู้ให้สิทธิ์ และปุ่มยกเลิก
6. เพิ่มสิทธิ์ผ่าน dialog เลือกบัญชีที่ค้นหาจาก server พร้อมเหตุผล ไม่ต้องเลือกโรงงานซ้ำ ไม่เพิ่มผู้ใช้เอง และไม่แนบไฟล์หลักฐานในรอบนี้
7. ค้นหาเมื่อพิมพ์อย่างน้อย 2 ตัวอักษร หน่วง 350 ms ยกเลิก request เก่าและล้างตัวเลือกเมื่อคำค้นเปลี่ยน
8. ยกเลิกสิทธิ์มี dialog ยืนยัน ชื่อบุคคล โรงงาน และเหตุผลที่ไม่บังคับ
9. เพิ่มได้เมื่อข้อมูลล่าสุดจาก API มีสถานะ `ยังไม่แจ้งประกอบ` และ `capabilities.canGrant=true` ไม่ยึดสถานะในแถวเดิมอย่างเดียว
10. ยกเลิกได้เมื่อรายการนั้น `canRevoke=true` รวมกรณีสถานะโรงงานเปลี่ยนแต่ Backend ยังอนุญาตให้เพิกถอน
11. หลังบันทึกโหลดข้อมูลและประวัติใหม่ ไม่เติมรายการสำเร็จเองจากการคาดเดา ไม่รับ HTTP 200 ที่ไม่มี success/data เป็นการบันทึกสำเร็จ
12. เมื่อบันทึกมีปัญหาให้ตรวจรายการใหม่ก่อนทำซ้ำ ไม่ retry POST อัตโนมัติ ป้องกันกดบันทึกซ้ำขณะรอ และปิด dialog ไม่ได้ระหว่างส่ง

## สถานะการเชื่อมต่อ

ยังไม่มี API contract จริงในแผน จึง **ปิดการเรียก API ใหม่โดยค่าเริ่มต้น** ผ่าน `VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED` (ต้องเป็น string `true` จึงเรียก)

ในสถานะปัจจุบัน แอดมินเปิด dialog ได้ แต่แสดงข้อความ “ระบบจัดการผู้มีสิทธิ์ยังไม่เปิดให้บริการ” และปิดปุ่มเพิ่ม ไม่มีข้อมูลจำลอง ไม่มีการให้สิทธิ์จริง และไม่ส่ง request ไป endpoint ที่ยังไม่ได้ยืนยัน

ก่อนเปิด flag ต้องให้ Backend เผยแพร่ contract จริงและตรวจ adapter ใน `src/utils/eligibleOperatorAccess.mjs` ให้ตรงก่อน ไม่ถือว่าชื่อเส้นทาง/field ด้านล่างถูกตกลงแล้ว

## ข้อมูลที่หน้าจอต้องใช้ และข้อเสนอ adapter

ทุก API ต้องตรวจ admin ที่ Backend ด้วย ฝั่ง UI ไม่ใช่ขอบเขตความปลอดภัย รหัสโรงงานในเส้นทางใช้ `eligible_factories.id` ไม่ใช่ FID/เลขทะเบียน และไม่เปลี่ยนความหมาย `ownedFactoryIds`

| การทำงาน | เส้นทางที่เตรียมใน adapter (ข้อเสนอ) | ข้อมูลที่ใช้ |
| --- | --- | --- |
| รายชื่อ/ประวัติ/สถานะล่าสุด | GET `/api/v1/eligible-factories/{eligibleFactoryId}/operator-access` | `factory.operationStatus`, `capabilities.canGrant`, `capabilities.grantUnavailableReason`, `items[]`, `history[]` |
| ค้นหาบัญชี | GET `.../operator-access/candidates?query=...` | `items[]`: `userId`, `name`, `citizenIdMasked`; เฉพาะบัญชีที่ยืนยันผ่าน provider แล้วและเลือกผูกได้ |
| เพิ่ม | POST `.../operator-access` | `{ userId, reason? }` ไม่มีเลขบัตรเต็มใน payload |
| ยกเลิก | POST `.../operator-access/{grantId}/revoke` | `{ reason? }` โดยว่างเป็น `{}` |

adapter เตรียมอ่าน envelope `{ success: true, data: ... }` และ error ตาม HTTP status; ทุก request ใช้ Bearer token

ข้อมูลรายการผูกที่ UI ใช้: `id`, `name`, `citizenIdMasked`, `status`, `grantedAt`, `grantedByName`, `canRevoke`

ข้อมูลประวัติที่ UI ใช้: `id`, `occurredAt`, `action`, `name`, `actorName`, `reason`

สถานะที่เตรียมแสดง: `active` มีสิทธิ์, `revoked` ยกเลิกสิทธิ์, `expired` สิ้นสุดสิทธิ์, `suspended` ระงับชั่วคราว

กิจกรรมที่เตรียมแสดง: `granted`, `revoked`, `expired`, `suspended` เวลาเป็น ISO datetime มี timezone แล้วแสดงเวลาไทย/ปี พ.ศ.

การเพิ่ม/ยกเลิกสำเร็จต้องส่ง `data` เช่น `{ id: 123 }` เพื่อยืนยันผล ก่อน UI โหลด snapshot ใหม่ ถ้า Backend ใช้ 204 หรือ envelope อื่นต้องแก้ adapter ตาม contract จริง

ปัจจุบัน UI ใช้ client pagination 10/25/50 สำหรับรายการผูกและประวัติ จึงต้องได้รายการครบ; ถ้า Backend แบ่งหน้า ให้เพิ่ม server pagination ฝั่ง Frontend ก่อนเปิดจริง ไม่ตัดข้อมูลเงียบ ๆ

ส่งเลขบัตรแบบปิดบัง เช่น `*********1234` ไม่จำเป็นต้องคืนเลขเต็ม หน้าจอปิดบังซ้ำเพื่อไม่แสดงเลขเต็มโดยผิดพลาด และไม่บันทึกข้อมูลนี้ใน localStorage หรือ console การค้นหาด้วยเลขบัตรผ่าน query ต้องตกลงเรื่อง masking access logs ก่อนเปิดจริง หรือเปลี่ยนเป็น search body ตาม contract ที่ Backend กำหนด

## ส่วนที่ยังไม่แก้ในรอบนี้

- ไม่แก้ Backend, login, `/auth/me`, การรวมสิทธิ์โรงงาน หรือระบบ sync Fac60k
- ไม่เพิ่มหรือจำลองสิทธิ์ธุรกรรมจาก browser ต้องใช้สิทธิ์จริงจาก Backend
- ต้องทดสอบ end-to-end หลัง API พร้อม รวม 0→1/2/3, สถานะต้นทางไม่สด, ผูกซ้ำ, เพิกถอนขณะใช้งาน token เดิม และผลต่อทุกเมนูธุรกรรม
- ไม่แก้งานหน้าแจ้งเตือนที่ค้างอยู่
