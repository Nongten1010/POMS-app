# BOD/COD Online Deviation Report APIs

Base URL: `http://localhost:3000/api/v1`

Authentication: `Authorization: Bearer <access_token>`

Permission: `bod_cod_errors:view`

Data source:

- Factory table uses connected factories from `cems_wpms_connected_measurement_points`.
- Factory enrichment is best effort from `factories`, `eligible_factories`, `provinces`, and `industrial_estates`; missing enrichment does not remove a connected factory from the response.
- Request table uses `bod_cod_deviation_reports`, with measurement count from `bod_cod_deviation_measurements`.
- Operator scope `OWN_FACTORY` is filtered through `user_juristics`.
- Officer scope follows the `bod_cod_errors:view` permission scope and `regionalAccess` in the access token.

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
| `status` | No | `DRAFT`, `SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_APPROVAL`, `APPROVED`, `REVISION_REQUESTED`, `CANCELLED` | กรองสถานะคำขอ |
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
      "measurementCount": 1
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
      "storagePath": "uploads/bod-cod/lab-report-uuid.pdf"
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
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
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
    "attachments": [],
    "currentStep": {
      "id": 15,
      "stepNo": 1,
      "roleCode": "INSPECTOR",
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
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
      "storagePath": "uploads/bod-cod/lab-report-uuid.pdf"
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
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
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

## Screen Usage

ผู้ประกอบการ:

- Call `GET /api/v1/bod-cod-deviation-reports/factories` for "รายชื่อโรงงาน".
- Call `GET /api/v1/bod-cod-deviation-reports` for "รายการคำขอ".
- Call `POST /api/v1/bod-cod-deviation-reports` to save the BOD/COD deviation form.
- Call `GET /api/v1/bod-cod-deviation-reports/:id` to reopen a saved form.
- Call `PUT /api/v1/bod-cod-deviation-reports/:id/resubmission` to submit a corrected returned form.
- Token should include `bod_cod_errors:view = OWN_FACTORY`.
- Display pending workflow states (`SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_APPROVAL`) as `รอพิจารณา` until the report becomes `APPROVED`.
- `measurementPoints[].reportSlots[]` returns two current-year slots; the frontend can enable/disable BOD/COD report buttons from those slot statuses.
- Frontend table fields are returned directly: `newRegistrationNo`, `oldRegistrationNo`, `province`, `measurementPoints[].code`, `measurementPoints[].name`, `measurementPoints[].type`, `measurementPoints[].parameters`, `measurementPoints[].round1Status`, and `measurementPoints[].round2Status`.

เจ้าหน้าที่:

- Call only `GET /api/v1/bod-cod-deviation-reports` for "รายการคำขอ".
- Token should include `bod_cod_errors:view` with the officer's menu/data scope.
- Officer views can use `statusCode` to distinguish first submission from `REVISED_PENDING_REVIEW`; corrected reports return to step 1 and must be reviewed through the full track again.
- Frontend report table fields are returned directly: `factoryRegistration`, `province`, `reportRound`, `year`, `submittedDate`, `reviewedDate`, and Thai display `status`. Machine status is preserved as `statusCode`.
