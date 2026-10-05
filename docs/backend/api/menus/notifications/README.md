# การแจ้งเตือน

> Owner: Backend

## Frontend Quick Start

เมนูนี้ใช้สำหรับดูรายการ `alert-events`, เปิดรายละเอียดรายเหตุการณ์ อัปเดตสถานะการติดตามของเจ้าหน้าที่ และตรวจตัวอย่าง/ผลการส่งอีเมลแจ้งเตือน

หน้า interactive test ใช้ชุดเดียวกับ backend ที่ `/api/v1/docs` และ OpenAPI JSON อยู่ที่ `/api/v1/openapi.json`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/alert-events?page=1&pageSize=20' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

ดูตัวอย่างอีเมลโดยเลือกเหตุการณ์ที่มีสิทธิ์เข้าถึงและเป็นประเภทเดียวกัน:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/alert-email-previews' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"eventIds":[1001],"scheduledAt":"2026-10-05T12:05:00+07:00"}'
```

## Endpoint Summary

| งาน                     | Method  | Path                              | Auth   | Permission           |
| ----------------------- | ------- | --------------------------------- | ------ | -------------------- |
| รายการแจ้งเตือน         | `GET`   | `/api/v1/alert-events`            | Bearer | `notifications:view` |
| รายละเอียดแจ้งเตือน     | `GET`   | `/api/v1/alert-events/:id`        | Bearer | `notifications:view` |
| อัปเดตสถานะการแจ้งเตือน | `PATCH` | `/api/v1/alert-events/:id/status` | Bearer | `notifications:edit` |
| ตัวอย่างอีเมลแจ้งเตือน | `POST` | `/api/v1/alert-email-previews` | Bearer | `notifications:edit` |
| ผลการส่งอีเมล | `GET` | `/api/v1/alert-email-deliveries/:id` | Bearer | `notifications:view_status` |

ดู request/response, validation และ scope ของสอง endpoint อีเมลที่ [อีเมลแจ้งเตือนมลพิษ](./email-notifications.md)

## Contract Notes

- Query หลักของ `GET /api/v1/alert-events` คือ `systemType`, `displaySystemType`, `alertType`, `thresholdType`, `factoryId`, `stationId`, `parameterCode`, `dateFrom`, `dateTo`, `page`, `pageSize`
- `alertType` รองรับ `STANDARD_EXCEEDED`, `EIA_EXCEEDED`, `DAILY_COMPLETENESS_LOW`, `CONSECUTIVE_NO_REPORT`, `ABNORMAL_VALUE`
- `page` เป็น integer ขั้นต่ำ 1 ค่าเริ่มต้น 1; `pageSize` อยู่ในช่วง 1-100 ค่าเริ่มต้น 20
- `dateFrom`/`dateTo` ใช้ `YYYY-MM-DD`; `stationId` และ `parameterCode` ต้องเป็น safe code หรือ annual monitoring point code ตาม validator
- `dateTo` ต้องไม่น้อยกว่า `dateFrom`
- `PATCH /api/v1/alert-events/:id/status` รับ payload:

```json
{
  "notificationStatus": "ACKNOWLEDGED",
  "note": "รับทราบแล้ว"
}
```

- `notificationStatus` ต้องเป็น `AUTO`, `OFFICER`, `ACKNOWLEDGED` หรือ `DISMISSED`; `note` เป็น optional string ยาวได้ไม่เกิน 1000 ตัวอักษร

ตัวอย่าง response:

```json
{
  "success": true,
  "data": {
    "id": 51,
    "notificationStatus": "ACKNOWLEDGED"
  }
}
```

## Maintainer Links

- [คู่มือรอบอีเมล ผู้รับ และ SMTP](../../../guides/alert-email-operations.md)
- [TDD evidence อีเมลแจ้งเตือน](../../../evidence/notifications/alert-email.tdd.md)

- Routes: `backend/src/modules/alert-events/alert-events.routes.ts`
- Controller: `backend/src/modules/alert-events/alert-events.controller.ts`
- Validator: `backend/src/modules/alert-events/alert-events.validator.ts`
- OpenAPI: `backend/src/modules/api-docs/poms.openapi.ts`
