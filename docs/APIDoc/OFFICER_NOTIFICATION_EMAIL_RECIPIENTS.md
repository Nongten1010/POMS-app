# Officer Notification Email Recipients API

Admin API สำหรับจัดการอีเมลเจ้าหน้าที่ที่ระบบใช้แนบกับโรงงานในคำขอเชื่อมต่อ CEMS/WPMS

Base path:

```text
/api/v1/officer-notification-email-recipients
```

ทุก endpoint ต้อง login และมี permission `notifications:edit`

## โครงสร้างข้อมูล

ฐานข้อมูลใช้ตาราง `officer_notification_email_recipients` โดยเก็บอีเมลหลายรายการใน `emails_json` เป็น JSON array จึงไม่ต้องเพิ่ม migration สำหรับการรองรับหลายอีเมล

```json
{
  "id": 1,
  "recipientType": "PROVINCE",
  "provinceName": "เชียงใหม่",
  "emails": ["first@example.com", "second@example.com"],
  "isActive": true,
  "createdAt": "2026-07-13T00:00:00.000Z",
  "updatedAt": "2026-07-13T00:00:00.000Z"
}
```

`recipientType` มีสองค่า:

- `PROVINCE`: ต้องมี `provinceName`
- `INDUSTRIAL_ESTATE`: ต้องส่ง `provinceName: null`

## GET `/`

อ่านรายการ recipient ทั้งหมดที่ยังไม่ถูกลบ พร้อม `emails` แบบ array เพื่อให้หน้า admin แสดงและเลือกแก้ไขได้

Response `200 OK`:

```json
{
  "success": true,
  "data": [{ "id": 1, "recipientType": "PROVINCE", "provinceName": "เชียงใหม่", "emails": ["first@example.com", "second@example.com"], "isActive": true }],
  "meta": { "total": 1 }
}
```

## POST `/`

สร้าง recipient ใหม่พร้อมอีเมลอย่างน้อยหนึ่งรายการ

Request:

```json
{
  "recipientType": "PROVINCE",
  "provinceName": "เชียงใหม่",
  "emails": ["first@example.com", "second@example.com"]
}
```

Response: `201 Created` พร้อม `Location: /api/v1/officer-notification-email-recipients/:id`

## POST `/:id/emails`

เพิ่มอีเมลหนึ่งรายการเข้า recipient เดิมโดยไม่แทนที่อีเมลเก่า เหมาะกับปุ่ม “เพิ่มอีเมล” ของหน้า admin

Request:

```json
{ "email": "second@example.com" }
```

Response `200 OK` คืน recipient ที่มีรายการ `emails` ล่าสุด

ระบบ normalize อีเมลเป็นตัวพิมพ์เล็กและไม่เพิ่มซ้ำ หากส่งอีเมลเดิมซ้ำ จะคืนรายการเดิมแบบ idempotent

การเพิ่มอีเมลทำใน database transaction พร้อมล็อก recipient แถวนั้น จึงไม่ทำให้อีเมลของอีก request หายเมื่อผู้ดูแลเพิ่มอีเมลพร้อมกัน

## Validation

- ทุกอีเมลต้องเป็น email ที่ถูกต้องและยาวไม่เกิน 255 ตัวอักษร
- ตอนสร้าง รองรับสูงสุด 20 อีเมลต่อ recipient
- `emails` ตอนสร้างต้องมีอย่างน้อย 1 ค่า
- หาก recipient ไม่พบตอนเพิ่มอีเมล จะตอบ `404 NOT_FOUND`
- หากสร้าง recipient ซ้ำกับจังหวัด/ประเภทที่มีอยู่แล้ว จะตอบ `409 CONFLICT`; ให้เรียก `POST /:id/emails` กับรายการเดิมแทน
- รูปแบบ payload ผิด จะตอบ `400 VALIDATION_ERROR`

## การใช้งานกับคำขอเชื่อมต่อ

ระบบ connection requests อ่าน `emails_json` แล้วส่งเป็น `officerNotificationEmails: string[]` ตามจังหวัด หรือใช้ recipient ประเภท `INDUSTRIAL_ESTATE` สำหรับโรงงานในนิคมอุตสาหกรรม
