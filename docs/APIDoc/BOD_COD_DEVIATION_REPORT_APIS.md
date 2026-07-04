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
          "round1Status": "ส่งรายงานแล้ว",
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
              "statusLabel": "ส่งรายงานแล้ว",
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
      "latestReportStatusLabel": "ส่งรายงานแล้ว"
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
| `status` | No | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `WAITING_APPROVAL`, `APPROVED`, `REVISION_REQUESTED`, `CANCELLED` | กรองสถานะคำขอ |
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
      "roleLabel": "ผู้ตรวจสอบ",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "ผู้ตรวจสอบ",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
        "roleCode": "APPROVER",
        "roleLabel": "ผู้อนุมัติ (ผอ.ศวภ.)",
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
    "status": "ส่งรายงานแล้ว",
    "statusCode": "SUBMITTED",
    "statusLabel": "ส่งรายงานแล้ว",
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
      "roleLabel": "ผู้ตรวจสอบ",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [
      {
        "id": 15,
        "stepNo": 1,
        "roleCode": "INSPECTOR",
        "roleLabel": "ผู้ตรวจสอบ",
        "status": "PENDING",
        "isCurrent": true
      },
      {
        "id": 16,
        "stepNo": 2,
        "roleCode": "APPROVER",
        "roleLabel": "ผู้อนุมัติ (ผอ.ศวภ.)",
        "status": "WAITING",
        "isCurrent": false
      }
    ],
    "allowedActions": ["CANCEL"]
  }
}
```

## Screen Usage

ผู้ประกอบการ:

- Call `GET /api/v1/bod-cod-deviation-reports/factories` for "รายชื่อโรงงาน".
- Call `GET /api/v1/bod-cod-deviation-reports` for "รายการคำขอ".
- Call `POST /api/v1/bod-cod-deviation-reports` to save the BOD/COD deviation form.
- Call `GET /api/v1/bod-cod-deviation-reports/:id` to reopen a saved form.
- Token should include `bod_cod_errors:view = OWN_FACTORY`.
- `measurementPoints[].reportSlots[]` returns two current-year slots; the frontend can enable/disable BOD/COD report buttons from those slot statuses.
- Frontend table fields are returned directly: `newRegistrationNo`, `oldRegistrationNo`, `province`, `measurementPoints[].code`, `measurementPoints[].name`, `measurementPoints[].type`, `measurementPoints[].parameters`, `measurementPoints[].round1Status`, and `measurementPoints[].round2Status`.

เจ้าหน้าที่:

- Call only `GET /api/v1/bod-cod-deviation-reports` for "รายการคำขอ".
- Token should include `bod_cod_errors:view` with the officer's menu/data scope.
- Frontend report table fields are returned directly: `factoryRegistration`, `province`, `reportRound`, `year`, `submittedDate`, `reviewedDate`, and Thai display `status`. Machine status is preserved as `statusCode`.
