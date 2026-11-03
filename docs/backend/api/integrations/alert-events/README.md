# ประวัติรับข้อมูลแจ้งเตือนจากระบบภายนอก

[กลับไป Integration API Index](../README.md) · [การแจ้งเตือนใน POMS](../../menus/notifications/README.md)

`POST /api/v1/integrations/alert-events` ใช้แบบ `STORE_ONLY`: ระบบภายนอกส่งเข้าที่ URL และ API key เดิมได้ Backend เก็บ JSON เป็นประวัติรับเข้าใน `integration_alert_receipts` แล้วตอบ `200 OK` โดยไม่สร้าง `alert_events`, ไม่แสดงในหน้าแจ้งเตือน, ไม่เข้าคิวหรือส่งอีเมล และไม่ใช้ข้อมูลนี้แก้ไขหรือกันซ้ำกับผลของ [ตัวตรวจค่าเกินภายใน](../../../guides/hourly-exceedance-detector.md)

รายการแจ้งเตือนใหม่ของ POMS มาจากตัวตรวจภายในที่เปิด `active` ซึ่งอ่านข้อมูลตรวจวัด `60m` และเกณฑ์ที่ลงทะเบียนไว้ การเปลี่ยน endpoint นี้ไม่เปลี่ยนวิธีนำเข้าค่าตรวจวัดต้นทาง ไม่ลบประวัติ alert/อีเมลเดิม และไม่ยกเลิกคิวอีเมลเดิมที่สร้างไว้แล้ว

## Quick Start

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/integrations/alert-events' \
  --header 'X-API-Key: <ALERT_EVENT_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"events":[{"systemType":"CEMS","stationId":"S0001","parameterCode":"so2","unit":"ppm","eventDate":"2026-11-03","time":"11:00","measuredValue":125,"thresholdValue":120,"thresholdType":"STANDARD"}]}'
```

## `POST /api/v1/integrations/alert-events`

### Authentication และขอบเขต

ใช้ header `X-API-Key` จาก `ALERT_EVENT_API_KEYS`; ถ้า scoped-key list ว่าง fallback ไป `INTEGRATION_API_KEYS` ตามเดิม ไม่บันทึก key หรือ request headers ในประวัติรับเข้า ไม่ต้องมี connected measurement point เพื่อเก็บ receipt และไม่มี endpoint ใหม่สำหรับเปิดอ่าน archive ผ่านหน้าแจ้งเตือน

### Request fields

| Field | Location | Type | Required | ความหมาย |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | string | Yes | integration key เดิม |
| `events` | body | object[] | Yes | JSON objects 1–500 รายการ |
| field อื่นที่ root | body | JSON value | No | เก็บพร้อม payload โดยไม่ตีความ |
| field ภายใน `events[]` | body | JSON value | No | เก็บตามที่รับมา ไม่บังคับ field ทางธุรกิจ |

field เดิม เช่น `systemType`, `stationId`, `pointCode`, `parameterCode`, `unit`, `eventDate`, `time`, `measuredValue`, `thresholdValue` และ `thresholdType` ส่งได้ตามเดิม รวม field เพิ่มเติม Numeric strings และหน่วยคงค่าต้นฉบับ ไม่แปลงตัวเลข/ชื่อพารามิเตอร์ ไม่ตรวจวันที่ ชั่วโมง สถานะจุด หรือว่าเกินเกณฑ์จริง จึงรับทั้งค่าต่ำกว่า เท่ากับ และเกินเกณฑ์เพื่อเก็บประวัติได้

เก็บ JSON values ไม่ใช่ whitespace/รูปแบบไบต์ของ HTTP ต้นฉบับ ขนาด HTTP body ใช้ขีดจำกัด JSON เดิมของระบบ

### Request example

```json
{"events":[{"systemType":"WPMS","stationId":"P0260","parameterCode":"bod","unit":"mg/l","measuredValue":"27.00","thresholdValue":27,"thresholdType":"STANDARD"}]}
```

### Response fields

| Field | Type | Nullable | ความหมาย |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` หลังบันทึก batch สำเร็จ |
| `data.mode` | `STORE_ONLY` | No | เก็บข้อมูลอย่างเดียว |
| `data.receiptId` | UUID string | No | ID ประวัติรับเข้าของ batch ไม่ใช่ alert event ID |
| `data.receivedAt` | ISO datetime | No | เวลารับเข้า UTC |
| `data.total` | integer | No | จำนวน JSON objects ที่รับ |
| `data.stored` | integer | No | จำนวนที่เก็บสำเร็จ เท่ากับ `total` |
| `data.created` | integer | No | `0` เสมอ: ไม่สร้าง alert |
| `data.duplicate` | integer | No | `0` เสมอ: ไม่ค้นหาหรือใช้ identity ของ alert |
| `data.failed` | integer | No | `0` ในคำตอบสำเร็จ; batch บันทึกด้วย INSERT เดียว |
| `data.results` | object[] | No | ผลเรียงตาม index ของ `events` |
| `data.results[].index` | integer | No | index เริ่ม 0 |
| `data.results[].success` | boolean | No | `true` |
| `data.results[].created` | boolean | No | `false` |
| `data.results[].duplicate` | boolean | No | `false` |
| `data.results[].event` | null | Yes | `null` เสมอ ไม่สร้างหรือค้น event |

### Response example

```json
{
  "success": true,
  "data": {
    "mode": "STORE_ONLY",
    "receiptId": "53d1d6a8-3742-428c-b57b-ceab4de998b1",
    "receivedAt": "2026-11-03T10:30:00.000Z",
    "total": 1,
    "stored": 1,
    "created": 0,
    "duplicate": 0,
    "failed": 0,
    "results": [{"index": 0,"success": true,"created": false,"duplicate": false,"event": null}]
  }
}
```

ส่งซ้ำเก็บเป็น receipt ใหม่แต่ละ request ไม่มีการแจ้งเตือนหรืออีเมลซ้ำเพราะ archive ไม่ถูกอ่านโดย detector หรือ email worker และไม่ใช้ receipt เป็นหลักฐาน config/threshold

### Errors และ migration ของ client

ใช้ [shared error envelope](../../shared/README.md): `401` เมื่อ key ไม่ผ่าน, `400 VALIDATION_ERROR` เมื่อไม่มี `events`, ไม่ใช่ array, มีสมาชิกที่ไม่ใช่ object หรือจำนวนอยู่นอก 1–500; JSON เสีย/HTTP body เกินขนาดใช้ middleware เดิม หากบันทึกฐานข้อมูลไม่ได้ตอบ `500 INTERNAL_ERROR` โดยไม่เปิดเผย payload/SQL และไม่ตอบสำเร็จก่อนบันทึก

พฤติกรรมและ response เปลี่ยนจากการสร้าง event: client ที่ใช้ `event.id` ต้องเลิกใช้และอ่าน `data.receiptId` แทน; การรับสำเร็จดู `success=true`, `mode=STORE_ONLY`, `stored=total` อย่าใช้ `created` เป็นจำนวนข้อมูลที่รับ ดู [breaking change](../../CHANGELOG.md#integration-alert-receipts-only)

## สำหรับผู้ดูแล Backend

- Route/auth เดิม: [integrations.routes.ts](../../../../../backend/src/modules/integrations/integrations.routes.ts), [integration-api-key.middleware.ts](../../../../../backend/src/modules/integrations/integration-api-key.middleware.ts)
- Controller: [alert-events.controller.ts](../../../../../backend/src/modules/alert-events/alert-events.controller.ts)
- Boundary/schema/persistence: [integration-alert-receipts.ts](../../../../../backend/src/modules/integrations/integration-alert-receipts.ts)
- Migration: [0156_create_integration_alert_receipts.ts](../../../../../backend/src/db/migrations/0156_create_integration_alert_receipts.ts) เพิ่มตารางเดียวและ index ตาม received time ไม่แก้ alert/source/outbox
- Tests HTTP + SQL fixture: [integration-alert-receipts.test.ts](../../../../../backend/tests/unit/integration-alert-receipts.test.ts); [migration](../../../../../backend/tests/unit/integration-alert-receipts.migration.test.ts); [runtime OpenAPI](../../../../../backend/tests/unit/alert-events.exceedance.openapi.test.ts)
- Runtime contract: [poms.openapi.ts](../../../../../backend/src/modules/api-docs/poms.openapi.ts)
