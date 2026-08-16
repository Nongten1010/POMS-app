# การแจ้งเตือน

> Owner: Backend

## Frontend Quick Start

เมนูนี้ใช้สำหรับดูรายการ `alert-events`, เปิดรายละเอียดรายเหตุการณ์ และอัปเดตสถานะการติดตามของเจ้าหน้าที่

หน้า interactive test ใช้ชุดเดียวกับ backend ที่ `/api/v1/docs` และ OpenAPI JSON อยู่ที่ `/api/v1/openapi.json`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/alert-events?page=1&pageSize=20' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน                     | Method  | Path                              | Auth   | Permission           |
| ----------------------- | ------- | --------------------------------- | ------ | -------------------- |
| รายการแจ้งเตือน         | `GET`   | `/api/v1/alert-events`            | Bearer | `notifications:view` |
| รายละเอียดแจ้งเตือน     | `GET`   | `/api/v1/alert-events/:id`        | Bearer | `notifications:view` |
| อัปเดตสถานะการแจ้งเตือน | `PATCH` | `/api/v1/alert-events/:id/status` | Bearer | `notifications:edit` |

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

- Routes: `backend/src/modules/alert-events/alert-events.routes.ts`
- Controller: `backend/src/modules/alert-events/alert-events.controller.ts`
- Validator: `backend/src/modules/alert-events/alert-events.validator.ts`
- OpenAPI: `backend/src/modules/api-docs/poms.openapi.ts`
