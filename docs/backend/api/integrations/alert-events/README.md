# Integration Alert Events

[กลับไป Integration API Index](../README.md)

API สำหรับ Worker หรือระบบภายนอกส่งเหตุการณ์ค่ารายชั่วโมงที่เกินเกณฑ์เข้าสู่ POMS แบบ batch โดย backend ตรวจ API key, ตรวจว่า `measuredValue > thresholdValue`, ผูกจุดตรวจวัดกับโรงงานที่เชื่อมต่อแล้ว และสร้างช่วงเต็มชั่วโมงให้เอง

ระบบต้นทางเป็นผู้ตรวจข้อมูลรายชั่วโมงและเลือกเกณฑ์กับหน่วยให้ตรงกับพารามิเตอร์ Endpoint นี้ตรวจความสัมพันธ์ของตัวเลขที่ส่งมา แต่ยังไม่ได้ยืนยัน `thresholdValue` กับเกณฑ์ใน registered config หรืออ่านข้อมูลตรวจวัดดิบมาสร้างเหตุการณ์เอง

## Quick Start

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/integrations/alert-events' \
  --header 'X-API-Key: <ALERT_EVENT_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "events": [
      {
        "systemType": "CEMS",
        "stationId": "S0001",
        "pointCode": "S0001",
        "parameterCode": "so2",
        "unit": "ppm",
        "eventDate": "2026-03-02",
        "time": "20:00",
        "measuredValue": 150,
        "thresholdValue": 60,
        "thresholdType": "STANDARD"
      }
    ]
  }'
```

ใช้ key จาก `ALERT_EVENT_API_KEYS` สำหรับ endpoint นี้ หาก deployment เดิมยังไม่ได้กำหนด scoped key ระบบ fallback ไปอ่าน `INTEGRATION_API_KEYS` ชั่วคราว ห้ามเก็บ key จริงใน source code เอกสาร หรือ log

## `POST /api/v1/integrations/alert-events`

รับเหตุการณ์ตั้งแต่ 1 ถึง 500 รายการและตอบ `200 OK` พร้อมผลลัพธ์ของแต่ละรายการ การสร้างสำเร็จและรายการซ้ำสามารถอยู่ใน batch เดียวกันได้ Backend validate ทั้ง `events[]` ก่อนเรียก service หรือเขียนฐานข้อมูล หากมีรายการใดไม่ผ่าน validation จะตอบ `400 VALIDATION_ERROR` และไม่มีรายการใน batch นั้นถูกบันทึก

### Authentication And Permission

- Authentication: required ผ่าน header `X-API-Key`
- Permission: alert-event integration key
- Data scope: จุดตรวจวัด active ใน `cems_wpms_connected_measurement_points`

### Request Fields

#### Request Root

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | string | Yes | key ใน `ALERT_EVENT_API_KEYS`; fallback เป็น `INTEGRATION_API_KEYS` เมื่อ scoped-key list ว่าง |
| `events` | body | object[] | Yes | รายการแจ้งเตือน 1-500 รายการ |

#### `events[]`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `systemType` | `CEMS` \| `WPMS` | Yes | ระบบต้นทาง; BOD/COD Online ใช้ `WPMS` |
| `stationId` | string | Yes | รหัสจุดตรวจวัดที่ต้องตรงกับ active connected measurement point |
| `pointCode` | string \| null | No | รหัสจุดตรวจวัด; เมื่อไม่ส่ง backend ใช้ `stationId` สำหรับค้นหา |
| `parameterCode` | string | Yes | รหัสพารามิเตอร์ เช่น `so2`, `nox`, `cod` หรือ `bod`; backend normalize เป็น lowercase |
| `unit` | string | Yes | หน่วยของค่าตรวจวัด เช่น `ppm` หรือ `mg/l` |
| `eventDate` | string | Yes | วันที่ของชั่วโมงที่ตรวจพบ รูปแบบ `YYYY-MM-DD` และต้องเป็นวันที่มีอยู่จริงในปฏิทิน |
| `time` | string | Yes | เวลาเริ่มชั่วโมง รูปแบบ `HH:00` ตั้งแต่ `00:00` ถึง `23:00` |
| `measuredValue` | number \| numeric string | Yes | ค่ารายชั่วโมงที่ตรวจวัดได้ ต้องเป็น finite number และมากกว่า `thresholdValue`; numeric string ที่ไม่ว่างแปลงเป็น number ก่อนตรวจ |
| `thresholdValue` | number \| numeric string | Yes | ค่าเกณฑ์ที่ใช้เปรียบเทียบ หน่วยเดียวกับ `unit` ต้องเป็น finite number; numeric string ที่ไม่ว่างแปลงเป็น number ก่อนตรวจ |
| `thresholdType` | `STANDARD` \| `EIA` | Yes | ประเภทเกณฑ์ที่ค่าเกิน |

`startTime` และ `endTime` ไม่อยู่ใน contract ปัจจุบันและจะถูกปฏิเสธ เพราะ request ใช้ strict schema

### Request Example

```json
{
  "events": [
    {
      "systemType": "WPMS",
      "stationId": "WEMS-0003/2571",
      "pointCode": "WEMS-0003/2571",
      "parameterCode": "cod",
      "unit": "mg/l",
      "eventDate": "2026-03-02",
      "time": "23:00",
      "measuredValue": 125,
      "thresholdValue": 120,
      "thresholdType": "EIA"
    }
  ]
}
```

### Success Response Fields

#### Response Root

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อ request-level validation ผ่านและประมวลผล batch แล้ว |
| `data.total` | number | No | จำนวนรายการทั้งหมดใน `events` |
| `data.created` | number | No | จำนวนรายการที่สร้างใหม่ |
| `data.duplicate` | number | No | จำนวนรายการที่มี `idempotencyKey` อยู่แล้ว |
| `data.failed` | number | No | จำนวนรายการที่เกิด business หรือ persistence error ระหว่างประมวลผล |
| `data.results` | object[] | No | ผลลัพธ์เรียงตาม index ของ request |

#### `data.results[]`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `index` | number | No | ตำแหน่งรายการใน `events` เริ่มที่ `0` |
| `success` | boolean | No | `true` เมื่อสร้างได้หรือเป็นรายการซ้ำ |
| `created` | boolean | Conditional | มีเมื่อ `success=true`; `true` เมื่อสร้างใหม่ |
| `duplicate` | boolean | Conditional | มีเมื่อ `success=true`; `true` เมื่อพบรายการเดิม |
| `event` | object | Conditional | alert event ที่สร้างใหม่หรือรายการเดิม |
| `error.code` | string | Conditional | code ของรายการที่ไม่สำเร็จ เช่น `BAD_REQUEST` |
| `error.message` | string | Conditional | ข้อความที่ปลอดภัยสำหรับ integration client |
| `error.details` | unknown | Yes | รายละเอียดประกอบ error เมื่อมี |

#### ฟิลด์หลักใน `event`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `id` | number | No | ID ของ alert event |
| `idempotencyKey` | string | No | opaque key ที่ backend สร้างเพื่อกันเหตุการณ์ซ้ำ; client ห้ามแยกองค์ประกอบหรือสร้าง key เอง |
| `alertType` | `STANDARD_EXCEEDED` \| `EIA_EXCEEDED` | No | derive จาก `thresholdType` |
| `systemType` | `CEMS` \| `WPMS` | No | ระบบต้นทาง |
| `displaySystemType` | `CEMS` \| `BOD_COD_ONLINE` | No | ชื่อระบบสำหรับแสดงผล |
| `factoryId` | string | Yes | ID โรงงานจาก connected measurement point |
| `factoryName` | string | No | ชื่อโรงงาน current/live POMS |
| `factoryRegistrationNo` | string | Yes | เลขทะเบียนโรงงาน |
| `stationId` | string | No | station ID จาก request |
| `pointCode` | string | Yes | canonical point code ของ connected point |
| `pointName` | string | No | ชื่อจุดตรวจวัดจาก connected point |
| `pointType` | `STACK` \| `WASTEWATER` \| `OTHER` | Yes | ประเภทจุดตรวจวัด |
| `parameterCode` | string | No | รหัสพารามิเตอร์ lowercase |
| `parameterName` | string | No | ชื่อพารามิเตอร์ uppercase |
| `parameterLabel` | string | No | ชื่อพร้อมหน่วย เช่น `SO2 (ppm)` หรือ `COD (mg/l)` |
| `unit` | string | Yes | หน่วยของค่าตรวจวัด |
| `eventDate` | string | No | วันที่รูปแบบ `YYYY-MM-DD` |
| `eventDateText` | string | No | วันที่ย่อสำหรับแสดงผล |
| `timeRange` | string | Yes | ช่วงเวลาสำหรับแสดงผล เช่น `20.00 - 20.59` |
| `startedAt` | string | Yes | ต้นชั่วโมงที่ backend สร้างใน timezone `+07:00` |
| `endedAt` | string | Yes | วินาทีสุดท้ายของชั่วโมงที่ backend สร้างใน timezone `+07:00` |
| `measuredValue` | number | Yes | ค่าที่ตรวจวัดได้ |
| `thresholdValue` | number | Yes | ค่าเกณฑ์ หน่วยเดียวกับ `unit` |
| `thresholdType` | `STANDARD` \| `EIA` | Yes | ประเภทเกณฑ์ |
| `notificationStatus` | string | No | สถานะเริ่มต้น `AUTO` |
| `sourcePayload` | object | Yes | payload ที่ผ่าน validation รวม `eventDate` และ `time` |
| `detectedAt` | string | No | เวลาที่ backend บันทึกเหตุการณ์ |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "total": 1,
    "created": 1,
    "duplicate": 0,
    "failed": 0,
    "results": [
      {
        "index": 0,
        "success": true,
        "created": true,
        "duplicate": false,
        "event": {
          "id": 1001,
          "alertType": "STANDARD_EXCEEDED",
          "systemType": "CEMS",
          "factoryName": "บริษัทตัวอย่าง จำกัด",
          "stationId": "S0001",
          "pointName": "ปล่องระบาย A",
          "parameterCode": "so2",
          "parameterName": "SO2",
          "parameterLabel": "SO2 (ppm)",
          "unit": "ppm",
          "eventDate": "2026-03-02",
          "timeRange": "20.00 - 20.59",
          "startedAt": "2026-03-02T20:00:00+07:00",
          "endedAt": "2026-03-02T20:59:59+07:00",
          "measuredValue": 150,
          "thresholdValue": 60,
          "thresholdType": "STANDARD",
          "notificationStatus": "AUTO",
          "sourcePayload": {
            "systemType": "CEMS",
            "stationId": "S0001",
            "pointCode": "S0001",
            "parameterCode": "so2",
            "unit": "ppm",
            "eventDate": "2026-03-02",
            "time": "20:00",
            "measuredValue": 150,
            "thresholdValue": 60,
            "thresholdType": "STANDARD"
          }
        }
      }
    ]
  }
}
```

### Validation And Business Rules

- request root และแต่ละ `events[]` ใช้ strict schema; field ที่ไม่รู้จักทำให้ทั้ง request ตอบ `400 VALIDATION_ERROR`
- `events` ต้องมี 1-500 รายการ Backend validate ทั้ง batch ก่อนเรียก service หากรายการใดมีรูปแบบหรือค่าที่ไม่ถูกต้อง จะตอบ `400 VALIDATION_ERROR` และไม่มีรายการใน batch นั้นถูกบันทึก แม้รายการอื่นจะผ่าน validation
- `measuredValue` และ `thresholdValue` รับ number หรือ numeric string ที่ไม่ว่างและแปลงเป็น finite number ได้ เช่น `125` หรือ `"125"`; ไม่รับ `null`, boolean, empty/whitespace-only string, array, object, `NaN` หรือ infinity
- ทั้ง `STANDARD` และ `EIA` ต้องมี `measuredValue > thresholdValue` หลังแปลงตัวเลข ค่าเท่ากับหรือต่ำกว่าเกณฑ์ไม่ใช่เหตุการณ์ค่าเกินและตอบ `400 VALIDATION_ERROR` โดย `error.issues[].pathString` ระบุ `events.<index>.measuredValue`
- ต้นทางต้องเลือกพารามิเตอร์ หน่วย และเกณฑ์ที่ถูกต้องเอง การตรวจข้างต้นยืนยันเฉพาะความสัมพันธ์ตัวเลขจาก request ยังไม่ได้ตรวจ `thresholdValue` กับ registered config และไม่มี raw-measurement polling สำหรับสร้างเหตุการณ์ใน endpoint นี้
- `time` ต้องเป็นต้นชั่วโมง `HH:00`; ค่าอย่าง `20:30`, `24:00` หรือ `20` ไม่ผ่าน validation
- `eventDate` ต้องเป็นวันที่จริง เช่น `2026-02-30` ไม่ผ่าน validation; กฎเดียวกันใช้กับวันที่ filter รายการ
- Backend แปลง `eventDate=2026-03-02` และ `time=20:00` เป็น `startedAt=2026-03-02T20:00:00+07:00` และ `endedAt=2026-03-02T20:59:59+07:00`
- `idempotencyKey` เป็น opaque key ที่คำนวณจาก `systemType`, `stationId`, normalized `parameterCode`, normalized `unit`, derived `alertType` และ `startedAt`; การส่งเหตุการณ์เดิมซ้ำไม่สร้าง row ใหม่ หน่วยใช้ trim และ lowercase ใน identity ดังนั้น `CO (ppm)` กับ `CO (%)` ไม่รวมเป็นเหตุการณ์เดียวกัน
- เมื่อสอง request ส่งเหตุการณ์เดียวกันพร้อมกัน backend ใช้ unique constraint กันซ้ำและคืนรายการเดิมให้ request ที่แข่ง insert แพ้ ไม่รายงานเป็น persistence failure เพียงเพราะเป็น duplicate race
- เหตุการณ์ที่บันทึกด้วย key รุ่นเดิมยังอ่านและรับการส่งซ้ำได้เมื่อหน่วยตรงกัน รูปแบบ key ของรายการใหม่อาจต่างจากรายการเดิม Client ใช้ `event.id` อ้างอิงและไม่พึ่งโครงสร้าง string ของ `idempotencyKey`
- `stationId` หรือ `pointCode` ต้องตรงกับ active row ใน `cems_wpms_connected_measurement_points`; backend ใช้ข้อมูล current/live POMS จาก row นั้นเติมโรงงาน ชื่อจุด และประเภทจุด
- `thresholdType=STANDARD` derive เป็น `STANDARD_EXCEEDED`; `thresholdType=EIA` derive เป็น `EIA_EXCEEDED`
- Client ห้ามส่ง `alertType` หรือ `notificationStatus`; backend เป็นผู้กำหนดและตั้งสถานะแรกเป็น `AUTO`
- การรับเหตุการณ์ไม่ส่งอีเมลทันทีและไม่ตีความ `notificationStatus` เป็นผล SMTP รอบ/ผลการส่งอยู่ใน [อีเมลแจ้งเตือนมลพิษ](../../menus/notifications/email-notifications.md)
- Business error ของรายการหนึ่งไม่หยุดรายการอื่น ผลลัพธ์จะอยู่ใน `data.results[index].error` และนับใน `data.failed`

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | body ผิดรูปแบบ, batch ว่าง/เกิน 500, `time` ไม่ใช่ `HH:00`, มี field ที่ไม่รู้จัก, ตัวเลขไม่ใช่ finite number หรือ `measuredValue <= thresholdValue` | แก้ request ทั้ง batch ก่อนส่งใหม่; กรองค่าที่ไม่เกินเกณฑ์ออกจากช่อง alert event |
| `401` | `UNAUTHORIZED` | ไม่มี `X-API-Key` หรือ key ไม่ถูกต้อง | ตรวจ scoped integration key โดยไม่ log ค่า key |
| `200` | item-level code | Request ผ่าน schema แต่บางรายการไม่ผูกกับ connected point หรือบันทึกไม่สำเร็จ | ตรวจ `data.failed` และ `data.results[].error` แล้ว retry เฉพาะรายการที่เหมาะสม |

### Validation Error Example

เมื่อ `events[0]` ส่ง `measuredValue: 120` และ `thresholdValue: 120` backend ตอบ `400` ดังนี้ และไม่บันทึกรายการใดใน batch:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "events": ["measuredValue must be greater than thresholdValue"]
    },
    "issues": [
      {
        "code": "custom",
        "path": ["events", 0, "measuredValue"],
        "pathString": "events.0.measuredValue",
        "message": "measuredValue must be greater than thresholdValue"
      }
    ]
  }
}
```

การปฏิเสธค่าที่ไม่เกินเกณฑ์และชนิดข้อมูลที่แปลงเป็นตัวเลขโดยไม่ได้ตั้งใจเป็น breaking change ดูวิธี migrate ที่ [การตรวจเหตุการณ์ค่าเกิน](../../CHANGELOG.md#alert-event-exceedance-validation) การแทน `startTime` และ `endTime` ด้วย `time` ดูประวัติใน [API breaking-change log](../../CHANGELOG.md)

## Backend Maintainer Links

- Route: [`integrations.routes.ts`](../../../../../backend/src/modules/integrations/integrations.routes.ts)
- Authentication: [`integration-api-key.middleware.ts`](../../../../../backend/src/modules/integrations/integration-api-key.middleware.ts)
- Controller: [`alert-events.controller.ts`](../../../../../backend/src/modules/alert-events/alert-events.controller.ts)
- Validator: [`alert-events.validator.ts`](../../../../../backend/src/modules/alert-events/alert-events.validator.ts)
- กฎเปรียบเทียบค่าเกิน: [`alert-event-exceedance.ts`](../../../../../backend/src/modules/alert-events/alert-event-exceedance.ts)
- Types: [`alert-events.types.ts`](../../../../../backend/src/modules/alert-events/alert-events.types.ts)
- Service and repository: [`alert-events.service.ts`](../../../../../backend/src/modules/alert-events/alert-events.service.ts), [`alert-events.repository.ts`](../../../../../backend/src/modules/alert-events/alert-events.repository.ts)
- การเรียก service โดยตรงมี guard ก่อนค้นฐานข้อมูล: ตัวเลขไม่เป็น finite number ใช้ `BAD_REQUEST` พร้อม `details.reason=INVALID_NUMBER`; ค่าไม่เกินใช้ `BAD_REQUEST` พร้อม `details.field=measuredValue` และ `details.reason=NOT_EXCEEDED` ส่วน HTTP endpoint ผ่าน batch validator ก่อนเสมอและใช้ `VALIDATION_ERROR` ตามตัวอย่างข้างต้น
- Tests: [`alert-events.route.test.ts`](../../../../../backend/tests/unit/alert-events.route.test.ts), [`alert-events.service.test.ts`](../../../../../backend/tests/unit/alert-events.service.test.ts)
- Tests ค่าเกินและ runtime contract: [`alert-events.exceedance-validation.test.ts`](../../../../../backend/tests/unit/alert-events.exceedance-validation.test.ts), [`alert-events.exceedance.openapi.test.ts`](../../../../../backend/tests/unit/alert-events.exceedance.openapi.test.ts)
- Evidence: [สัญญาเวลารายชั่วโมง](../../../evidence/integrations/alert-event-hourly-time.tdd.md), [ตรวจค่าเกินก่อนรับเหตุการณ์](../../../evidence/notifications/alert-event-exceedance-validation.tdd.md)
