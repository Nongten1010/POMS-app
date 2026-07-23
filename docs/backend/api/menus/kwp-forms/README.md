# แจ้งแบบ กวภ. 01 - กวภ. 05

> Owner: Backend

## Frontend Quick Start

เมนูนี้ครอบคลุมการอัปโหลดเอกสารแนบ, การส่งแบบ กวภ.01-กวภ.05, การอ่านรายละเอียดแบบ, workflow review และตารางรายงานคำขอ กรณีวันที่ของ กวภ.01 และ กวภ.03 backend รองรับทั้งรูปแบบ legacy `YYYY-MM-DD` และรูปแบบรายชั่วโมง `YYYY-MM-DDTHH:00:00` แบบ local civil time ของ `Asia/Bangkok` โดย backend จะคำนวณ `totalDays` และ `totalHours` เอง

### Main Flow

1. อ่านจุดตรวจวัดและข้อมูล prefill ด้วย `GET /api/v1/connected-measurement-points/factories/:factoryId`
2. อัปโหลดไฟล์แนบด้วย `POST /api/v1/kwp-form-submissions/attachments` และเก็บ metadata กลับไปผูกในฟอร์ม
3. ส่งแบบ `POST /api/v1/kwp-form-submissions/kwp01` ถึง `kwp05`
4. อ่านรายการและรายละเอียดแบบผ่าน `kwp-form-reports/*` และ `kwp-form-submissions/*`
5. เจ้าหน้าที่อ่าน workflow และอนุมัติหรือ request revision ผ่าน workflow endpoints

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/kwp-form-submissions/kwp03' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "factoryId": "F000123",
    "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
    "issueReasons": ["เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง"],
    "failedParameters": ["BOD (mg/l)"],
    "instruments": ["pH Meter"],
    "problemDate": "2026-07-01T08:00:00",
    "expectedDoneDate": "2026-07-05T06:00:00"
  }'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| อ่านจุดตรวจวัดและข้อมูล prefill | `GET` | `/api/v1/connected-measurement-points/factories/:factoryId` | Bearer | `cems_wpms_requests:view` | [Connected measurement points](../../shared/connected-measurement-points/README.md) |
| อัปโหลดไฟล์แนบ | `POST` | `/api/v1/kwp-form-submissions/attachments` | Bearer | `kwp_forms:edit` | [Upload attachment](#post-apiv1kwp-form-submissionsattachments) |
| ส่งแบบ กวภ.01 | `POST` | `/api/v1/kwp-form-submissions/kwp01` | Bearer | `kwp_forms:edit` | [KWP01 submit/update](#postpatch-kwp01-hourly-duration-contract) |
| แก้ไขแบบ กวภ.01 | `PATCH` | `/api/v1/kwp-form-submissions/kwp01/:id` | Bearer | `kwp_forms:edit` | [KWP01 submit/update](#postpatch-kwp01-hourly-duration-contract) |
| ส่งแบบ กวภ.03 | `POST` | `/api/v1/kwp-form-submissions/kwp03` | Bearer | `kwp_forms:edit` | [KWP03 submit/update](#postpatch-kwp03-hourly-duration-contract) |
| แก้ไขแบบ กวภ.03 | `PATCH` | `/api/v1/kwp-form-submissions/kwp03/:id` | Bearer | `kwp_forms:edit` | [KWP03 submit/update](#postpatch-kwp03-hourly-duration-contract) |
| ส่งแบบ กวภ.05 | `POST` | `/api/v1/kwp-form-submissions/kwp05` | Bearer | `kwp_forms:edit` | [KWP05 optional legacy fields](#postpatch-kwp05-optional-legacy-fields) |
| แก้ไขแบบ กวภ.05 | `PATCH` | `/api/v1/kwp-form-submissions/kwp05/:id` | Bearer | `kwp_forms:edit` | [KWP05 optional legacy fields](#postpatch-kwp05-optional-legacy-fields) |
| ส่งแบบ กวภ.02 | `POST` | `/api/v1/kwp-form-submissions/kwp02` | Bearer | `kwp_forms:edit` | [KWP02/KWP04 summary](#kwp02kwp04-summary) |
| แก้ไขแบบ กวภ.02 | `PATCH` | `/api/v1/kwp-form-submissions/kwp02/:id` | Bearer | `kwp_forms:edit` | [KWP02/KWP04 summary](#kwp02kwp04-summary) |
| ส่งแบบ กวภ.04 | `POST` | `/api/v1/kwp-form-submissions/kwp04` | Bearer | `kwp_forms:edit` | [KWP02/KWP04 summary](#kwp02kwp04-summary) |
| แก้ไขแบบ กวภ.04 | `PATCH` | `/api/v1/kwp-form-submissions/kwp04/:id` | Bearer | `kwp_forms:edit` | [KWP02/KWP04 summary](#kwp02kwp04-summary) |
| อ่านรายละเอียดแบบ | `GET` | `/api/v1/kwp-form-submissions/kwp01/:id` ถึง `/api/v1/kwp-form-submissions/kwp05/:id` | Bearer | `kwp_forms:view` | [Read detail](#get-detail-endpoints) |
| ส่งแบบกลับหลังแก้ไข | `POST` | `/api/v1/kwp-form-submissions/kwp01/:id/resubmit` ถึง `/api/v1/kwp-form-submissions/kwp05/:id/resubmit` | Bearer | `kwp_forms:edit` | [Resubmit](#post-resubmit-endpoints) |
| อ่าน workflow | `GET` | `/api/v1/kwp-form-submissions/:id/workflow` | Bearer | `kwp_forms:view` | [Workflow read](#get-apiv1kwp-form-submissionsidworkflow) |
| อนุมัติหรือ request revision | `POST` | `/api/v1/kwp-form-submissions/:id/workflow-actions` | Bearer | `kwp_forms:approve` | [Workflow action](#post-apiv1kwp-form-submissionsidworkflow-actions) |
| รายชื่อโรงงานสำหรับเมนู กวภ. | `GET` | `/api/v1/kwp-form-reports/factories` | Bearer | `kwp_forms:view` | [Reports](#get-apiv1kwp-form-reportsfactories) |
| รายการคำขอ กวภ. | `GET` | `/api/v1/kwp-form-reports/requests` | Bearer | `kwp_forms:view` | [Reports](#get-apiv1kwp-form-reportsrequests) |

## Contracts

### `POST /api/v1/kwp-form-submissions/attachments`

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:edit`
- Data scope: สิทธิ์แก้ไขแบบ กวภ.

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `file` | multipart form-data | PDF / PNG / JPEG | Yes | ไฟล์แนบที่อัปโหลดจริง |
| `attachmentType` | multipart form-data | string | No | ใช้กำหนดเพดานขนาดไฟล์เฉพาะบางประเภท; trim แล้ว 1-64 ตัวอักษร |

### Request Example

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/kwp-form-submissions/attachments' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'attachmentType=RATA_REPORT' \
  --form 'file=@rata-report.pdf;type=application/pdf'
```

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data.originalFileName` | string | No | ชื่อไฟล์เดิมจาก client หลัง sanitize อักขระที่ไม่รองรับ |
| `data.storedFileName` | string | No | ชื่อไฟล์ที่ backend เก็บจริง |
| `data.mimeType` | string | No | MIME type ที่ backend รับไว้ |
| `data.fileSize` | number | No | ขนาดไฟล์เป็น bytes |
| `data.storagePath` | string | No | path ที่ต้องส่งกลับมาใน metadata ของฟอร์ม |
| `data.fileUrl` | string | No | URL สำหรับเปิดไฟล์สาธารณะ |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "originalFileName": "rata-report.pdf",
    "storedFileName": "8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
    "mimeType": "application/pdf",
    "fileSize": 6291456,
    "storagePath": "kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
    "fileUrl": "https://example.com/uploads/kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf"
  }
}
```

### Validation And Business Rules

- รับเฉพาะ `application/pdf`, `image/png`, `image/jpeg`
- Backend ตรวจ signature ของไฟล์จริงให้ตรงกับ MIME type; ไฟล์ปลอม extension จะถูก reject
- `attachmentType = RATA_REPORT` และ `CALIBRATION_PHOTO` อัปโหลดได้สูงสุด 10 MB
- ถ้าไม่ส่ง `attachmentType` หรือส่งค่าอื่น จำกัดที่ 5 MB
- multer transport limit เปิดไว้ 10 MB เพื่อให้สองประเภทข้างต้นผ่านได้
- 1 MB ใน contract นี้เท่ากับ 1,048,576 bytes

### Errors

ใช้ [shared error envelope](../../shared/README.md) และระบุเฉพาะ error ของ endpoint นี้:

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `BAD_REQUEST` | ไม่ส่งไฟล์, file type ไม่รองรับ, ขนาดเกินเพดานตาม `attachmentType`, หรือ signature ไม่ตรง MIME type | ให้ client แจ้งผู้ใช้และอัปโหลดใหม่ |
| `400` | `UPLOAD_ERROR` | ไฟล์เกิน transport limit 10 MB หรือ multipart ส่งไฟล์เกิน 1 ไฟล์ | ลดขนาดหรือจำนวนไฟล์แล้วส่งใหม่ |
| `401` | `UNAUTHORIZED` | ไม่ได้ login | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `kwp_forms:edit` | ปิดปุ่มหรือแจ้งสิทธิ์ไม่พอ |

### Common factory and connected-point references

กฎนี้ใช้กับ `POST` และ `PATCH` ของ กวภ.01-กวภ.05:

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | body | string | Yes | รหัสโรงงานที่ backend ใช้ตรวจ data scope |
| `factoryRegistrationNo` | body | string | No | เลขทะเบียนโรงงาน ใช้เป็น identifier สำรอง |
| `connectedPointId` | body | positive integer | No | ID จาก `GET /api/v1/connected-measurement-points/factories/:factoryId`; ส่ง `null` หรือ omit ได้เมื่อ endpoint คืน `null` |

ถ้าส่ง `connectedPointId` backend จะตรวจว่าเป็น active row ใน `cems_wpms_connected_measurement_points` และต้องตรงกับ `factoryId` ที่ผ่าน data-scope access control แล้วเท่านั้น ระบบจะไม่ใช้ `factoryRegistrationNo` จาก payload เพื่อขยายสิทธิ์ เพื่อป้องกันการผูกแบบกับจุดตรวจวัดของโรงงานอื่น

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `403` | `FORBIDDEN` | `connectedPointId` ไม่ active หรือไม่ใช่ของโรงงานใน payload | โหลดรายการจุดตรวจวัดใหม่และเลือกจุดของโรงงานปัจจุบัน |

### `POST/PATCH` KWP01 hourly duration contract

ใช้กับ `POST /api/v1/kwp-form-submissions/kwp01` และ `PATCH /api/v1/kwp-form-submissions/kwp01/:id`

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:edit`
- Data scope: ตามสิทธิ์ `kwp_forms:edit`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | body | string | Yes | รหัสโรงงานที่ backend ใช้ตรวจ scope |
| `factoryName` | body | string | Yes | ชื่อโรงงาน snapshot |
| `issueReason` | body | enum | Yes | `เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง` หรือ `หยุดหน่วยการผลิต` |
| `problemDate` | body | string | No | รับ `YYYY-MM-DD` หรือ `YYYY-MM-DDTHH:00:00` เท่านั้น |
| `expectedDoneDate` | body | string | No | รับ `YYYY-MM-DD` หรือ `YYYY-MM-DDTHH:00:00` เท่านั้น และต้องไม่ก่อน `problemDate` |
| `totalDays` | body | number | No | legacy input; backend ไม่เชื่อค่าและจะคำนวณใหม่ |
| `unreportedParameters` | body | string[] | Yes | รายชื่อพารามิเตอร์ที่ไม่ได้รายงาน |

`totalHours` เป็น response-only field ห้ามส่งใน request และ client ใหม่ควรละ `totalDays` เพื่อให้ backend เป็นแหล่งคำนวณเพียงจุดเดียว

### Request Example

```json
{
  "factoryId": "F000123",
  "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
  "issueReason": "เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง",
  "problemDate": "2026-07-01T08:00:00",
  "expectedDoneDate": "2026-07-05T06:00:00",
  "totalDays": 1,
  "unreportedParameters": ["NOx (ppm)", "SO2 (ppm)"]
}
```

### Success Response Fields

`POST` ตอบ `201 Created` เป็น submission summary ส่วนตารางและตัวอย่างด้านล่างเป็น detail response ของ `PATCH` และ `GET`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data.issueReport.problemDate` | string | Yes | วันที่หรือวัน-เวลาเดียวกับ precision ที่จัดเก็บ |
| `data.issueReport.expectedDoneDate` | string | Yes | วันที่หรือวัน-เวลาเดียวกับ precision ที่จัดเก็บ |
| `data.issueReport.totalDays` | number | Yes | จำนวนวันรวมแบบ inclusive |
| `data.issueReport.totalHours` | number | Yes | จำนวนชั่วโมงจริงเมื่อ input ทั้งสองฝั่งเป็นรายชั่วโมง; legacy date-only จะเป็น `null` |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": 12,
    "formType": "KWP01",
    "issueReport": {
      "problemDate": "2026-07-01T08:00:00",
      "expectedDoneDate": "2026-07-05T06:00:00",
      "totalDays": 5,
      "totalHours": 94,
      "unreportedParameters": ["NOx (ppm)", "SO2 (ppm)"]
    }
  }
}
```

### Validation And Business Rules

- เวลาแบบรายชั่วโมงต้องตรงชั่วโมงเต็มเท่านั้น; นาทีและวินาทีต้องเป็น `00`
- datetime เป็นเวลาท้องถิ่น `Asia/Bangkok` และไม่รับ suffix `Z` หรือ UTC offset
- ถ้า input เป็น date-only ทั้งสองฝั่ง backend จะเก็บ `totalDays` และคืน `totalHours: null`
- ถ้า input เป็นรายชั่วโมงทั้งสองฝั่ง backend จะคำนวณ `totalHours` จากผลต่างจริงและยังคงคืน `totalDays` แบบ inclusive days
- ถ้าส่งวันที่เพียงฝั่งเดียวหรือ precision ของสองฝั่งไม่ตรงกัน `totalHours` จะเป็น `null`
- backend derive duration จากค่าที่ผ่าน validation แล้วและไม่เชื่อค่า duration จาก client

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | format วันที่ไม่ตรง, เวลาไม่ใช่ต้นชั่วโมง, หรือ `expectedDoneDate` ก่อน `problemDate` | แก้ payload แล้วส่งใหม่ |

### `POST/PATCH` KWP03 hourly duration contract

ใช้กับ `POST /api/v1/kwp-form-submissions/kwp03` และ `PATCH /api/v1/kwp-form-submissions/kwp03/:id`

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:edit`
- Data scope: ตามสิทธิ์ `kwp_forms:edit`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | body | string | Yes | รหัสโรงงานที่ backend ใช้ตรวจ scope |
| `factoryName` | body | string | Yes | ชื่อโรงงาน snapshot |
| `instruments` | body | string[] | Yes | เครื่องตรวจวัดอย่างน้อย 1 รายการ |
| `issueReasons` | body | enum[] | Yes | สาเหตุอย่างน้อย 1 รายการตาม enum ใน validator |
| `failedParameters` | body | string[] | Yes | พารามิเตอร์ที่รายงานไม่ได้อย่างน้อย 1 รายการ |
| `measurementTimes` | body | string[] | No | optional; ถ้าไม่ส่ง backend จะ normalize เป็น `[]` |
| `problemDate` | body | string | No | รับ `YYYY-MM-DD` หรือ `YYYY-MM-DDTHH:00:00` |
| `expectedDoneDate` | body | string | No | รับ `YYYY-MM-DD` หรือ `YYYY-MM-DDTHH:00:00` และต้องไม่ก่อน `problemDate` |
| `totalDays` | body | number | No | legacy input; backend คำนวณใหม่ |
| `treatmentSystemType` | body | string | No | key เดิม; การแก้ label ที่ frontend ไม่เปลี่ยน payload |
| `attachments` | body | array | No | metadata ไฟล์แนบที่อัปโหลดมาก่อน |

`totalHours` เป็น response-only field ห้ามส่งใน request และ client ใหม่ควรละ `totalDays`

### Request Example

```json
{
  "factoryId": "F000123",
  "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
  "instruments": ["ค่าบีโอดี (BOD)"],
  "issueReasons": ["เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง"],
  "failedParameters": ["BOD (mg/l)"],
  "problemDate": "2026-07-01T08:00:00",
  "expectedDoneDate": "2026-07-05T06:00:00"
}
```

### Success Response Fields

`POST` ตอบ `201 Created` เป็น submission summary ส่วนตารางและตัวอย่างด้านล่างเป็น detail response ของ `PATCH` และ `GET`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data.wpmsIssueReport.measurementTimes` | string[] | No | คืน `[]` เมื่อ client ไม่ส่ง field นี้ |
| `data.wpmsIssueReport.problemDate` | string | Yes | วันที่หรือวัน-เวลาตาม precision ที่จัดเก็บ |
| `data.wpmsIssueReport.expectedDoneDate` | string | Yes | วันที่หรือวัน-เวลาตาม precision ที่จัดเก็บ |
| `data.wpmsIssueReport.totalDays` | number | Yes | จำนวนวันรวมแบบ inclusive |
| `data.wpmsIssueReport.totalHours` | number | Yes | จำนวนชั่วโมงจริงเมื่อเป็น hourly input ทั้งสองฝั่ง |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": 16,
    "formType": "KWP03",
    "wpmsIssueReport": {
      "measurementTimes": [],
      "problemDate": "2026-07-01T08:00:00",
      "expectedDoneDate": "2026-07-05T06:00:00",
      "totalDays": 5,
      "totalHours": 94
    }
  }
}
```

### Validation And Business Rules

- `measurementTimes` ไม่บังคับแล้ว; backend ใช้ `[]` เมื่อ field หายไป
- กติกา hourly/date-only และการ derive duration เหมือน KWP01

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | format วันที่ไม่ตรง, เวลาไม่ใช่ต้นชั่วโมง, หรือ `expectedDoneDate` ก่อน `problemDate` | แก้ payload แล้วส่งใหม่ |

### `POST/PATCH` KWP05 optional legacy fields

ใช้กับ `POST /api/v1/kwp-form-submissions/kwp05` และ `PATCH /api/v1/kwp-form-submissions/kwp05/:id`

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:edit`
- Data scope: ตามสิทธิ์ `kwp_forms:edit`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | body | string | Yes | รหัสโรงงานที่ backend ใช้ตรวจ scope |
| `factoryName` | body | string | Yes | ชื่อโรงงาน snapshot |
| `cemsBrand` | body | string | No | legacy field; omit ได้ |
| `calibrationItems[].verifierCompany` | body | string | No | legacy field; omit ได้ในแต่ละรายการ |
| `calibrationItems` | body | array | Yes | รายการผล calibration อย่างน้อย 1 รายการ |
| `calibrationItems[].parameter` | body | string | Yes | พารามิเตอร์ที่สอบเทียบ ควรมีหน่วยใน label |
| `calibrationItems[].startDate` | body | `YYYY-MM-DD` | No | วันที่เริ่มสอบเทียบ |
| `calibrationItems[].endDate` | body | `YYYY-MM-DD` | No | วันที่สิ้นสุด ต้องไม่ก่อน `startDate` |

### Request Example

```json
{
  "factoryId": "F000123",
  "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
  "calibrationItems": [
    {
      "parameter": "SO2 (ppm)",
      "startDate": "2026-07-01",
      "endDate": "2026-07-02",
      "result": "ผ่าน"
    }
  ]
}
```

### Success Response Fields

`POST` ตอบ `201 Created` เป็น submission summary ส่วนตารางและตัวอย่างด้านล่างเป็น detail response ของ `PATCH` และ `GET`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data.calibrationReport.cemsBrand` | string | Yes | ยังคงอ่านกลับได้ถ้ามีข้อมูลเดิม |
| `data.calibrationItems[].verifierCompany` | string | Yes | ยังคงอ่านกลับได้ถ้ามีข้อมูลเดิม |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": 15,
    "formType": "KWP05",
    "calibrationReport": {
      "cemsBrand": null
    },
    "calibrationItems": [
      {
        "parameter": "SO2 (ppm)",
        "verifierCompany": null
      }
    ]
  }
}
```

### Validation And Business Rules

- `cemsBrand` และ `verifierCompany` เป็น optional/nullable compatibility fields; client ใหม่ไม่จำเป็นต้องส่ง
- attachment metadata ของแต่ละ calibration item ยังคงใช้ contract เดิม

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | payload ไม่ผ่าน validation อื่นของ KWP05 | แก้ payload แล้วส่งใหม่ |

### KWP02/KWP04 summary

- `POST/PATCH /api/v1/kwp-form-submissions/kwp02` และ `kwp04` ยังใช้ contract เดิมสำหรับ `measurementItems[]`
- sample date ของแต่ละรายการยังเป็น `YYYY-MM-DD`
- attachment metadata ต้องมี `attachmentType` และ `originalFileName`; client ควรส่ง metadata อื่นจาก upload response รวมทั้ง `storagePath` กลับมาโดยไม่แก้ค่า

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 13,
    "formType": "KWP02",
    "attachmentCount": 2
  }
}
```

### GET detail endpoints

- `GET /api/v1/kwp-form-submissions/kwp01/:id`
- `GET /api/v1/kwp-form-submissions/kwp02/:id`
- `GET /api/v1/kwp-form-submissions/kwp03/:id`
- `GET /api/v1/kwp-form-submissions/kwp04/:id`
- `GET /api/v1/kwp-form-submissions/kwp05/:id`

- อ่าน detail ของแต่ละ form type ด้วย permission `kwp_forms:view`
- response shape ใช้ `formType` แยก subtype เช่น `issueReport`, `wpmsIssueReport`, `measurementItems`, `calibrationReport`, `calibrationItems`
- KWP01 และ KWP03 จะคืน `totalHours` ได้เมื่อเคยบันทึกแบบ hourly

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "requestNo": "KWP-69-00012",
    "formType": "KWP01",
    "status": "SUBMITTED"
  }
}
```

### POST resubmit endpoints

- `POST /api/v1/kwp-form-submissions/kwp01/:id/resubmit`
- `POST /api/v1/kwp-form-submissions/kwp02/:id/resubmit`
- `POST /api/v1/kwp-form-submissions/kwp03/:id/resubmit`
- `POST /api/v1/kwp-form-submissions/kwp04/:id/resubmit`
- `POST /api/v1/kwp-form-submissions/kwp05/:id/resubmit`

Request fields:

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `note` | body | string | No | หมายเหตุจากผู้ส่งแบบหลังแก้ไข |

Request example:

```json
{
  "note": "แนบเอกสารเพิ่มแล้ว"
}
```

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "status": "SUBMITTED",
    "statusLabel": "แก้ไขแล้ว/รอพิจารณา"
  }
}
```

### `GET /api/v1/kwp-form-submissions/:id/workflow`

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "status": "REVISION_REQUESTED",
    "currentStep": {
      "key": "REVISION_REQUESTED",
      "status": "CURRENT"
    },
    "allowedActions": ["RESUBMIT"]
  }
}
```

### `POST /api/v1/kwp-form-submissions/:id/workflow-actions`

Request fields:

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `action` | body | `REQUEST_REVISION` \| `APPROVE` | Yes | คำสั่ง workflow ที่รองรับปัจจุบัน |
| `revisionReason` | body | string | Conditional | ต้องส่งเมื่อ `action = REQUEST_REVISION` |
| `officerNote` | body | string | No | หมายเหตุเจ้าหน้าที่ |

Request example:

```json
{
  "action": "REQUEST_REVISION",
  "revisionReason": "แนบรายงานผลตรวจเพิ่มเติม"
}
```

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "status": "REVISION_REQUESTED",
    "revisionReason": "แนบรายงานผลตรวจเพิ่มเติม"
  }
}
```

### `GET /api/v1/kwp-form-reports/factories`

Response ใช้สำหรับรายชื่อโรงงานในเมนู กวภ. โดยแต่ละแถวมี `factoryId`, `factoryName`, `newRegistrationNo`, `province` และ `monitoringPointCount`

`factoryName` ใช้ชื่อ current/live POMS จาก active row ล่าสุดใน
`cems_wpms_connected_measurement_points` โดยเรียง `updated_at DESC, id DESC`
เหมือนกันสำหรับผู้ประกอบการและเจ้าหน้าที่ ความแตกต่างระหว่างสองบทบาทมีเฉพาะขอบเขต
โรงงานที่มองเห็นเท่านั้น หากไม่มีชื่อ current/live ให้ fallback ไปยัง
`eligible_factories.factory_name` และ `factories.name` ตามลำดับ

```json
{
  "success": true,
  "data": [
    {
      "factoryId": "F000123",
      "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
      "newRegistrationNo": "10120000325542",
      "province": "นนทบุรี",
      "monitoringPointCount": 1
    }
  ],
  "meta": { "total": 1 }
}
```

### `GET /api/v1/kwp-form-reports/requests`

Query fields:

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `formType` | query | `KWP01`-`KWP05` | No | กรองประเภทฟอร์ม |
| `status` | query | `DRAFT` \| `SUBMITTED` \| `UNDER_REVIEW` \| `APPROVED` \| `REJECTED` \| `REVISION_REQUESTED` \| `CANCELLED` | No | กรองสถานะ |
| `factoryId` | query | string | No | กรองโรงงาน |

Minimal response:

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "requestNo": "KWP-69-00012",
      "formType": "KWP01",
      "statusCode": "SUBMITTED",
      "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด"
    }
  ],
  "meta": { "total": 1 }
}
```

## Business Flow And Explanations

- Client migration checklist:
  - serialize `problemDate` และ `expectedDoneDate` ของ กวภ.01/03 เป็น `YYYY-MM-DDTHH:00:00` เมื่อต้องเก็บชั่วโมง
  - ใช้ `totalHours` จาก detail response สำหรับแสดง duration และ fallback `totalDays` สำหรับข้อมูลเดิม
  - กวภ.03 สามารถละ `measurementTimes` ได้
  - ส่ง multipart `attachmentType` พร้อม `file` ตอน upload; ใส่ type เฉพาะใน metadata หลัง upload ไม่เพียงพอสำหรับเพดาน 10 MB
- Migration เพิ่มคอลัมน์ datetime/hour แบบ nullable และยังคงคอลัมน์ date/day เดิมไว้ ข้อมูลเก่าจึงยังอ่านด้วย date-only fallback โดยไม่มีการ backfill เวลาเที่ยงคืนเทียม
- Deployment ต้องรัน migration `0079` ก่อนเปิดใช้ application version นี้; rollback ต้องย้อน application ก่อนจึงค่อยรัน migration down
- [Endpoint registry owner map](../../ENDPOINTS.md)
- [ขอเชื่อมต่อ](../connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Submission routes | [`kwp-form-submissions.routes.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts) |
| Report routes | [`kwp-form-reports.routes.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.routes.ts) |
| Validators | [`kwp-form-submissions.validator.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.validator.ts), [`kwp-form-reports.validator.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.validator.ts) |
| Public types | [`kwp-form-submissions.types.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.types.ts), [`kwp-form-reports.types.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.types.ts) |
| Repository | [`kwp-form-submissions.repository.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts), [`kwp-form-reports.repository.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.repository.ts) |
| Tests | [`kwp-form-submissions.route.test.ts`](../../../../../backend/tests/unit/kwp-form-submissions.route.test.ts), [`kwp-form-submissions.repository.test.ts`](../../../../../backend/tests/unit/kwp-form-submissions.repository.test.ts), [`kwp-form-duration.test.ts`](../../../../../backend/tests/unit/kwp-form-duration.test.ts), [`kwp-form-attachments.service.test.ts`](../../../../../backend/tests/unit/kwp-form-attachments.service.test.ts), [`kwp-hourly-duration-migration.test.ts`](../../../../../backend/tests/unit/kwp-hourly-duration-migration.test.ts), [`kwp-form-reports.route.test.ts`](../../../../../backend/tests/unit/kwp-form-reports.route.test.ts) |
| Migration | [`0079_add_kwp_hourly_duration_fields.ts`](../../../../../backend/src/db/migrations/0079_add_kwp_hourly_duration_fields.ts) |
