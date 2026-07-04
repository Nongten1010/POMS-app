# KWP Form Submission APIs

API สำหรับบันทึกแบบแจ้ง กวภ.01 - กวภ.05 โดยเอกสารนี้เริ่มจากแบบ **กวภ.01 แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ** และ **กวภ.02 แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย**

Base URL: `/api/v1/kwp-form-submissions`

Auth: `Authorization: Bearer <access_token>`

Permission: `kwp_forms:edit`

## 1. Create KWP01 submission

บันทึกแบบ กวภ.01 เป็นสถานะ `SUBMITTED` ทันที และสร้างประวัติสถานะเริ่มต้นใน `kwp_form_status_history`

```http
POST /api/v1/kwp-form-submissions/kwp01
```

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factoryId` | string | Yes | รหัสโรงงานใน POMS เช่น `fid` หรือเลขทะเบียนใหม่ |
| `factoryName` | string | Yes | ชื่อโรงงาน snapshot ณ วันที่ยื่นแบบ |
| `factoryRegistrationNo` | string\|null | No | เลขทะเบียนโรงงาน snapshot |
| `factoryAddress` | string\|null | No | ที่ตั้งโรงงาน snapshot |
| `industryType` | string\|null | No | ลำดับประเภทโรงงาน snapshot |
| `connectedPointId` | number\|null | No | id ของจุดตรวจวัดที่เชื่อมต่อแล้ว |
| `pointCode` | string\|null | No | รหัสจุดตรวจวัด เช่น `S0001` |
| `pointName` | string\|null | No | ชื่อจุดตรวจวัด |
| `pointType` | string\|null | No | ประเภทจุดตรวจวัด เช่น `STACK` |
| `productionStack` | string\|null | No | ปล่องจากกระบวนการผลิต |
| `primaryFuel` | string\|null | No | เชื้อเพลิงหลัก |
| `secondaryFuel` | string\|null | No | เชื้อเพลิงสำรอง |
| `combustionSystem` | string\|null | No | `ระบบปิด` หรือ `ระบบเปิด` |
| `productionCapacity` | string\|null | No | กำลังการผลิตของหน่วยการผลิต |
| `productionCapacityUnit` | string\|null | No | หน่วยของกำลังการผลิต |
| `contactName` | string\|null | No | รายชื่อผู้ติดต่อ |
| `contactPhone` | string\|null | No | เบอร์โทรศัพท์ |
| `contactEmail` | string\|null | No | อีเมลผู้ติดต่อ |
| `issueReason` | enum | Yes | `เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง` หรือ `หยุดหน่วยการผลิต` |
| `reasonDetail` | string|null | No | รายละเอียดสาเหตุ |
| `problemDate` | `YYYY-MM-DD`|null | No | วันที่พบปัญหาหรือหยุดหน่วยการผลิต |
| `expectedDoneDate` | `YYYY-MM-DD`|null | No | วันที่คาดว่าจะดำเนินการแล้วเสร็จ ต้องไม่ก่อน `problemDate` |
| `totalDays` | number|null | No | รวมระยะเวลาปรับปรุงแก้ไขหรือหยุดหน่วยการผลิต |
| `unreportedParameters` | string[] | Yes | รายการตรวจวัดที่ไม่สามารถรายงานผลได้ เก็บ label พร้อมหน่วย เช่น `NOx (ppm)` |
| `correctiveAction` | string|null | No | แนวทางการปรับปรุงแก้ไข |
| `reporterName` | string|null | No | ชื่อผู้จัดทำรายงาน |
| `reporterPosition` | string|null | No | ตำแหน่งผู้จัดทำรายงาน |

### Example

```json
{
  "factoryId": "FID-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "10190000225448",
  "factoryAddress": "9 หมู่ 9",
  "industryType": "10100 / 3",
  "connectedPointId": 8,
  "pointCode": "S0001",
  "pointName": "ปล่องระบาย A",
  "pointType": "STACK",
  "productionStack": "ปล่อง A",
  "primaryFuel": "ก๊าซธรรมชาติ",
  "secondaryFuel": "น้ำมันเตา",
  "combustionSystem": "ระบบปิด",
  "productionCapacity": "100",
  "productionCapacityUnit": "ตัน/วัน",
  "contactName": "สมชาย ทดสอบ",
  "contactPhone": "0812345678",
  "contactEmail": "operator@example.com",
  "issueReason": "เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง",
  "reasonDetail": "เครื่องวิเคราะห์ก๊าซไม่สามารถส่งข้อมูลได้",
  "problemDate": "2026-07-01",
  "expectedDoneDate": "2026-07-05",
  "totalDays": 5,
  "unreportedParameters": ["NOx (ppm)", "SO2 (ppm)"],
  "correctiveAction": "ซ่อมบำรุงเครื่องมือและตรวจสอบระบบรับส่งข้อมูล",
  "reporterName": "สมชาย ทดสอบ",
  "reporterPosition": "ผู้จัดการสิ่งแวดล้อม"
}
```

### Response

```http
HTTP/1.1 201 Created
Location: /api/v1/kwp-form-reports/requests/12
```

```json
{
  "success": true,
  "data": {
    "id": 12,
    "requestNo": "KWP-69-00012",
    "form": "กวภ.01",
    "formType": "KWP01",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:00:00.000Z"
  }
}
```

### Data source

- `kwp_form_submissions` เก็บหัวฟอร์มและ snapshot ข้อมูลโรงงาน/จุดตรวจวัด/ผู้ติดต่อ/ผู้รายงาน
- `kwp01_issue_reports` เก็บรายละเอียดสาเหตุ วันที่ และแนวทางแก้ไขของแบบ กวภ.01
- `kwp01_unreported_parameters` เก็บรายการพารามิเตอร์ที่ไม่สามารถรายงานผลได้แบบ 1:N
- `kwp_form_status_history` เก็บประวัติสถานะเริ่มต้น `SUBMITTED`

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:edit` | `403` | user ไม่มีสิทธิ์บันทึกแบบ กวภ. |
| ผู้ประกอบการ scope `OWN_FACTORY` ยื่นโรงงานที่ไม่ได้รับสิทธิ์ | `403` | backend ไม่อนุญาตให้ยื่นแทนโรงงานอื่น |
| payload ไม่ถูกต้อง | `400` | validation error เช่น `issueReason` ไม่อยู่ใน enum หรือวันที่แล้วเสร็จก่อนวันที่พบปัญหา |

### Related documents

- ตารางรายงานหลังยื่นแบบ: [`KWP_FORM_REPORT_APIS.md`](./KWP_FORM_REPORT_APIS.md)
- ER/data dictionary เดิม: [`../kwp-forms/04-data-dictionary-er.html`](../kwp-forms/04-data-dictionary-er.html)

## 2. Create KWP02 submission

บันทึกแบบ **กวภ.02 แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย กรณีเครื่องมือหรือเครื่องอุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป** เป็นสถานะ `SUBMITTED` ทันที

```http
POST /api/v1/kwp-form-submissions/kwp02
```

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factoryId` | string | Yes | รหัสโรงงานใน POMS เช่น `fid` หรือเลขทะเบียนใหม่ |
| `factoryName` | string | Yes | ชื่อโรงงาน snapshot ณ วันที่ยื่นแบบ |
| `factoryRegistrationNo` | string|null | No | เลขทะเบียนโรงงาน snapshot |
| `factoryAddress` | string|null | No | ที่ตั้งโรงงาน snapshot |
| `industryType` | string|null | No | ลำดับประเภทโรงงาน snapshot |
| `connectedPointId` | number|null | No | id ของจุดตรวจวัดที่เชื่อมต่อแล้ว |
| `pointCode` | string|null | No | รหัสจุดตรวจวัด เช่น `S0001` |
| `pointName` | string|null | No | ชื่อจุดตรวจวัด |
| `pointType` | string|null | No | ประเภทจุดตรวจวัด เช่น `STACK` |
| `productionStack` | string|null | No | ปล่องจากกระบวนการผลิต |
| `primaryFuel` | string|null | No | เชื้อเพลิงหลัก |
| `secondaryFuel` | string|null | No | เชื้อเพลิงสำรอง |
| `combustionSystem` | string|null | No | `ระบบปิด` หรือ `ระบบเปิด` |
| `productionCapacity` | string|null | No | กำลังการผลิตของหน่วยการผลิต |
| `productionCapacityUnit` | string|null | No | หน่วยของกำลังการผลิต |
| `contactName` | string|null | No | รายชื่อผู้ติดต่อ |
| `contactPhone` | string|null | No | เบอร์โทรศัพท์ |
| `contactEmail` | string|null | No | อีเมลผู้ติดต่อ |
| `measurementItems` | object[] | Yes | รายการตรวจวัดมลพิษอากาศจากปล่องระบาย ต้องมีอย่างน้อย 1 รายการ |
| `measurementItems[].pollutant` | string | Yes | รายการสารมลพิษ ควรมีหน่วยใน label เช่น `NOx (ppm)` |
| `measurementItems[].sampleDate` | `YYYY-MM-DD`\|null | No | วันที่เก็บตัวอย่าง |
| `measurementItems[].measuredValue` | string\|number\|null | No | ค่าที่ตรวจวัดได้ เก็บได้ทั้งตัวเลขและข้อความ เช่น `110.25` หรือ `<5` |
| `measurementItems[].unit` | string\|null | No | หน่วยการตรวจวัด |
| `measurementItems[].laboratoryNo` | string\|null | No | เลขที่ห้องปฏิบัติการ |
| `measurementItems[].reportNo` | string\|null | No | เลขที่รายงาน |
| `measurementItems[].method` | string\|null | No | วิธีการตรวจวัดวิเคราะห์ |
| `measurementItems[].attachments` | object[] | No | ไฟล์แนบของรายการตรวจวัดนั้น ๆ |
| `measurementItems[].attachments[].attachmentType` | string | Yes | ประเภทไฟล์ เช่น `SAMPLING_PHOTO`, `LAB_REPORT` |
| `measurementItems[].attachments[].originalFileName` | string | Yes | ชื่อไฟล์เดิมจากผู้ใช้ |
| `measurementItems[].attachments[].storedFileName` | string\|null | No | ชื่อไฟล์ที่ระบบจัดเก็บจริง |
| `measurementItems[].attachments[].mimeType` | string\|null | No | MIME type เช่น `image/jpeg`, `application/pdf` |
| `measurementItems[].attachments[].fileSize` | number\|null | No | ขนาดไฟล์เป็น byte |
| `measurementItems[].attachments[].storagePath` | string\|null | No | path หรือ object key ที่ backend/storage ใช้ดึงไฟล์ |
| `reporterName` | string\|null | No | ชื่อผู้จัดทำรายงาน |
| `reporterPosition` | string\|null | No | ตำแหน่งผู้จัดทำรายงาน |

> หมายเหตุ: endpoint นี้รับ metadata ของไฟล์แนบที่ถูกจัดเก็บแล้ว ไม่รับ binary multipart โดยตรงในรอบนี้

### Example

```json
{
  "factoryId": "FID-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "10190000225448",
  "factoryAddress": "9 หมู่ 9",
  "industryType": "10100 / 3",
  "connectedPointId": 8,
  "pointCode": "S0001",
  "pointName": "ปล่องระบาย A",
  "pointType": "STACK",
  "productionStack": "ปล่อง A",
  "primaryFuel": "ก๊าซธรรมชาติ",
  "secondaryFuel": "น้ำมันเตา",
  "combustionSystem": "ระบบปิด",
  "productionCapacity": "100",
  "productionCapacityUnit": "ตัน/วัน",
  "contactName": "สมชาย ทดสอบ",
  "contactPhone": "0812345678",
  "contactEmail": "operator@example.com",
  "measurementItems": [
    {
      "pollutant": "NOx (ppm)",
      "sampleDate": "2026-07-01",
      "measuredValue": "110.25",
      "unit": "ppm",
      "laboratoryNo": "LAB-001",
      "reportNo": "RPT-001",
      "method": "USEPA Method 7E",
      "attachments": [
        {
          "attachmentType": "SAMPLING_PHOTO",
          "originalFileName": "sampling-photo.jpg",
          "storedFileName": "13-sampling-photo.jpg",
          "mimeType": "image/jpeg",
          "fileSize": 120000,
          "storagePath": "/uploads/kwp/13-sampling-photo.jpg"
        },
        {
          "attachmentType": "LAB_REPORT",
          "originalFileName": "lab-report.pdf",
          "storedFileName": "13-lab-report.pdf",
          "mimeType": "application/pdf",
          "fileSize": 880000,
          "storagePath": "/uploads/kwp/13-lab-report.pdf"
        }
      ]
    },
    {
      "pollutant": "SO2 (ppm)",
      "sampleDate": "2026-07-01",
      "measuredValue": "<5",
      "unit": "ppm",
      "laboratoryNo": "LAB-002",
      "reportNo": "RPT-002",
      "method": "USEPA Method 6C",
      "attachments": [
        {
          "attachmentType": "LAB_REPORT",
          "originalFileName": "lab-report-so2.pdf",
          "mimeType": "application/pdf",
          "fileSize": 640000,
          "storagePath": "/uploads/kwp/13-lab-report-so2.pdf"
        }
      ]
    }
  ],
  "reporterName": "สมชาย ทดสอบ",
  "reporterPosition": "ผู้จัดการสิ่งแวดล้อม"
}
```

### Response

```http
HTTP/1.1 201 Created
Location: /api/v1/kwp-form-reports/requests/13
```

```json
{
  "success": true,
  "data": {
    "id": 13,
    "requestNo": "KWP-69-00013",
    "form": "กวภ.02",
    "formType": "KWP02",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:15:00.000Z",
    "measurementItemCount": 2,
    "attachmentCount": 3
  }
}
```

### Data source and stored columns

| Table | Columns used | Meaning |
| --- | --- | --- |
| `kwp_form_submissions` | `id`, `submission_no`, `form_type`, `status`, `factory_id`, `factory_name`, `factory_registration_no`, `factory_address`, `industry_type`, `connected_point_id`, `point_code`, `point_name`, `point_type`, `production_stack`, `primary_fuel`, `secondary_fuel`, `combustion_system`, `production_capacity`, `production_capacity_unit`, `contact_name`, `contact_phone`, `contact_email`, `reporter_name`, `reporter_position`, `submitted_at`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` | หัวฟอร์มกลางและ snapshot โรงงาน/จุดตรวจวัด/ผู้ติดต่อ/ผู้รายงาน |
| `kwp_emission_measurement_items` | `id`, `submission_id`, `pollutant`, `sample_date`, `measured_value`, `measured_value_text`, `unit`, `laboratory_no`, `report_no`, `method`, `sort_order` | รายการตรวจวัดมลพิษอากาศจากปล่องระบายของแบบ กวภ.02 |
| `kwp_form_attachments` | `id`, `submission_id`, `related_table`, `related_id`, `attachment_type`, `original_file_name`, `stored_file_name`, `mime_type`, `file_size`, `storage_path`, `uploaded_at`, `uploaded_by`, `deleted_at` | ไฟล์แนบ โดยไฟล์ระดับรายการตรวจวัดจะเก็บ `related_table = "kwp_emission_measurement_items"` และ `related_id = kwp_emission_measurement_items.id` |
| `kwp_form_status_history` | `id`, `submission_id`, `status`, `note`, `changed_by`, `changed_at` | ประวัติสถานะเริ่มต้น `SUBMITTED` |

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:edit` | `403` | user ไม่มีสิทธิ์บันทึกแบบ กวภ. |
| ผู้ประกอบการ scope `OWN_FACTORY` ยื่นโรงงานที่ไม่ได้รับสิทธิ์ | `403` | backend ไม่อนุญาตให้ยื่นแทนโรงงานอื่น |
| payload ไม่ถูกต้อง | `400` | validation error เช่นไม่มี `measurementItems`, วันที่ไม่ใช่ `YYYY-MM-DD`, หรือไฟล์แนบไม่มี `attachmentType`/`originalFileName` |
