# BOD/COD Online Deviation Report APIs

Base URL: `http://localhost:3000/api/v1`

Authentication: `Authorization: Bearer <access_token>`

Permission: `bod_cod_errors:view`

Data source:

- Factory table uses connected factories from `cems_wpms_connected_measurement_points`.
- Factory enrichment is best effort from `factories`, `eligible_factories`, `provinces`, and `industrial_estates`; missing enrichment does not remove a connected factory from the response.
- Request table uses `bod_cod_deviation_reports`, with measurement count from `bod_cod_deviation_measurements`.
- Workflow actions use `bod_cod_approval_steps` for the current step and `bod_cod_approval_events` for transition history.
- Operator scope `OWN_FACTORY` is filtered through `user_juristics`.
- Officer scope follows the `bod_cod_errors:view` permission scope and `regionalAccess` in the access token.

## Attachment Upload

อัปโหลดไฟล์แนบของแบบ BOD/COD ก่อนบันทึกฟอร์ม เพื่อให้ได้ metadata สำหรับส่งต่อใน `attachments[]` ของ `POST /api/v1/bod-cod-deviation-reports` หรือ `PUT /api/v1/bod-cod-deviation-reports/:id/resubmission`

Link:

```text
POST /api/v1/bod-cod-deviation-reports/attachments
```

Permission:

```text
bod_cod_errors:edit
```

Content type:

```text
multipart/form-data
```

Form fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | File | Yes | ไฟล์รูป JPG/PNG หรือ PDF ขนาดไม่เกิน 5 MB |

cURL:

```bash
curl "http://localhost:3000/api/v1/bod-cod-deviation-reports/attachments" \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@lab-report.pdf"
```

Response:

```json
{
  "success": true,
  "data": {
    "originalFileName": "lab-report.pdf",
    "storedFileName": "8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
    "mimeType": "application/pdf",
    "fileSize": 12000,
    "storagePath": "bod-cod/deviation-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
    "fileUrl": "https://d-poms.diw.go.th/uploads/bod-cod/deviation-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf"
  }
}
```

Storage:

- ไฟล์ถูกเก็บใต้ `UPLOAD_DIR/bod-cod/deviation-attachments/YYYY/MM/<uuid>.<ext>`
- ไฟล์ถูกเสิร์ฟผ่าน static path `UPLOAD_PUBLIC_PATH`
- Response `fileUrl` ใช้แสดง preview/download ได้ แต่ payload บันทึกฟอร์มใช้ `storagePath`, `storedFileName`, `originalFileName`, `mimeType`, และ `fileSize`

## 1. Operator Factory Table

สำหรับตาราง "รายชื่อโรงงาน" ของผู้ประกอบการ

Link:

```text
GET /api/v1/bod-cod-deviation-reports/factories
```

Payload / query parameters:

```text
ไม่มี query parameter ในรอบแรก
```

cURL:

```bash
curl "http://localhost:3000/api/v1/bod-cod-deviation-reports/factories" \
  -H "Authorization: Bearer <access_token>"
```

Response:

ตัวอย่างนี้เป็น response เมื่อเรียกด้วย scope เจ้าหน้าที่; ถ้าเรียกด้วย `OWN_FACTORY` สถานะ pending จะแสดงเป็น `รอพิจารณา` ตามกติกาหน้าผู้ประกอบการ

```json
{
  "success": true,
  "data": [
    {
      "id": "FID-001",
      "factoryId": "FID-001",
      "factoryName": "บริษัท ทดสอบน้ำเสีย จำกัด",
      "factoryRegistration": "10520000225172",
      "newRegistrationNo": "10520000225172",
      "oldRegistrationNo": "3-1-2/17ลป",
      "industryType": "ผลิตอาหารและเครื่องดื่ม",
      "province": "ลำปาง",
      "provinceName": "ลำปาง",
      "regionName": "ภาคเหนือ",
      "industrialEstateName": null,
      "address": "99 หมู่ 1",
      "eligibleFactoryId": 10,
      "monitoringPointCount": 1,
      "measurementPoints": [
        {
          "id": 9,
          "stationId": "P0001",
          "code": "P0001",
          "name": "จุดระบายน้ำทิ้ง A",
          "type": "WPMS",
          "parameters": "BOD, COD",
          "parameterCodes": ["BOD", "COD"],
          "round1Status": "รอพิจารณา",
          "round2Status": "ยังไม่ยื่น",
          "pointCode": "P0001",
          "pointName": "จุดระบายน้ำทิ้ง A",
          "pointType": "WASTEWATER",
          "systemType": "WPMS",
          "reportSlots": [
            {
              "roundNo": 1,
              "year": 2569,
              "status": "SUBMITTED",
              "statusLabel": "รอพิจารณา",
              "reportId": 5,
              "reportNo": "BODCOD-2569-0005"
            },
            {
              "roundNo": 2,
              "year": 2569,
              "status": "NOT_SUBMITTED",
              "statusLabel": "ยังไม่ยื่น",
              "reportId": null,
              "reportNo": null
            }
          ]
        }
      ],
      "latestReportId": 5,
      "latestReportNo": "BODCOD-2569-0005",
      "latestReportStatus": "SUBMITTED",
      "latestReportStatusLabel": "รอพิจารณา"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## 2. Report Request Table

สำหรับตาราง "รายการคำขอ"

Link:

```text
GET /api/v1/bod-cod-deviation-reports
```

Payload / query parameters:

| Query | Required | Values | Description |
|---|---:|---|---|
| `status` | No | `DRAFT`, `SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_RESULT_NOTICE`, `WAITING_REVIEW`, `WAITING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `CANCELLED` | กรองสถานะคำขอ |
| `parameterCode` | No | `BOD`, `COD` | กรอง parameter ที่รายงาน |
| `factoryId` | No | string | กรองโรงงานจาก `factories.id`, `factories.fid`, `factories.code`, หรือ `factory_registration_no` |

cURL:

```bash
curl "http://localhost:3000/api/v1/bod-cod-deviation-reports?status=SUBMITTED&parameterCode=BOD" \
  -H "Authorization: Bearer <access_token>"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "reportNo": "BODCOD-2569-0005",
      "reportRound": "ครั้งที่ 2",
      "reportRoundNo": 2,
      "reportYear": 2569,
      "year": 2569,
      "selectedParameterCode": "BOD",
      "selectedParameterLabel": "BOD (mg/l)",
      "factoryId": "FID-001",
      "factoryName": "บริษัท ทดสอบน้ำเสีย จำกัด",
      "factoryRegistration": "10520000225172",
      "factoryRegistrationNo": "10520000225172",
      "monitoringPointId": 9,
      "monitoringPointCode": "P0001",
      "monitoringPointName": "จุดระบายน้ำทิ้ง A",
      "province": "ลำปาง",
      "provinceName": "ลำปาง",
      "approvalTrack": "REGIONAL",
      "status": "ส่งรายงานแล้ว",
      "statusCode": "SUBMITTED",
      "statusLabel": "ส่งรายงานแล้ว",
      "submittedDate": "01/07/2569",
      "reviewedDate": "-",
      "submittedAt": "2026-07-01T10:00:00.000Z",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "updatedAt": "2026-07-01T10:00:00.000Z",
      "measurementCount": 1,
      "statusHistory": [
        {
          "id": 5,
          "status": "SUBMITTED",
          "statusLabel": "ส่งรายงานแล้ว",
          "note": null,
          "changedById": 42,
          "changedBy": "นาย บรรณณ์ ศิริวัฒน์",
          "changedAt": "2026-07-01T10:00:00.000Z",
          "changedDate": "01/07/2569"
        }
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## 3. Save Deviation Report Form

สำหรับบันทึกแบบ "แบบรายงานผลการตรวจสอบความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ"

Link:

```text
POST /api/v1/bod-cod-deviation-reports
```

Permission:

```text
bod_cod_errors:edit
```

Payload:

```json
{
  "reportRoundNo": 1,
  "reportYear": 2569,
  "factoryId": "FID-001",
  "factoryName": "บริษัท ทดสอบน้ำเสีย จำกัด",
  "factoryRegistrationNo": "10520000225172",
  "businessActivity": "ผลิตอาหารและเครื่องดื่ม",
  "factoryAddress": "99 หมู่ 1",
  "provinceName": "ลำปาง",
  "connectedMeasurementPointId": 9,
  "pointCode": "P0001",
  "pointName": "จุดระบายน้ำทิ้ง A",
  "wastewaterFlowM3PerHour": 120.5,
  "samplerName": "นายเก็บ ตัวอย่าง",
  "officerRegistrationNo": "LAB-001",
  "laboratoryName": "ห้องปฏิบัติการกลาง",
  "laboratoryRegistrationNo": "LAB-REG-001",
  "labReportNo": "LAB-REPORT-001",
  "analysisMethod": "Standard Methods",
  "deviceBrand": "Brand A",
  "deviceModel": "Model B",
  "deviceSerialNo": "SN-001",
  "selectedParameterCode": "BOD",
  "reporterName": "นายรายงาน ผล",
  "reporterPosition": "เจ้าหน้าที่สิ่งแวดล้อม",
  "measurements": [
    {
      "sampleDate": "2026-07-01",
      "sampleTime": "09:30",
      "deviceValueMgL": 12.5,
      "labValueMgL": 10,
      "standardDeviationMgL": 3
    }
  ],
  "attachments": [
    {
      "attachmentType": "LAB_REPORT",
      "originalFileName": "lab-report.pdf",
      "storedFileName": "lab-report-uuid.pdf",
      "mimeType": "application/pdf",
      "fileSize": 12000,
      "storagePath": "bod-cod/deviation-attachments/2026/07/lab-report-uuid.pdf"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "BODCOD-2569-0009",
    "statusCode": "SUBMITTED",
    "approvalTrack": "REGIONAL",
    "currentStep": {
      "id": 15,
      "stepNo": 1,
      "roleCode": "INSPECTOR",
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
        "roleCode": "RESULT_NOTICE",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)",
        "status": "WAITING",
        "isCurrent": false
      },
      {
        "id": 17,
        "stepNo": 3,
        "roleCode": "APPROVER",
        "roleLabel": "ผอ.ศูนย์ (อนุมัติ)",
        "status": "WAITING",
        "isCurrent": false
      }
    ],
    "allowedActions": ["CANCEL"]
  }
}
```

Notes:

- `sampleDate` ใช้รูปแบบ `YYYY-MM-DD`
- `sampleTime` ใช้รูปแบบ `HH:mm`
- `attachmentType` ใช้ค่า `SAMPLE_PHOTO`, `DEVICE_PHOTO`, หรือ `LAB_REPORT`
- ตอนบันทึก ระบบตั้งสถานะเริ่มต้นเป็น `SUBMITTED` และสร้าง approval steps ตาม `provinceName`
- ถ้า token เป็น scope `OWN_FACTORY` ระบบตรวจสิทธิ์กับ `user_juristics` ก่อนบันทึก ไม่เชื่อ `factoryId` จาก payload เพียงอย่างเดียว

## 4. Get Deviation Report Form

สำหรับเรียกดูรายละเอียดแบบฟอร์มที่บันทึกแล้ว พร้อมรายการ measurement, attachment metadata และ workflow steps

Link:

```text
GET /api/v1/bod-cod-deviation-reports/:id
```

Permission:

```text
bod_cod_errors:view
```

cURL:

```bash
curl "http://localhost:3000/api/v1/bod-cod-deviation-reports/9" \
  -H "Authorization: Bearer <access_token>"
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "BODCOD-2569-0009",
    "reportRound": "ครั้งที่ 1",
    "reportRoundNo": 1,
    "reportYear": 2569,
    "year": 2569,
    "selectedParameterCode": "BOD",
    "selectedParameterLabel": "BOD (mg/l)",
    "factoryId": "FID-001",
    "factoryName": "บริษัท ทดสอบน้ำเสีย จำกัด",
    "factoryRegistration": "10520000225172",
    "factoryRegistrationNo": "10520000225172",
    "monitoringPointId": 9,
    "monitoringPointCode": "P0001",
    "monitoringPointName": "จุดระบายน้ำทิ้ง A",
    "province": "ลำปาง",
    "provinceName": "ลำปาง",
    "approvalTrack": "REGIONAL",
    "status": "รอพิจารณา",
    "statusCode": "SUBMITTED",
    "statusLabel": "รอพิจารณา",
    "businessActivity": "ผลิตอาหารและเครื่องดื่ม",
    "factoryAddress": "99 หมู่ 1",
    "wastewaterFlowM3PerHour": 120.5,
    "samplerName": "นายเก็บ ตัวอย่าง",
    "officerRegistrationNo": "LAB-001",
    "laboratoryName": "ห้องปฏิบัติการกลาง",
    "laboratoryRegistrationNo": "LAB-REG-001",
    "labReportNo": "LAB-REPORT-001",
    "analysisMethod": "Standard Methods",
    "deviceBrand": "Brand A",
    "deviceModel": "Model B",
    "deviceSerialNo": "SN-001",
    "reporterName": "นายรายงาน ผล",
    "reporterPosition": "เจ้าหน้าที่สิ่งแวดล้อม",
    "statusHistory": [
      {
        "id": 9,
        "status": "SUBMITTED",
        "statusLabel": "รอพิจารณา",
        "note": null,
        "changedById": 42,
        "changedBy": "นาย บรรณณ์ ศิริวัฒน์",
        "changedAt": "2026-07-01T10:00:00.000Z",
        "changedDate": "01/07/2569"
      },
      {
        "id": 12,
        "status": "REVISION_REQUESTED",
        "statusLabel": "รอโรงงานแก้ไข",
        "note": "กรุณาแก้ไขผลตรวจวัด",
        "changedById": 77,
        "changedBy": "นาง เจ้าหน้าที่ ตรวจสอบ",
        "changedAt": "2026-07-05T10:00:00.000Z",
        "changedDate": "05/07/2569"
      }
    ],
    "measurements": [
      {
        "id": 1,
        "parameterCode": "BOD",
        "sampleDate": "2026-07-01",
        "sampleTime": "09:30",
        "deviceValueMgL": 12.5,
        "labValueMgL": 10,
        "deviationValueMgL": 2.5,
        "standardDeviationMgL": 3,
        "isWithinStandard": true,
        "sortOrder": 1
      }
    ],
    "attachments": [
      {
        "id": 17,
        "attachmentType": "LAB_REPORT",
        "originalFileName": "lab-report.pdf",
        "storedFileName": "lab-report-uuid.pdf",
        "mimeType": "application/pdf",
        "fileSize": 12000,
        "storagePath": "bod-cod/deviation-attachments/2026/07/lab-report-uuid.pdf",
        "fileUrl": "https://d-poms.diw.go.th/uploads/bod-cod/deviation-attachments/2026/07/lab-report-uuid.pdf"
      }
    ],
    "currentStep": {
      "id": 15,
      "stepNo": 1,
      "roleCode": "INSPECTOR",
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
        "roleCode": "RESULT_NOTICE",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)",
        "status": "WAITING",
        "isCurrent": false
      },
      {
        "id": 17,
        "stepNo": 3,
        "roleCode": "APPROVER",
        "roleLabel": "ผอ.ศูนย์ (อนุมัติ)",
        "status": "WAITING",
        "isCurrent": false
      }
    ],
    "allowedActions": ["CANCEL"]
  }
}
```

`statusHistory` ใช้รูปแบบเดียวกับ กวภ.01-05 เพื่อให้หน้า frontend แสดง timeline ได้จาก field เดียวกัน:

| Field | Type | Description |
|---|---|---|
| `statusHistory[].id` | number | `id` ของ event; แถว `SUBMITTED` เริ่มต้นใช้ `report id` เพื่อรองรับรายงานเดิมที่ยังไม่มี event submit |
| `statusHistory[].status` | string | สถานะของ event ใน timeline เช่น `SUBMITTED`, `REVISION_REQUESTED`, `APPROVED`, `REJECTED`; ไม่ใช่ approval step ปัจจุบันของรายงาน |
| `statusHistory[].statusLabel` | string | label ตาม scope ผู้เรียก เช่น operator เห็นสถานะระหว่างพิจารณาเป็น `รอพิจารณา` |
| `statusHistory[].note` | string/null | note จาก workflow action หรือ `null` สำหรับ `SUBMITTED` เริ่มต้น |
| `statusHistory[].changedById` | number/null | user id ผู้ทำรายการ |
| `statusHistory[].changedBy` | string/null | ชื่อผู้ทำรายการจาก `users`; fallback เป็น `username` |
| `statusHistory[].changedAt` | string | ISO datetime |
| `statusHistory[].changedDate` | string | วันที่ไทยรูปแบบ `DD/MM/BBBB` |

หมายเหตุ: `statusHistory` ใช้สำหรับแสดงประวัติเหตุการณ์เหมือน กวภ.01-05 ส่วนสถานะรายงานรวมและ approval step ปัจจุบันยังต้องอ่านจาก `statusCode`, `currentStep`, และ `steps`

## 5. Resubmit Returned Deviation Report Form

สำหรับผู้ประกอบการบันทึกแบบที่เจ้าหน้าที่ส่งกลับให้แก้ไข และส่งกลับเข้าคิวตรวจซ้ำ

Link:

```text
PUT /api/v1/bod-cod-deviation-reports/:id/resubmission
```

Permission:

```text
bod_cod_errors:edit
```

State rule:

- เรียกได้เฉพาะรายงานสถานะ `REVISION_REQUESTED`
- ผู้เรียกต้องเป็นผู้ประกอบการ scope `OWN_FACTORY` และต้องผ่าน `user_juristics` ของโรงงานในรายงานเดิม
- หลังบันทึก ระบบตั้งรายงานเป็น `REVISED_PENDING_REVIEW`
- ถ้าเป็นหน้าผู้ประกอบการ ให้แสดงสถานะรอพิจารณาเป็น `รอพิจารณา` จนกว่ารายงานจะอนุมัติ
- approval steps ถูกเริ่มใหม่ทั้งชุด: step 1 กลับเป็น `PENDING` และ `isCurrent = true`; step อื่นกลับเป็น `WAITING` และ `isCurrent = false`
- การตัดสินเดิมของแต่ละ step ถูกล้างจาก row ปัจจุบัน แต่ event เดิมยังอยู่ใน `bod_cod_approval_events` เพื่อ audit
- ระบบเพิ่ม event action `RESUBMIT_REVISION` พร้อม `revisionNote` ถ้ามี

Payload:

ใช้ payload ฟอร์มทั้งชุดรูปแบบเดียวกับ `POST /api/v1/bod-cod-deviation-reports` และเพิ่ม `revisionNote` ได้แบบ optional

```json
{
  "reportRoundNo": 1,
  "reportYear": 2569,
  "factoryId": "FID-001",
  "factoryName": "บริษัท ทดสอบน้ำเสีย จำกัด",
  "factoryRegistrationNo": "10520000225172",
  "businessActivity": "ผลิตอาหารและเครื่องดื่ม",
  "factoryAddress": "99 หมู่ 1",
  "provinceName": "ลำปาง",
  "connectedMeasurementPointId": 9,
  "pointCode": "P0001",
  "pointName": "จุดระบายน้ำทิ้ง A",
  "wastewaterFlowM3PerHour": 120.5,
  "samplerName": "นายเก็บ ตัวอย่าง",
  "officerRegistrationNo": "LAB-001",
  "laboratoryName": "ห้องปฏิบัติการกลาง",
  "laboratoryRegistrationNo": "LAB-REG-001",
  "labReportNo": "LAB-REPORT-001",
  "analysisMethod": "Standard Methods",
  "deviceBrand": "Brand A",
  "deviceModel": "Model B",
  "deviceSerialNo": "SN-001",
  "selectedParameterCode": "BOD",
  "reporterName": "นายรายงาน ผล",
  "reporterPosition": "เจ้าหน้าที่สิ่งแวดล้อม",
  "revisionNote": "แก้ไขผลตรวจวัดตามข้อสังเกตของเจ้าหน้าที่",
  "measurements": [
    {
      "sampleDate": "2026-07-01",
      "sampleTime": "09:30",
      "deviceValueMgL": 12.5,
      "labValueMgL": 10,
      "standardDeviationMgL": 3
    }
  ],
  "attachments": [
    {
      "attachmentType": "LAB_REPORT",
      "originalFileName": "lab-report.pdf",
      "storedFileName": "lab-report-uuid.pdf",
      "mimeType": "application/pdf",
      "fileSize": 12000,
      "storagePath": "bod-cod/deviation-attachments/2026/07/lab-report-uuid.pdf"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "BODCOD-2569-0009",
    "statusCode": "REVISED_PENDING_REVIEW",
    "approvalTrack": "REGIONAL",
    "currentStep": {
      "id": 15,
      "stepNo": 1,
      "roleCode": "INSPECTOR",
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
        "roleCode": "RESULT_NOTICE",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)",
        "status": "WAITING",
        "isCurrent": false
      },
      {
        "id": 17,
        "stepNo": 3,
        "roleCode": "APPROVER",
        "roleLabel": "ผอ.ศูนย์ (อนุมัติ)",
        "status": "WAITING",
        "isCurrent": false
      }
    ],
    "allowedActions": ["CANCEL"]
  }
}
```

Notes:

- ระบบ replace `bod_cod_deviation_measurements` และ `bod_cod_deviation_attachments` ใน DB ด้วยชุดใหม่ทั้งหมด
- ระบบไม่ลบไฟล์จริงใน storage จาก API นี้; cleanup ไฟล์ orphan ควรทำเป็นงานแยก
- `reportRoundNo`, `reportYear`, `factoryRegistrationNo`, `connectedMeasurementPointId`, `pointCode`, และ `selectedParameterCode` ต้องตรงกับรายงานเดิม เพื่อกันการย้ายรายงานข้ามรอบ/จุดตรวจ/พารามิเตอร์ระหว่าง resubmit
- ถ้ารายงานไม่ได้อยู่สถานะ `REVISION_REQUESTED` จะได้ `409 Conflict`
- ถ้าไม่ใช่โรงงานของผู้ประกอบการ จะได้ `403 Forbidden` หรือ `404 Not Found` ตาม access filter

## 6. Officer Workflow Action

สำหรับเจ้าหน้าที่กด `แจ้งแก้ไข`, `ผ่านพิจารณา`, หรือ `ไม่ผ่านพิจารณา` ใน workflow BOD/COD

Link:

```text
POST /api/v1/bod-cod-deviation-reports/:id/workflow-actions
```

Permission:

```text
bod_cod_errors:approve
```

Action mapping:

| Current status | Scope | Current step | Allowed actions |
|---|---|---|---|
| `SUBMITTED` | เจ้าหน้าที่ | `PENDING` | `APPROVE`, `REQUEST_REVISION`, `REJECT` |
| `REVISED_PENDING_REVIEW` | เจ้าหน้าที่ | `PENDING` | `APPROVE`, `REQUEST_REVISION`, `REJECT` |
| `WAITING_RESULT_NOTICE` | เจ้าหน้าที่ | `PENDING` | `APPROVE`, `REQUEST_REVISION`, `REJECT` |
| `WAITING_REVIEW` | เจ้าหน้าที่ | `PENDING` | `APPROVE`, `REQUEST_REVISION`, `REJECT` |
| `WAITING_APPROVAL` | เจ้าหน้าที่ | `PENDING` | `APPROVE`, `REQUEST_REVISION`, `REJECT` |
| `REVISION_REQUESTED` | ผู้ประกอบการ (`OWN_FACTORY`) | `REVISION_REQUESTED` | `CANCEL` |
| `APPROVED`, `REJECTED`, `CANCELLED` | any | terminal status | none |

ไม่มี action `START_REVIEW` ใน BOD/COD workflow แล้ว ถ้าส่งมา backend จะคืน `400 VALIDATION_ERROR`

Request: request revision

```json
{
  "action": "REQUEST_REVISION",
  "revisionReason": "กรุณาแนบรายงานผลวิเคราะห์จากห้องปฏิบัติการ",
  "officerNote": "เอกสารแนบยังไม่ครบ"
}
```

`revisionReason` บังคับส่งเมื่อ `action = REQUEST_REVISION`

Request: approve

```json
{
  "action": "APPROVE",
  "officerNote": "ข้อมูลถูกต้อง ส่งต่อผู้อนุมัติ"
}
```

Request: reject

```json
{
  "action": "REJECT",
  "officerNote": "ข้อมูลไม่เข้าเงื่อนไขการพิจารณา"
}
```

Response:

คืน workflow state ล่าสุด shape เดียวกับ create/resubmit

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "BODCOD-2569-0009",
    "statusCode": "WAITING_RESULT_NOTICE",
    "approvalTrack": "REGIONAL",
    "currentStep": {
      "id": 16,
      "stepNo": 2,
      "roleCode": "RESULT_NOTICE",
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
        "status": "APPROVED",
        "decision": "APPROVED",
        "comment": "ข้อมูลถูกต้อง ส่งต่อผู้อนุมัติ",
        "isCurrent": false
      },
      {
        "id": 16,
        "stepNo": 2,
        "roleCode": "RESULT_NOTICE",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 17,
        "stepNo": 3,
        "roleCode": "APPROVER",
        "roleLabel": "ผอ.ศูนย์ (อนุมัติ)",
        "status": "WAITING",
        "isCurrent": false
      }
    ],
    "allowedActions": ["APPROVE", "REQUEST_REVISION", "REJECT"]
  }
}
```

Transition rules:

- `APPROVE` ไปยัง step `RESULT_NOTICE`: current step เป็น `APPROVED`, step ถัดไปเป็น `PENDING`, report status เป็น `WAITING_RESULT_NOTICE`
- `APPROVE` ไปยัง step `REVIEWER`: current step เป็น `APPROVED`, step ถัดไปเป็น `PENDING`, report status เป็น `WAITING_REVIEW`
- `APPROVE` ไปยัง step `APPROVER`: current step เป็น `APPROVED`, step ถัดไปเป็น `PENDING`, report status เป็น `WAITING_APPROVAL`
- `APPROVE` ที่ step สุดท้าย: report status เป็น `APPROVED` และ workflow จบ
- `REQUEST_REVISION`: current step เป็น `REVISION_REQUESTED`, report status เป็น `REVISION_REQUESTED`; เมื่อผู้ประกอบการ resubmit จะกลับไป step 1 และไล่ flow ใหม่
- `REJECT`: current step เป็น `REJECTED`, report status เป็น `REJECTED` และ workflow จบ

Error behavior:

| Case | HTTP status | Meaning |
|---|---:|---|
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `bod_cod_errors:approve` | `403` | user ไม่มีสิทธิ์ action เจ้าหน้าที่ |
| `id` ไม่ใช่ positive integer | `400` | path parameter ไม่ถูกต้อง |
| payload ไม่ถูกต้อง เช่น `START_REVIEW` หรือไม่ส่ง `revisionReason` ตอนแจ้งแก้ไข | `400` | validation error |
| action ไม่สอดคล้องกับ status/step ปัจจุบัน | `409` | backend คืน `allowedActions` ใน error details |
| ไม่พบรายการ, รายการถูกลบ, หรืออยู่นอก scope | `404` | ไม่คืนข้อมูลให้ผู้ใช้ |

## Screen Usage

ผู้ประกอบการ:

- Call `GET /api/v1/bod-cod-deviation-reports/factories` for "รายชื่อโรงงาน".
- Call `GET /api/v1/bod-cod-deviation-reports` for "รายการคำขอ".
- Call `POST /api/v1/bod-cod-deviation-reports/attachments` before saving files; use the returned metadata in `attachments[]`.
- Call `POST /api/v1/bod-cod-deviation-reports` to save the BOD/COD deviation form.
- Call `GET /api/v1/bod-cod-deviation-reports/:id` to reopen a saved form.
- Call `PUT /api/v1/bod-cod-deviation-reports/:id/resubmission` to submit a corrected returned form.
- Token should include `bod_cod_errors:view = OWN_FACTORY`.
- Display pending workflow states (`SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_RESULT_NOTICE`, `WAITING_REVIEW`, `WAITING_APPROVAL`) as `รอพิจารณา` until the report becomes `APPROVED`.
- `measurementPoints[].reportSlots[]` returns two current-year slots; the frontend can enable/disable BOD/COD report buttons from those slot statuses.
- Frontend table fields are returned directly: `newRegistrationNo`, `oldRegistrationNo`, `province`, `measurementPoints[].code`, `measurementPoints[].name`, `measurementPoints[].type`, `measurementPoints[].parameters`, `measurementPoints[].round1Status`, and `measurementPoints[].round2Status`.

เจ้าหน้าที่:

- Call only `GET /api/v1/bod-cod-deviation-reports` for "รายการคำขอ".
- Call `POST /api/v1/bod-cod-deviation-reports/:id/workflow-actions` for `แจ้งแก้ไข`, `ผ่านพิจารณา`, and `ไม่ผ่านพิจารณา`.
- Token should include `bod_cod_errors:view` with the officer's menu/data scope.
- Token should include `bod_cod_errors:approve` for workflow actions.
- Officer views can use `statusCode` to distinguish first submission from `REVISED_PENDING_REVIEW`; corrected reports return to step 1 and must be reviewed through the full track again.
- Frontend report table fields are returned directly: `factoryRegistration`, `province`, `reportRound`, `year`, `submittedDate`, `reviewedDate`, and Thai display `status`. Machine status is preserved as `statusCode`.
