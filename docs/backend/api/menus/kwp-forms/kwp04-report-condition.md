# รายงานตามเงื่อนไข กวภ.04

[กลับไปหน้าเมนู กวภ.](./README.md)

กวภ.04 เก็บ “รายงานตามเงื่อนไข” แยกต่อรายการตรวจวัดมลพิษอากาศจากปล่องระบาย แต่ละรายการเลือกต่างกันได้ กวภ.02 ไม่รับและไม่คืนฟิลด์นี้ แม้ใช้ตารางจัดเก็บร่วมกัน

## เริ่มใช้งาน

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/kwp-form-submissions/kwp04' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"factoryId":"F000123","factoryName":"โรงงานตัวอย่าง","measurementItems":[{"pollutant":"CO (ppm)","reportCondition":"4(1)"}]}'
```

| งาน | Method และ Path | Permission | สำเร็จ |
| --- | --- | --- | --- |
| สร้างแบบ | `POST /api/v1/kwp-form-submissions/kwp04` | `kwp_forms:edit` | `201` submission summary |
| แก้ไขแบบ | `PATCH /api/v1/kwp-form-submissions/kwp04/:id` | `kwp_forms:edit` | `200` detail |
| อ่านรายละเอียด | `GET /api/v1/kwp-form-submissions/kwp04/:id` | `kwp_forms:view` | `200` detail |
| ส่งซ้ำหลังแก้ไข | `POST /api/v1/kwp-form-submissions/kwp04/:id/resubmit` | `kwp_forms:edit` | `200` workflow |

ทุก endpoint ต้องยืนยันตัวตนด้วย Bearer token และตรวจขอบเขตโรงงาน/พื้นที่ตาม [สัญญาเมนู กวภ.](./README.md) การแก้ไขและส่งซ้ำใช้สถานะ `REVISION_REQUESTED` ตามเดิม การเพิ่มฟิลด์นี้ไม่เพิ่มสิทธิ์หรือขยายขอบเขตข้อมูล

## สร้างและแก้ไขแบบ

`POST /api/v1/kwp-form-submissions/kwp04` และ `PATCH /api/v1/kwp-form-submissions/kwp04/:id` ใช้ request schema `Kwp04Request` ต่างจาก `Kwp02Or04Request` ที่คงไว้สำหรับ กวภ.02 โดย PATCH ยังรับข้อมูลแบบและรายการตรวจวัดทั้งชุดตามขั้นตอนเดิม

### ฟิลด์คำขอ

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path สำหรับ PATCH | integer | Yes | รหัสแบบ กวภ.04 จำนวนเต็มบวก |
| `factoryId` | body | string | Yes | รหัสโรงงานที่ผู้ส่งมีสิทธิ์ |
| `factoryName` | body | string | Yes | ชื่อโรงงาน |
| `measurementItems` | body | array | Yes | 1–100 รายการตามเดิม |
| `measurementItems[].pollutant` | body | string | Yes | ป้ายพารามิเตอร์พร้อมหน่วย เช่น `CO (ppm)`; ต้องอยู่ในรายการที่เข้าข่าย |
| `measurementItems[].reportCondition` | body | string enum | Yes | เฉพาะ `"4(1)"`, `"4(2)"`, `"11(3)"`, `"16"`; บังคับทุกแถว ไม่มีค่าเริ่มต้น |
| `measurementItems[].sampleDate` | body | string/null | No | วันที่ `YYYY-MM-DD` |
| `measurementItems[].measuredValue` | body | string/number/null | No | ค่าตรวจวัดตาม contract เดิม |
| `measurementItems[].unit` | body | string/null | No | หน่วยของค่าตรวจวัด |
| `measurementItems[].laboratoryNo` | body | string/null | No | เลขห้องปฏิบัติการ |
| `measurementItems[].reportNo` | body | string/null | No | เลขรายงาน |
| `measurementItems[].method` | body | string/null | No | วิธีตรวจวัดวิเคราะห์ |
| `measurementItems[].attachments` | body | array | No | metadata ไฟล์ `SAMPLING_PHOTO`/`LAB_REPORT` ตาม [ข้อกำหนดไฟล์แนบ](./README.md#kwp-handoff-fields) |
| `reportRound`, `reportYear`, `samplingPhotoLink`, `labReportLink` | body | ตาม contract เดิม | No | ดู [ฟิลด์รอบรายงานและลิงก์](./README.md#kwp-handoff-fields) |

ฟิลด์ข้อมูลโรงงาน ผู้ติดต่อ ผู้จัดทำ และจุดตรวจวัดอื่นยังใช้ contract เดิม ดู schema เต็มใน [runtime OpenAPI](https://d-poms.diw.go.th/api/v1/docs/) หลังนำ release นี้ขึ้นระบบ

ตัวอย่าง request ขั้นต่ำ ใช้ได้ทั้ง POST และ PATCH:

```json
{
  "factoryId": "F000123",
  "factoryName": "โรงงานตัวอย่าง",
  "measurementItems": [
    { "pollutant": "CO (ppm)", "reportCondition": "4(1)" },
    { "pollutant": "NOx (ppm)", "reportCondition": "16" }
  ]
}
```

### ผลสร้างแบบ

POST ตอบ `201` พร้อม `Location: /api/v1/kwp-form-reports/requests/:id` และ summary ตามเดิม; อ่านเงื่อนไขที่บันทึกผ่าน GET detail

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` |
| `data.id` | integer | No | รหัสแบบ |
| `data.requestNo` | string | No | เลขเอกสาร |
| `data.formType` | string | No | `KWP04` |
| `data.status` | string | No | `SUBMITTED` |
| `data.measurementItemCount` | integer | No | จำนวนรายการที่บันทึก |

```json
{
  "success": true,
  "data": {
    "id": 14,
    "requestNo": "F04-04-0001/2569",
    "formType": "KWP04",
    "status": "SUBMITTED",
    "measurementItemCount": 2
  }
}
```

## อ่านและแก้ไขรายละเอียด

`GET /api/v1/kwp-form-submissions/kwp04/:id` และผลสำเร็จของ PATCH ตอบ `200` ด้วย schema `Kwp04SubmissionDetailResponse` โดยคงฟิลด์รายละเอียดเดิมและเพิ่มค่าต่อแถวดังนี้

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `id` | path integer | No | GET ต้องระบุรหัสแบบจำนวนเต็มบวก |
| `data.formType` | string | No | `KWP04` |
| `data.measurementItems` | array | No | รายการตรวจวัดตามลำดับที่บันทึก |
| `data.measurementItems[].id` | integer | No | รหัสรายการตรวจวัด |
| `data.measurementItems[].pollutant` | string | No | ป้ายพารามิเตอร์พร้อมหน่วย |
| `data.measurementItems[].reportCondition` | string enum/null | Yes | หนึ่งในสี่ตัวเลือก; ข้อมูลเก่าที่ไม่เคยเลือกคืน `null` ไม่มีการเดาค่า |

ตัวอย่างเฉพาะฟิลด์สำคัญ ใช้กับ GET และ PATCH response:

```json
{
  "success": true,
  "data": {
    "id": 14,
    "formType": "KWP04",
    "measurementItems": [
      { "id": 81, "pollutant": "CO (ppm)", "reportCondition": "4(1)" },
      { "id": 82, "pollutant": "NOx (ppm)", "reportCondition": "16" }
    ]
  }
}
```

ข้อมูลเก่ายังเปิดอ่านได้แม้ `reportCondition` เป็น `null`; client แสดงขีดในตาราง/PDF และไม่เลือกค่าแทนผู้ใช้ เมื่อนำมาแก้ไขต้องส่งค่าที่ถูกต้องครบทุกแถว

## ส่งซ้ำหลังแก้ไข

`POST /api/v1/kwp-form-submissions/kwp04/:id/resubmit` ใช้ request เดิม: `id` เป็น path integer จำนวนเต็มบวก และ body รับเฉพาะ `note` ซึ่งเป็น optional string เท่านั้น ห้ามส่ง `measurementItems` หรือ `reportCondition` ใน body นี้

```json
{ "note": "เลือกเงื่อนไขครบแล้ว" }
```

ต้อง PATCH ข้อมูลให้สำเร็จก่อน แล้วจึง resubmit; backend ตรวจเงื่อนไขที่บันทึกทุกแถวซ้ำก่อนเปลี่ยนสถานะ ถ้ายังไม่มีรายการหรือมีค่าขาด/ไม่ถูกต้อง ตอบ `400 BAD_REQUEST` โดยไม่เปลี่ยนสถานะหรือเพิ่มประวัติการส่ง

สำเร็จตอบ `200` workflow ตาม [response ของ resubmit](./README.md#post-resubmit-endpoints) โดย `data.id` เป็น integer, `data.status` เป็น `SUBMITTED` และ `data.statusLabel` เป็นข้อความสถานะ:

```json
{ "success": true, "data": { "id": 14, "status": "SUBMITTED", "statusLabel": "แก้ไขแล้ว/รอพิจารณา" } }
```

## Validation และข้อผิดพลาด

ใช้ [shared error envelope](../../shared/README.md) ตามเดิม ไม่มีการเปลี่ยนจำนวนรายการ ไฟล์แนบ หรือกติกาตรวจพารามิเตอร์

| HTTP status | Code | เงื่อนไข | การจัดการของ client |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | POST/PATCH ขาดค่า, `null`, ว่าง, ไม่ใช่ string หรือนอกตัวเลือก; รวม `16` แบบ number และ `" 16 "` | แก้ตาม `error.issues[].path` เช่น `["measurementItems", 0, "reportCondition"]` |
| `400` | `VALIDATION_ERROR` | ส่งฟิลด์ใหม่ใน กวภ.02 หรือส่งข้อมูลรายการมากับ resubmit | ใช้ request schema ของ endpoint นั้น |
| `400` | `BAD_REQUEST` | resubmit ทั้งที่เงื่อนไขที่บันทึกยังไม่ครบ/ไม่ถูกต้อง | PATCH รายการให้ครบแล้วส่งซ้ำ |
| `401` | `UNAUTHORIZED` | ไม่มี token ที่ใช้ได้ | เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | ไม่มีสิทธิ์ของ action ตามนโยบายปัจจุบัน | ตรวจสิทธิ์ผู้ใช้ |
| `404` | `NOT_FOUND` | ไม่พบแบบ/โรงงานในขอบเขตของ action | โหลดรายการที่มีสิทธิ์ใหม่ |
| `409` | `CONFLICT` | สถานะไม่อนุญาตให้แก้ไขหรือส่งซ้ำ | โหลดสถานะล่าสุด |

## การเปลี่ยนผ่านและแหล่งอ้างอิง Backend

- นี่เป็น breaking change สำหรับ client ที่สร้าง/แก้ไข กวภ.04 โดยไม่ส่งฟิลด์ใหม่ ดู [ผลกระทบและขั้นตอนย้าย client](../../CHANGELOG.md#kwp04-report-condition)
- รัน migration `0159_add_kwp04_measurement_report_condition` ก่อนเริ่ม backend รุ่นใหม่ คอลัมน์ nullable ไม่มี default และไม่ backfill ข้อมูลเก่า; rollback ปฏิเสธเมื่อมีค่าเพื่อป้องกันข้อมูลสูญหาย การคืนแอปเวอร์ชันเดิมให้คงคอลัมน์ไว้
- ประสาน client ให้ส่งฟิลด์ใหม่ก่อนเปิดใช้กติกานี้ และหลัง deploy ที่ได้รับอนุญาตตรวจ `/api/v1/openapi.json` ว่ามี `Kwp04Request`/`Kwp04SubmissionDetailResponse` ตรงกับหน้านี้
- Routes: [`kwp-form-submissions.routes.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts); validator: [`kwp-form-submissions.validator.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.validator.ts)
- Types: [`kwp-form-submissions.types.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.types.ts); persistence: [`kwp-form-submissions.repository.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts)
- Migration: [`0159_add_kwp04_measurement_report_condition.ts`](../../../../../backend/src/db/migrations/0159_add_kwp04_measurement_report_condition.ts)
- OpenAPI: [`kwp-handoff.openapi.ts`](../../../../../backend/src/modules/api-docs/kwp-handoff.openapi.ts), [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts)
- Tests: [`validator`](../../../../../backend/tests/unit/kwp-handoff.validator.test.ts), [`routes`](../../../../../backend/tests/unit/kwp-form-submissions.route.test.ts), [`persistence`](../../../../../backend/tests/unit/kwp-handoff.persistence.test.ts), [`OpenAPI`](../../../../../backend/tests/unit/kwp-handoff.openapi.test.ts), [`migration`](../../../../../backend/tests/unit/kwp04-report-condition-migration.test.ts)
