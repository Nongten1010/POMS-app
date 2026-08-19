# ผู้รับอีเมลแจ้งเตือน

> Owner: Backend

## Frontend Quick Start

ชุด API นี้ใช้จัดการปลายทางอีเมลของเจ้าหน้าที่สำหรับ notification workflow

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/officer-notification-email-recipients' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน               | Method | Path                                                       | Auth   | Permission           |
| ----------------- | ------ | ---------------------------------------------------------- | ------ | -------------------- |
| รายการกลุ่มผู้รับ | `GET`  | `/api/v1/officer-notification-email-recipients`            | Bearer | `notifications:edit` |
| สร้างกลุ่มผู้รับ  | `POST` | `/api/v1/officer-notification-email-recipients`            | Bearer | `notifications:edit` |
| เพิ่มอีเมลในกลุ่ม | `POST` | `/api/v1/officer-notification-email-recipients/:id/emails` | Bearer | `notifications:edit` |

## Payload And Validation

`POST /api/v1/officer-notification-email-recipients`

```json
{
  "recipientType": "PROVINCE",
  "provinceName": "ชลบุรี",
  "emails": ["officer@example.com"]
}
```

- `recipientType`: required enum จาก `OFFICER_NOTIFICATION_RECIPIENT_TYPES`
- `provinceName`: optional nullable string 1-128
- `emails`: required array, 1-20 รายการ, แต่ละรายการต้องเป็น email ที่ถูกต้องและยาวไม่เกิน 255
- ถ้า `recipientType=PROVINCE` ต้องมี `provinceName`
- ถ้า `recipientType=INDUSTRIAL_ESTATE` ห้ามส่ง `provinceName`
- ระบบ normalize email เป็น lowercase และตัดค่าซ้ำ

## รายชื่อกลางที่ระบบกำหนด

- โรงงานใน `กรุงเทพมหานคร` ใช้ `SARABAN@DIW.MAIL.GO.TH`
- โรงงานในนิคมอุตสาหกรรมใช้ `warroom.emcc@ieat.go.th`
- โรงงานนอกนิคมอุตสาหกรรมใช้รายชื่อสำนักงานอุตสาหกรรมจังหวัดตาม `provinceName`
- Migration `0097_correct_officer_notification_email_recipients` แทนที่รายชื่อการนิคมฯ เดิม
  เพิ่มรายชื่อกรุงเทพมหานคร และนำ `second@example.com` ซึ่งเป็นข้อมูลทดสอบออกจากรายชื่อ active

ตัวอย่าง response เมื่อสร้างสำเร็จ:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "recipientType": "PROVINCE",
    "provinceName": "ชลบุรี",
    "emails": ["officer@example.com"]
  }
}
```

`POST /api/v1/officer-notification-email-recipients/:id/emails`

```json
{
  "email": "new.officer@example.com"
}
```

- `id`: path param ต้องเป็น integer บวก
- `email`: required email, lowercase ที่ runtime transform

## Maintainer Links

- Routes: `backend/src/modules/officer-notification-email-recipients/officer-notification-email-recipients.routes.ts`
- Controller: `backend/src/modules/officer-notification-email-recipients/officer-notification-email-recipients.controller.ts`
- Validator: `backend/src/modules/officer-notification-email-recipients/officer-notification-email-recipients.validator.ts`
- OpenAPI: `backend/src/modules/api-docs/poms.openapi.ts`
