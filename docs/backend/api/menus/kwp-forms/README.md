# แจ้งแบบ กวภ. 01 - กวภ. 05

> Owner: Backend

## Frontend Quick Start

เมนูนี้ครอบคลุมการอัปโหลดเอกสารแนบ, การส่งแบบ กวภ.01-กวภ.05, การอ่านรายละเอียดแบบ, workflow review และตารางรายงานคำขอ กรณีวันที่ของ กวภ.01 และ กวภ.03 backend รองรับทั้งรูปแบบ legacy `YYYY-MM-DD` และรูปแบบรายชั่วโมง `YYYY-MM-DDTHH:00:00` แบบ local civil time ของ `Asia/Bangkok` โดย backend จะคำนวณ `totalDays` และ `totalHours` เอง

permission code และ scope ที่อ้างในหน้านี้ใช้ canonical definition เดียวกับ [สิทธิ์การใช้งาน](../permissions/README.md)

### Main Flow

1. อ่านจุดตรวจวัดและข้อมูล prefill ด้วย `GET /api/v1/connected-measurement-points/factories/:factoryId`; สำหรับ กวภ.05 ใช้ `parameterInstrumentDetails[].cemsModel` ตามพารามิเตอร์ที่เลือก
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
| ส่งแบบ กวภ.05 | `POST` | `/api/v1/kwp-form-submissions/kwp05` | Bearer | `kwp_forms:edit` | [KWP05 calibration parameters](#postpatch-kwp05-calibration-parameters-contract) |
| แก้ไขแบบ กวภ.05 | `PATCH` | `/api/v1/kwp-form-submissions/kwp05/:id` | Bearer | `kwp_forms:edit` | [KWP05 calibration parameters](#postpatch-kwp05-calibration-parameters-contract) |
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
| `factoryRegistrationNo` | body | string | No | เลขทะเบียนโรงงานปัจจุบันจาก `newRegistrationNo`; เก็บเป็น submission snapshot และใช้เป็น identifier สำรอง |
| `connectedPointId` | body | positive integer | No | ID จาก `GET /api/v1/connected-measurement-points/factories/:factoryId`; ส่ง `null` หรือ omit ได้เมื่อ endpoint คืน `null` |

ถ้าส่ง `connectedPointId` backend จะตรวจว่าเป็น active row ใน `cems_wpms_connected_measurement_points` และต้องตรงกับ `factoryId` ที่ผ่าน data-scope access control แล้วเท่านั้น ระบบจะไม่ใช้ `factoryRegistrationNo` จาก payload เพื่อขยายสิทธิ์ เพื่อป้องกันการผูกแบบกับจุดตรวจวัดของโรงงานอื่น

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `403` | `FORBIDDEN` | `connectedPointId` ไม่ active หรือไม่ใช่ของโรงงานใน payload | โหลดรายการจุดตรวจวัดใหม่และเลือกจุดของโรงงานปัจจุบัน |

### เลขที่คำขอ `requestNo`

คำขอ กวภ. ที่สร้างใหม่ใช้รูปแบบ
`F{เลขแบบ 2 หลัก}-{รหัสภาค 2 หลัก}-{ลำดับ 4 หลัก}/{ปี พ.ศ. 4 หลัก}`
เช่น `F02-05-0005/2570`

| ส่วน | ความหมาย |
| --- | --- |
| `F01`-`F05` | แบบ กวภ.01-กวภ.05 |
| `02` | ภาคตะวันตก |
| `03` | ภาคตะวันออก |
| `04` | ภาคเหนือ |
| `05` | ภาคใต้ |
| `06` | ภาคตะวันออกเฉียงเหนือ |
| `07` | กฝม. (ภาคกลาง) |
| `0001`-`9999` | running แยกตามแบบ ภาค และปี |
| `2570` | ปี พ.ศ. ตามเวลา `Asia/Bangkok` |

- Backend หา region จากจังหวัดของโรงงานในระบบ ไม่รับรหัสภาคจาก request body
- คำขอใหม่เก็บภาคที่ใช้ออกเลขเป็น snapshot และใช้ snapshot นี้กับสิทธิ์ตามภาคและรายงาน; ข้อมูลเดิมที่ไม่มี snapshot จะ fallback ไปภาคปัจจุบันของโรงงาน
- เมื่อเปลี่ยนปี running ของแต่ละชุด `แบบ + ภาค` เริ่มใหม่ที่ `0001`
- การแก้ไข ส่งกลับหลังแก้ไข หรือยกเลิกคำขอไม่ออกเลขใหม่และไม่นำเลขเดิมกลับมาใช้ซ้ำ
- เลขเดิมรูปแบบ `KWP-YY-NNNNN` ยังคงอ่านและแสดงได้ตามค่าที่บันทึกไว้ โดยไม่มีการเปลี่ยนย้อนหลัง

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `BAD_REQUEST` | ไม่พบโรงงาน จังหวัด หรือภาคที่รองรับสำหรับออกเลข | โหลดข้อมูลโรงงานใหม่และตรวจ master data |
| `409` | `CONFLICT` | running ของแบบ/ภาค/ปีนั้นครบ `9999` แล้ว | แจ้งผู้ดูแลระบบเพื่อกำหนดกติกาเลขชุดถัดไป |

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

### `POST/PATCH` KWP05 calibration parameters contract

ใช้กับ `POST /api/v1/kwp-form-submissions/kwp05` และ `PATCH /api/v1/kwp-form-submissions/kwp05/:id`

`calibrationItems[].parameters` เป็น canonical field สำหรับ client ใหม่ ส่วน
`calibrationItems[].parameter` เป็น legacy compatibility field ทั้งสอง endpoint
ยังรับ payload เดิมได้ และ detail response จะคืนทั้งสอง field เสมอ การเพิ่มนี้เป็น
additive, non-breaking change และไม่บังคับให้ client เดิมย้ายทันที

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:edit`
- Data scope: ตามสิทธิ์ `kwp_forms:edit`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | body | string | Yes | รหัสโรงงานที่ backend ใช้ตรวจ scope |
| `factoryName` | body | string | Yes | ชื่อโรงงาน snapshot |
| `cemsBrand` | body | string | No | legacy field; `null`, empty string หรือ omit ได้ และไม่เกิน 255 ตัวอักษร |
| `calibrationItems` | body | array | Yes | รายการผล calibration 1-100 รายการ; ต้องคงเป็น array แม้ UI ปัจจุบันรับข้อมูลเพียง 1 รายการ |
| `calibrationItems[].parameters` | body | string[] | Conditional | canonical field; ต้องมี 1-100 ค่าเมื่อส่ง แต่ละ label ยาวไม่เกิน 255 ตัวอักษรหลัง trim และต้องระบุหน่วย เช่น `NOx (ppm)` |
| `calibrationItems[].parameter` | body | string | Conditional | legacy field สำหรับ single opaque label เดียว ยาวไม่เกิน 255 ตัวอักษรหลัง trim; ต้องส่ง `parameter` หรือ `parameters` อย่างน้อยหนึ่ง field และเมื่อส่งทั้งคู่ค่านี้ต้องเท่ากับสมาชิกแรกของ `parameters` หลัง normalize |
| `calibrationItems[].cemsModel` | body | string | No | human-readable snapshot/summary ระดับ logical calibration item; `null`, empty string หรือ omit ได้ ไม่เกิน 500 ตัวอักษร และ prefill ได้จาก `parameterInstrumentDetails` ของ connected-point response |
| `calibrationItems[].startDate` | body | `YYYY-MM-DD` | No | วันที่เริ่มสอบเทียบ |
| `calibrationItems[].endDate` | body | `YYYY-MM-DD` | No | วันที่สิ้นสุด ต้องไม่ก่อน `startDate` |
| `calibrationItems[].result` | body | string | No | ผลการสอบเทียบ; trim แล้วไม่เกิน 32 ตัวอักษร และจัดเก็บแบบ Unicode เพื่อคงข้อความภาษาไทย เช่น `ผ่าน` หรือ `ไม่ผ่าน` |
| `calibrationItems[].verifierCompany` | body | string | No | legacy field; `null`, empty string หรือ omit ได้ในแต่ละรายการ และไม่เกิน 500 ตัวอักษร |
| `calibrationItems[].rataReportLink` | body | string | No | ลิงก์รายงาน RATA; `null`, empty string หรือ omit ได้ และข้อความหลัง trim ยาวไม่เกิน 1,000 ตัวอักษร |
| `calibrationItems[].calibrationPhotoLink` | body | string | No | ลิงก์รูปการสอบเทียบ; `null`, empty string หรือ omit ได้ และข้อความหลัง trim ยาวไม่เกิน 1,000 ตัวอักษร |
| `calibrationItems[].attachments` | body | array | No | metadata ไฟล์แนบ 0-20 รายการ; omit แล้ว normalize เป็น `[]` |

Attachment metadata ใน `calibrationItems[].attachments[]`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `attachmentType` | string | Yes | ประเภทไฟล์; trim แล้ว 1-64 ตัวอักษร เช่น `RATA_REPORT` หรือ `CALIBRATION_PHOTO` |
| `originalFileName` | string | Yes | ชื่อไฟล์เดิมจาก upload response; trim แล้ว 1-500 ตัวอักษร |
| `storedFileName` | string | No | ชื่อไฟล์ที่ backend เก็บ; `null` หรือ omit ได้ และไม่เกิน 500 ตัวอักษร |
| `mimeType` | string | No | MIME type จาก upload response; `null` หรือ omit ได้ และไม่เกิน 128 ตัวอักษร |
| `fileSize` | integer | No | ขนาดไฟล์เป็น bytes; ต้องไม่น้อยกว่า 0 และส่ง `null` หรือ omit ได้ |
| `storagePath` | string | No | path จาก upload response; `null` หรือ omit ได้ และไม่เกิน 1,000 ตัวอักษร |

Attachment request เป็น strict object และรับเฉพาะ 6 field ในตารางนี้ ส่วน `id`,
`fileUrl`, `uploadedAt` และ `uploadedBy` เป็น response-only fields; client ต้องตัดออกก่อน
ส่งข้อมูลจาก detail response กลับเข้า `POST` หรือ `PATCH`

### Request Example

```json
{
  "factoryId": "F000123",
  "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
  "calibrationItems": [
    {
      "parameters": ["NOx (ppm)", "SO2 (ppm)"],
      "cemsModel": "CEMS Analyzer A",
      "startDate": "2026-07-01",
      "endDate": "2026-07-02",
      "result": "ผ่าน",
      "rataReportLink": "https://example.com/reports/rata-2026",
      "calibrationPhotoLink": "https://example.com/photos/calibration-2026",
      "attachments": [
        {
          "attachmentType": "RATA_REPORT",
          "originalFileName": "rata-report.pdf",
          "storedFileName": "8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
          "mimeType": "application/pdf",
          "fileSize": 6291456,
          "storagePath": "kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf"
        }
      ]
    }
  ]
}
```

### Success Response Fields

`POST` ตอบ `201 Created` เป็น submission summary ส่วนตารางและตัวอย่างด้านล่างเป็น detail response ของ `PATCH` และ `GET`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data.calibrationReport.cemsBrand` | string | Yes | ยังคงอ่านกลับได้ถ้ามีข้อมูลเดิม |
| `data.calibrationItems[].parameters` | string[] | No | canonical list หลัง trim และตัดค่าซ้ำโดยรักษาลำดับแรก; ข้อมูล legacy จะ fallback เป็น `[parameter]` |
| `data.calibrationItems[].parameter` | string | No | legacy compatibility field ซึ่งเท่ากับสมาชิกแรกของ `parameters` |
| `data.calibrationItems[].result` | string | Yes | ผลการสอบเทียบที่จัดเก็บไว้ คืนข้อความ Unicode ตามค่าที่รับหลัง trim เช่น `ผ่าน` หรือ `ไม่ผ่าน` |
| `data.calibrationItems[].verifierCompany` | string | Yes | ยังคงอ่านกลับได้ถ้ามีข้อมูลเดิม |
| `data.calibrationItems[].rataReportLink` | string | Yes | ลิงก์รายงาน RATA ที่บันทึกไว้ |
| `data.calibrationItems[].calibrationPhotoLink` | string | Yes | ลิงก์รูปการสอบเทียบที่บันทึกไว้ |
| `data.calibrationItems[].attachments` | array | No | attachment DTO; คืน `[]` เมื่อไม่มีไฟล์ และแต่ละรายการมี `id`, request metadata ข้างต้น, `fileUrl`, `uploadedAt`, `uploadedBy` |

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
        "id": 61,
        "parameters": ["NOx (ppm)", "SO2 (ppm)"],
        "parameter": "NOx (ppm)",
        "startDate": "2026-07-01",
        "endDate": "2026-07-02",
        "result": "ผ่าน",
        "verifierCompany": null,
        "cemsModel": "CEMS Analyzer A",
        "rataReportLink": "https://example.com/reports/rata-2026",
        "calibrationPhotoLink": "https://example.com/photos/calibration-2026",
        "attachments": [
          {
            "id": 71,
            "attachmentType": "RATA_REPORT",
            "originalFileName": "rata-report.pdf",
            "storedFileName": "8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
            "mimeType": "application/pdf",
            "fileSize": 6291456,
            "storagePath": "kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
            "fileUrl": "https://example.com/uploads/kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
            "uploadedAt": "2026-07-02T08:30:00.000Z",
            "uploadedBy": 42
          }
        ]
      }
    ]
  }
}
```

### Validation And Business Rules

- `cemsBrand` และ `verifierCompany` เป็น optional/nullable compatibility fields; client ใหม่ไม่จำเป็นต้องส่ง
- Backend trim สมาชิกของ `parameters`, ตัดค่าซ้ำโดยรักษาลำดับการปรากฏครั้งแรก และใช้สมาชิกแรกเป็น `parameter`
- ส่งเฉพาะ `parameters` ได้สำหรับ client ใหม่ หรือส่งเฉพาะ `parameter` ได้สำหรับ client legacy; ถ้าส่งทั้งคู่ `parameter` ต้องเท่ากับ `parameters[0]` หลัง normalize
- `parameter` หมายถึง single opaque label เสมอ backend จะไม่ split ข้อความตาม comma; การส่งหลายค่าต้องใช้ `parameters`
- Backend เก็บ canonical `parameters` สำหรับข้อมูลใหม่หรือข้อมูลที่แก้ไข พร้อมเก็บค่าแรกสำหรับ legacy compatibility; เมื่ออ่านข้อมูลเดิมที่ยังไม่มี canonical list จะคืน `parameters: [parameter]`
- Parameter label ทุกค่าต้องมีหน่วยกำกับ เช่น `NOx (ppm)`, `SO2 (ppm)`, `CO2 (ppm)` หรือ `CO (%)`
- `cemsModel` เป็น optional human-readable snapshot/summary ระดับ logical item ไม่ใช่ machine-readable mapping ต่อ parameter และ backend ไม่ derive ความสัมพันธ์นี้; ถ้า parameter หลายค่าใช้ model ต่างกัน client อาจ trim/dedupe ชื่อ model ที่ตรงกันโดยรักษาลำดับแรก แล้ว join เป็น display string เดียวภายในเพดาน 500 ตัวอักษร
- `calibrationItems` ยังคงเป็น array ใน request/response แม้หน้าจอปัจจุบันสร้างเพียงหนึ่งรายการ เพื่อรองรับ client เดิมและการเพิ่มหลายรายการในอนาคต
- การเพิ่ม `parameters` มีผลกับ request ของ `POST`/`PATCH` และ detail response ของ `PATCH`/`GET`; `POST` ยังคงตอบ submission summary และ client อ่านรายการที่ normalize แล้วผ่าน detail endpoint

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | ไม่ส่งทั้ง `parameter` และ `parameters`, จำนวนสมาชิกไม่อยู่ในช่วง 1-100, มีข้อความว่าง, ส่งทั้งสอง field แต่ค่าแรกไม่ตรงกัน, หรือ payload ไม่ผ่าน validation อื่นของ KWP05 | แก้ payload แล้วส่งใหม่ |

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
- KWP05 คืนทั้ง `calibrationItems[].parameters` และ legacy alias `calibrationItems[].parameter`; ข้อมูลเดิมที่มีเฉพาะค่า legacy จะคืน `parameters: [parameter]`

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "requestNo": "F01-04-0045/2569",
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

การเพิ่ม `calibrationItems[].parameters` ไม่เปลี่ยน resubmit contract: endpoint นี้รับเฉพาะ
`note` เท่านั้น หากต้องแก้ parameter หรือข้อมูลแบบ ต้องเรียก `PATCH` ของ form type
ก่อน แล้วจึงเรียก resubmit; ห้ามแนบ `calibrationItems`, `parameters` หรือ `parameter`
มากับ resubmit payload

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

Response ใช้สำหรับรายชื่อโรงงานในเมนู กวภ. และเป็น source สำหรับ prefill ข้อมูลโรงงานก่อนส่งแบบ

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:view`
- Data scope: ตาม scope ของ permission และพื้นที่ประจำตัวผู้ใช้

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data[].id` | string | No | identifier เดียวกับ `factoryId` |
| `data[].factoryId` | string | No | `factories.fid` ที่ใช้กับ data scope และใช้ส่งแบบ กวภ. |
| `data[].factoryName` | string | No | ชื่อ current/live POMS จาก active connected point ล่าสุด; มี fallback ตามกฎด้านล่าง |
| `data[].newRegistrationNo` | string | No | เลขทะเบียนปัจจุบันจาก `eligible_factories.factory_registration_no_new`; fallback เป็น `factories.fid` และไม่ใช้ `factories.code` ซึ่งเป็นเลขทะเบียนเดิม |
| `data[].oldRegistrationNo` | string | Yes | เลขทะเบียนเดิมจาก `eligible_factories.factory_registration_no_old` |
| `data[].industryType` | string | Yes | รายละเอียดประเภทอุตสาหกรรมจาก factory master |
| `data[].industryMainOrder` | string | Yes | ลำดับหลักที่แยกจาก `factory_type_sequence` |
| `data[].businessActivity` | string | Yes | ประกอบกิจการจากโรงงานที่เข้าข่าย |
| `data[].province` | string | Yes | จังหวัดจาก eligible factory เดียวกับ `newRegistrationNo`; fallback ไป factory master เมื่อไม่มี eligible match |
| `data[].address` | string | Yes | ที่อยู่จากโรงงานที่เข้าข่าย |
| `data[].monitoringPointCount` | integer | No | จำนวน active connected measurement points ของโรงงาน |
| `meta.total` | integer | No | จำนวนโรงงานที่มองเห็นทั้งหมด |

`factoryName` ใช้ชื่อ current/live POMS จาก active row ล่าสุดใน
`cems_wpms_connected_measurement_points` โดยเรียง `updated_at DESC, id DESC`
เหมือนกันสำหรับผู้ประกอบการและเจ้าหน้าที่ ความแตกต่างระหว่างสองบทบาทมีเฉพาะขอบเขต
โรงงานที่มองเห็นเท่านั้น หากไม่มีชื่อ current/live ให้ fallback ไปยัง
`eligible_factories.factory_name` และ `factories.name` ตามลำดับ

ระบบ resolve `eligible_factories` เพียงหนึ่งแถวแบบ deterministic ก่อนนับ connected points เพื่อไม่ให้โรงงานหรือจำนวนจุดซ้ำจาก identifier เก่า/ใหม่ที่ match พร้อมกัน

```json
{
  "success": true,
  "data": [
    {
      "id": "10840002225552",
      "factoryId": "10840002225552",
      "factoryName": "บริษัท พี.ซี.ปาล์ม(2550) จำกัด",
      "newRegistrationNo": "10840002225552",
      "oldRegistrationNo": "3-7(1)-22/55สฎ",
      "industryType": null,
      "industryMainOrder": null,
      "businessActivity": null,
      "province": "สุราษฎร์ธานี",
      "address": null,
      "monitoringPointCount": 1
    }
  ],
  "meta": { "total": 1 }
}
```

### `GET /api/v1/kwp-form-reports/requests`

### Authentication And Permission

- Authentication: required
- Permission: `kwp_forms:view`
- Data scope: ตาม scope ของ permission และพื้นที่ประจำตัวผู้ใช้

Query fields:

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `formType` | query | `KWP01`-`KWP05` | No | กรองประเภทฟอร์ม |
| `status` | query | `DRAFT` \| `SUBMITTED` \| `UNDER_REVIEW` \| `APPROVED` \| `REJECTED` \| `REVISION_REQUESTED` \| `CANCELLED` | No | กรองสถานะ |
| `factoryId` | query | string | No | กรองด้วย factory id, เลขทะเบียนปัจจุบัน หรือเลขทะเบียนเดิมที่ resolve ได้ |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data[].id` | integer | No | ID ของ submission |
| `data[].factoryId` | string | Yes | factory id snapshot ที่เก็บตอนส่งแบบ |
| `data[].factoryName` | string | No | ชื่อ current/live ของ connected point; fallback ไป eligible factory, factory master และ submission snapshot ตามลำดับ |
| `data[].factoryRegistration` | string | Yes | เลขทะเบียนปัจจุบันจาก `eligible_factories.factory_registration_no_new`; fallback ไป `factories.fid`, connected-point snapshot และ submission snapshot ตามลำดับ |
| `data[].oldRegistrationNo` | string | Yes | เลขทะเบียนเดิมจาก eligible factory ที่ resolve ได้ |
| `data[].industryType` | string | Yes | ประเภทอุตสาหกรรม snapshot ตอนส่งแบบ |
| `data[].factoryAddress` | string | Yes | ที่อยู่ snapshot ตอนส่งแบบ |
| `data[].province` | string | Yes | จังหวัดปัจจุบันของ eligible factory เดียวกับ `factoryRegistration`; fallback ไป factory master |
| `data[].type` | string | Yes | `CEMS`, `WPMS` หรือประเภทของจุดตรวจวัด |
| `data[].monitoringPointCode` | string | Yes | รหัสจุดตรวจวัด |
| `data[].monitoringPointName` | string | Yes | ชื่อจุดตรวจวัด |
| `data[].requestNo` | string | No | เลขที่คำขอแบบ opaque string |
| `data[].form` | string | No | ชื่อแสดงผล `กวภ.01`-`กวภ.05` |
| `data[].formType` | enum | No | `KWP01`-`KWP05` |
| `data[].submittedDate` | string | No | วันที่รูปแบบ `DD/MM/YYYY` ปี พ.ศ. หรือ `-` |
| `data[].reviewedDate` | string | No | วันที่รูปแบบ `DD/MM/YYYY` ปี พ.ศ. หรือ `-` |
| `data[].status` | string | No | ป้ายสถานะภาษาไทยสำหรับแสดงผล |
| `data[].statusCode` | enum | No | machine-readable KWP status |
| `data[].revisionNote` | string | Yes | หมายเหตุที่ให้แก้ไขล่าสุด |
| `data[].statusHistory` | object[] | No | timeline สถานะ เรียงตามเวลาและ ID |
| `meta.total` | integer | No | จำนวนคำขอทั้งหมดหลังกรอง โดยไม่นับซ้ำจาก identifier alias |

### Factory Identity Rules

- เมื่อ submission ผูก active connected point ระบบใช้ `connectedPoint.eligible_factory_id` เป็น match แรก จากนั้นจึง fallback ไป identifier ปัจจุบัน/เดิมของ connected point และ submission
- ระบบเลือก eligible factory และ factory master อย่างละไม่เกินหนึ่งแถวด้วยลำดับความสำคัญที่แน่นอน จึงไม่ผสมเลขทะเบียนของโรงงานหนึ่งกับจังหวัดของอีกโรงงานและไม่ทำให้ `meta.total` พองจาก join
- `factoryRegistration`, `oldRegistrationNo` และ `province` อ้างอิง eligible factory เดียวกันเมื่อ resolve ได้
- ค่า snapshot ใน `kwp_form_submissions` ไม่ถูก rewrite: `factoryId`, `industryType` และ `factoryAddress` ยังคงเป็นค่าตอนยื่น ส่วน snapshot ชื่อ/เลขทะเบียนใช้เป็น fallback เมื่อหา current identity ไม่ได้
- การแก้นี้ไม่ต้องใช้ data migration และแก้รายการเดิมทันทีผ่าน read model หลัง deploy

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": 13,
      "factoryId": "10840002225552",
      "factoryName": "บริษัท พี.ซี.ปาล์ม(2550) จำกัด",
      "factoryRegistration": "10840002225552",
      "oldRegistrationNo": "3-7(1)-22/55สฎ",
      "industryType": null,
      "factoryAddress": null,
      "province": "สุราษฎร์ธานี",
      "type": "CEMS",
      "monitoringPointCode": "S1114",
      "monitoringPointName": null,
      "requestNo": "F01-07-0002/2569",
      "form": "กวภ.01",
      "formType": "KWP01",
      "submittedDate": "04/07/2569",
      "reviewedDate": "-",
      "status": "รอพิจารณา",
      "statusCode": "SUBMITTED",
      "revisionNote": null,
      "statusHistory": []
    }
  ],
  "meta": { "total": 1 }
}
```

หลักฐาน regression: [เลขทะเบียนและจังหวัดในตาราง กวภ. ใช้ factory identity เดียวกัน](../../../evidence/kwp-forms/request-table-factory-identity.tdd.md)

## Business Flow And Explanations

- Client migration checklist:
  - ตารางรายชื่อโรงงานให้ส่ง `newRegistrationNo` เป็น `factoryRegistrationNo`; ตารางคำขอให้แสดง `factoryRegistration` เป็นเลขปัจจุบัน และใช้ `oldRegistrationNo` เมื่อต้องแสดงเลขเดิม
  - ใช้ `requestNo` เป็น opaque string และรองรับทั้งเลขเดิม `KWP-YY-NNNNN` กับเลขใหม่ `FNN-RR-NNNN/YYYY`; ห้ามแยกค่าด้วยตำแหน่งจากรูปแบบเดิม
  - serialize `problemDate` และ `expectedDoneDate` ของ กวภ.01/03 เป็น `YYYY-MM-DDTHH:00:00` เมื่อต้องเก็บชั่วโมง
  - ใช้ `totalHours` จาก detail response สำหรับแสดง duration และ fallback `totalDays` สำหรับข้อมูลเดิม
  - กวภ.03 สามารถละ `measurementTimes` ได้
  - กวภ.05 ให้ client ใหม่ส่ง `calibrationItems[].parameters`; อ่าน `parameters` เป็นหลักและใช้ `parameter` เป็น legacy alias เท่านั้น
  - คง `calibrationItems` เป็น array แม้ UI สร้างหนึ่งรายการ และให้ทุก parameter label ระบุหน่วย
  - ส่ง multipart `attachmentType` พร้อม `file` ตอน upload; ใส่ type เฉพาะใน metadata หลัง upload ไม่เพียงพอสำหรับเพดาน 10 MB
- Migration เพิ่มคอลัมน์ datetime/hour แบบ nullable และยังคงคอลัมน์ date/day เดิมไว้ ข้อมูลเก่าจึงยังอ่านด้วย date-only fallback โดยไม่มีการ backfill เวลาเที่ยงคืนเทียม
- Migration `0081` เพิ่ม sequence แยกตามแบบ/ภาค/ปีและ snapshot ข้อมูลที่ใช้ออกเลข โดยไม่แก้ `submission_no` เดิม
- Migration `0092` เพิ่ม `parameters_json` แบบ nullable ให้ calibration item โดยไม่ backfill; ค่า `parameter_name` เดิมยังเป็น fallback และเก็บสมาชิกแรกของ canonical list เพื่อรองรับ client legacy
- Migration `0093` เปลี่ยน `kwp05_calibration_items.result` เป็น `NVARCHAR(32)` เพื่อให้ค่าใหม่ round-trip ภาษาไทยได้ครบ โดยไม่เดาหรือเขียนทับค่า legacy ที่สูญหายเป็น `?` ไปแล้ว
- การแก้ factory identity ของ `kwp-form-reports` เป็น read-model correction: ไม่มี schema/data migration และไม่ rewrite snapshot ใน `kwp_form_submissions`
- Deployment ต้องรัน migrations ถึง `0093` ก่อนเปิดใช้ application version นี้; rollback ต้องย้อน application ก่อนจึงค่อยรัน migration down และ migration `0093` จะปฏิเสธ rollback หากการแปลงกลับเป็น `VARCHAR` ทำให้ข้อมูล Unicode สูญหาย
- [Endpoint registry owner map](../../ENDPOINTS.md)
- [ขอเชื่อมต่อ](../connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Submission routes | [`kwp-form-submissions.routes.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts) |
| Report routes | [`kwp-form-reports.routes.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.routes.ts) |
| Validators | [`kwp-form-submissions.validator.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.validator.ts), [`kwp-form-reports.validator.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.validator.ts) |
| Public types | [`kwp-form-submissions.types.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.types.ts), [`kwp-form-reports.types.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.types.ts) |
| Repository | [`kwp-form-submissions.repository.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts), [`kwp-form-submission-number.ts`](../../../../../backend/src/modules/kwp-form-submissions/kwp-form-submission-number.ts), [`kwp-form-reports.repository.ts`](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.repository.ts) |
| Runtime OpenAPI | [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts) |
| Tests | [`kwp-form-submissions.route.test.ts`](../../../../../backend/tests/unit/kwp-form-submissions.route.test.ts), [`kwp-form-submissions.repository.test.ts`](../../../../../backend/tests/unit/kwp-form-submissions.repository.test.ts), [`kwp-form-submission-number.test.ts`](../../../../../backend/tests/unit/kwp-form-submission-number.test.ts), [`kwp-form-submission-sequence.repository.test.ts`](../../../../../backend/tests/unit/kwp-form-submission-sequence.repository.test.ts), [`kwp-form-submission-create-numbering.repository.test.ts`](../../../../../backend/tests/unit/kwp-form-submission-create-numbering.repository.test.ts), [`kwp-form-duration.test.ts`](../../../../../backend/tests/unit/kwp-form-duration.test.ts), [`kwp-form-attachments.service.test.ts`](../../../../../backend/tests/unit/kwp-form-attachments.service.test.ts), [`kwp-hourly-duration-migration.test.ts`](../../../../../backend/tests/unit/kwp-hourly-duration-migration.test.ts), [`kwp05-calibration-item-parameters-migration.test.ts`](../../../../../backend/tests/unit/kwp05-calibration-item-parameters-migration.test.ts), [`kwp-form-reports.repository.test.ts`](../../../../../backend/tests/unit/kwp-form-reports.repository.test.ts), [`kwp-form-reports.route.test.ts`](../../../../../backend/tests/unit/kwp-form-reports.route.test.ts), [`api-docs.openapi.test.ts`](../../../../../backend/tests/unit/api-docs.openapi.test.ts) |
| Evidence | [`request-table-factory-identity.tdd.md`](../../../evidence/kwp-forms/request-table-factory-identity.tdd.md) |
| Migration | [`0079_add_kwp_hourly_duration_fields.ts`](../../../../../backend/src/db/migrations/0079_add_kwp_hourly_duration_fields.ts), [`0081_create_kwp_form_submission_sequences.ts`](../../../../../backend/src/db/migrations/0081_create_kwp_form_submission_sequences.ts), [`0092_add_kwp05_calibration_item_parameters.ts`](../../../../../backend/src/db/migrations/0092_add_kwp05_calibration_item_parameters.ts) |
