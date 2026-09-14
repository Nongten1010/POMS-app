# การเปลี่ยนแปลง Frontend: กฎหมายที่เกี่ยวข้อง

เอกสารนี้บันทึกพฤติกรรมและความต้องการของ frontend เพื่อส่งต่อให้ backend ปรับรองรับ ไม่ใช่สำเนา API contract และไม่ได้ยืนยันว่า backend หรือ production รองรับค่าใหม่แล้ว

API contract ที่ดูแลโดย backend: [เมนูกฎหมายที่เกี่ยวข้อง](../../docs/backend/api/menus/laws/README.md)

## ขอบเขตที่เปลี่ยน

- Dialog เพิ่มและแก้ไขรายการกฎหมายใช้ตัวเลือกประเภทใหม่ทั้ง 5 รายการตามลำดับด้านล่าง
- คงการตรวจไฟล์ PDF ที่มีอยู่เดิม และเพิ่มการทดสอบเงื่อนไขนี้
- ปุ่มดาวน์โหลดทั้ง desktop และ mobile คงข้อความ ไอคอน และรูปแบบเดิม แต่เปิด URL ในแท็บใหม่ของ browser แทนการบังคับดาวน์โหลด
- ไม่เปลี่ยนหมวดหมู่ การค้นหา การเรียงรายการ วันที่ สิทธิ์ผู้ใช้ หรือขั้นตอนลบ
- ไม่มีการแก้ backend หรือย้ายประเภทของข้อมูลเก่าในฐานข้อมูล

## ตัวเลือกประเภทที่ Frontend ใช้

| ลำดับ | ข้อความ | ค่า `type` ที่ส่งตอนบันทึก |
| --- | --- | --- |
| 1 | กฎกระทรวงอุตสาหกรรม | `MINISTERIAL_REGULATION` |
| 2 | ประกาศกระทรวงอุตสาหกรรม | `MINISTRY_ANNOUNCEMENT` |
| 3 | ประกาศกรมโรงงานอุตสาหกรรม | `DEPARTMENT_ANNOUNCEMENT` |
| 4 | ระเบียบ ข้อบังคับ และข้อกำหนด | `REGULATION_REQUIREMENT` |
| 5 | อื่นๆ | `OTHER` |

`MINISTRY_ANNOUNCEMENT` และ `DEPARTMENT_ANNOUNCEMENT` เป็นค่าที่ frontend เพิ่มในรอบนี้ เพื่อให้ backend ปรับรองรับโดยแยกสองประเภทออกจากกัน

การจัดการค่าเดิมใน frontend:

- `MINISTERIAL_REGULATION` คง value เดิม แต่แสดงข้อความใหม่ตามตาราง ไม่เขียนเปลี่ยน record อัตโนมัติ
- ถอด `RULE_AND_ANNOUNCEMENT` ออกจาก dropdown ทั้งเพิ่มและแก้ไข
- รายการเก่าที่มีประเภทนอกชุดใหม่ยังแสดง `typeLabel` จาก response ได้ หากไม่มี label จะแสดงค่า `type`
- เมื่อเปิดแก้ไขรายการที่มีประเภทนอกชุดใหม่ ช่องประเภทจะว่างและต้องเลือกค่าใหม่ก่อนบันทึก ไม่จับคู่เป็นประกาศกระทรวงหรือประกาศกรมโดยอัตโนมัติ
- สำหรับค่าที่อยู่ในชุดใหม่ frontend ใช้ label ตามตาราง แม้ response จะคืน `typeLabel` เก่า
- การเปลี่ยนประเภทของข้อมูลเก่าในฐานข้อมูลยังไม่มีข้อสรุปในงานนี้

## ข้อมูลที่ส่งตอนเพิ่มและแก้ไข

Frontend ยังคงใช้ `POST /api/v1/laws` และ `PUT /api/v1/laws/:id` โดยส่ง `FormData` แบบ `multipart/form-data` พร้อม Bearer token ตามเดิม ไม่ได้เปลี่ยนเป็น JSON

ตัวอย่าง field ส่วนข้อความของ FormData สำหรับประเภทใหม่ (JSON ด้านล่างใช้แสดงค่าเท่านั้น ไม่ใช่ request body จริง):

```json
{
  "title": "ตัวอย่างประกาศกระทรวงอุตสาหกรรม",
  "category": "CEMS",
  "type": "MINISTRY_ANNOUNCEMENT",
  "publishedDate": "2026-09-14"
}
```

- `type`: หนึ่งใน 5 ค่าตามตาราง โดยประกาศกรมใช้ `DEPARTMENT_ANNOUNCEMENT`
- `category`: คง `CEMS`, `WPMS`, `OTHER` ตามเดิม
- `publishedDate`: คงรูปแบบ `YYYY-MM-DD` ปี ค.ศ. ใน request แม้ UI ใช้ปี พ.ศ.
- `file`: binary PDF ใน multipart เพิ่มรายการใหม่ต้องแนบไฟล์; แก้ไขรายการแนบเฉพาะเมื่อเลือกไฟล์ใหม่ หากไม่เลือกจะไม่ส่ง field นี้และใช้ไฟล์เดิม
- การตอบกลับรายการหลังบันทึกและการโหลดรายการยังใช้โครงสร้างเดิม; frontend ต้องอ่าน `type` ใหม่ทั้งสองค่าได้

## ไฟล์ PDF

Frontend มีเงื่อนไขเดิมดังนี้ และรอบนี้ทดสอบยืนยันไว้:

- File picker ใช้ `accept="application/pdf,.pdf"`
- ก่อนส่งตรวจ MIME เป็น `application/pdf` และนามสกุล `.pdf` โดยไม่แยกตัวพิมพ์เล็ก/ใหญ่
- ขนาดไฟล์ต้องมากกว่า 0 และไม่เกิน 10 MB (10,485,760 bytes)
- ตรวจทั้งการเพิ่มรายการและการเปลี่ยนไฟล์ในรายการเดิม
- เป็นการตรวจ metadata ฝั่ง browser ไม่ใช่การตรวจเนื้อหา binary ของ PDF

## การเปิดเอกสารในแท็บใหม่

- ใช้ `file.downloadUrl` จากรายการที่โหลดผ่าน `GET /api/v1/laws` เหมือนเดิม ไม่เพิ่ม API สำหรับ view ใน frontend รอบนี้
- ปุ่มเดิมใช้ลิงก์ `target="_blank"` และ `rel="noopener noreferrer"` โดยถอด attribute `download` ออก
- ถ้าไม่มี URL ปุ่มยังคงกดไม่ได้
- Frontend ต้องการให้ URL เปิดแสดง PDF ได้ผ่านการนำทางของ browser ซึ่งไม่ได้แนบ Bearer header จาก fetch ของแอป
- การแสดง PDF จริงขึ้นกับ response ของ URL และการตั้งค่า browser ด้วย หาก response บังคับ `Content-Disposition: attachment` browser อาจดาวน์โหลดแทนการแสดง แม้เปิดแท็บใหม่แล้ว
- การจัดเตรียม URL การเข้าถึงไฟล์ และ response headers เป็นส่วนที่ backend ต้องพิจารณาให้รองรับความต้องการ view โดยเอกสารนี้ไม่ได้กำหนดให้สร้าง endpoint ใหม่

## ไฟล์ Frontend ที่เกี่ยวข้อง

- [LawsPage.jsx](../src/pages/LawsPage.jsx): ตัวเลือกประเภท การตรวจค่าก่อนบันทึก และลิงก์เปิดเอกสาร
- [laws.integration.test.mjs](../src/utils/laws.integration.test.mjs): ทดสอบประเภทใน dialog เพิ่ม/แก้ไข ค่าใน FormData ค่าเก่า เงื่อนไข PDF และลิงก์ desktop/mobile

การทดสอบรอบนี้เป็น automated tests ฝั่ง frontend ไม่ได้สร้างหรือแก้ไขข้อมูลบน production และไม่ได้ทดสอบ response ของ backend สำหรับประเภทใหม่
