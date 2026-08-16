# เครื่องมือภายใน

> Owner: Backend

## Overview

กลุ่มนี้เป็น internal-only endpoints สำหรับช่วยทดสอบระบบ ไม่ใช่ public integration contract

## Endpoints

| งาน           | Method | Path                      | Auth   | Permission         |
| ------------- | ------ | ------------------------- | ------ | ------------------ |
| ส่งอีเมลทดสอบ | `POST` | `/api/v1/email-test/send` | Bearer | authenticated user |

## Request Contract

Payload ของ `POST /api/v1/email-test/send`

```json
{
  "subject": "POMS test",
  "message": "hello"
}
```

Validation:

- `subject`: optional, string, trim แล้วต้องยาว 1-120 ถ้าส่งมา
- `message`: optional, string, trim แล้วต้องยาว 1-1000 ถ้าส่งมา
- schema เป็น `.strict()` จึงไม่รับ field แปลกเพิ่ม

## Maintainer Links

- Routes: `backend/src/modules/email-test/email-test.routes.ts`
- Controller: `backend/src/modules/email-test/email-test.controller.ts`
- Validator: `backend/src/modules/email-test/email-test.validator.ts`
- OpenAPI: `backend/src/modules/api-docs/poms.openapi.ts`
