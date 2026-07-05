# KWP Form Submission APIs

API สำหรับบันทึกแบบแจ้ง กวภ.01 - กวภ.05 โดยเอกสารนี้ครอบคลุมแบบ **กวภ.01 แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ**, **กวภ.02 แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย**, และ **กวภ.03 แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางน้ำแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)**

Base URL: `/api/v1/kwp-form-submissions`

Auth: `Authorization: Bearer <access_token>`

Permission:

- Create/upload: `kwp_forms:edit`
- Read detail: `kwp_forms:view`
- Read workflow: `kwp_forms:view`
- Change workflow status: `kwp_forms:approve`

## 0. Upload KWP attachment

อัปโหลดไฟล์แนบของแบบ กวภ. เพื่อให้ได้ metadata สำหรับส่งต่อใน payload บันทึกฟอร์ม เช่น `measurementItems[].attachments[]` ของ กวภ.02/กวภ.04 หรือ `calibrationItems[].attachments[]` ของ กวภ.05

```http
POST /api/v1/kwp-form-submissions/attachments
Content-Type: multipart/form-data
```

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | file | Yes | รองรับ `.jpg`, `.jpeg`, `.png`, `.pdf` ขนาดไม่เกิน 5 MB |

### Response

```http
HTTP/1.1 201 Created
```

```json
{
  "success": true,
  "data": {
    "originalFileName": "lab-report.pdf",
    "storedFileName": "8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
    "mimeType": "application/pdf",
    "fileSize": 640000,
    "storagePath": "kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf",
    "fileUrl": "https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/8ddfb2e2-5f37-4398-b032-f9db1972df70.pdf"
  }
}
```

### Storage behavior

- Backend รับไฟล์ด้วย `multer.memoryStorage()` เหมือน endpoint เอกสารของคำขอเชื่อมต่อ CEMS/WPMS
- ไฟล์ถูกเก็บใต้ `UPLOAD_DIR/kwp/form-attachments/YYYY/MM/<uuid>.<ext>`
- ไฟล์ถูกเสิร์ฟผ่าน static path `UPLOAD_PUBLIC_PATH`
- Response `fileUrl` ใช้แสดง preview/download ฝั่ง frontend ได้ แต่การบันทึก กวภ.02/กวภ.03/กวภ.04/กวภ.05 ใช้ `storagePath`, `storedFileName`, `originalFileName`, `mimeType`, และ `fileSize`

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

> หมายเหตุ: frontend ต้องอัปโหลดไฟล์ผ่าน `POST /api/v1/kwp-form-submissions/attachments` ก่อน แล้วนำ metadata ที่ได้มาใส่ใน `measurementItems[].attachments[]`

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
| `kwp_emission_measurement_items` | `id`, `submission_id`, `pollutant`, `sample_date`, `measured_value`, `measured_value_text`, `unit`, `laboratory_no`, `report_no`, `method`, `sort_order` | รายการตรวจวัดมลพิษอากาศจากปล่องระบายของแบบ กวภ.02 และ กวภ.04 |
| `kwp_form_attachments` | `id`, `submission_id`, `related_table`, `related_id`, `attachment_type`, `original_file_name`, `stored_file_name`, `mime_type`, `file_size`, `storage_path`, `uploaded_at`, `uploaded_by`, `deleted_at` | ไฟล์แนบ โดยไฟล์ระดับรายการตรวจวัดจะเก็บ `related_table = "kwp_emission_measurement_items"` และ `related_id = kwp_emission_measurement_items.id` |
| `kwp_form_status_history` | `id`, `submission_id`, `status`, `note`, `changed_by`, `changed_at` | ประวัติสถานะเริ่มต้น `SUBMITTED` |

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:edit` | `403` | user ไม่มีสิทธิ์บันทึกแบบ กวภ. |
| ผู้ประกอบการ scope `OWN_FACTORY` ยื่นโรงงานที่ไม่ได้รับสิทธิ์ | `403` | backend ไม่อนุญาตให้ยื่นแทนโรงงานอื่น |
| payload ไม่ถูกต้อง | `400` | validation error เช่นไม่มี `measurementItems`, วันที่ไม่ใช่ `YYYY-MM-DD`, หรือไฟล์แนบไม่มี `attachmentType`/`originalFileName` |

## 3. Create KWP03 submission

บันทึกแบบ **กวภ.03 แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางน้ำแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)** เป็นสถานะ `SUBMITTED` ทันที

```http
POST /api/v1/kwp-form-submissions/kwp03
```

### Request body

ใช้ field snapshot โรงงาน/จุดตรวจวัด/ผู้ติดต่อ/ผู้รายงานชุดเดียวกับ กวภ.01/02 และมี field เฉพาะ WPMS ดังนี้

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `instruments` | string[] | Yes | เครื่องตรวจวัด เช่น `ค่าบีโอดี (BOD)`, `ค่าซีโอดี (COD)` |
| `measurementTimes` | string[] | Yes | เวลาเครื่องตรวจวัด เช่น `Real Time`, `15 นาที` |
| `wastewaterSource` | string|null | No | แหล่งกำเนิดน้ำเสีย |
| `receivingSource` | string|null | No | แหล่งรองรับน้ำทิ้ง |
| `treatmentSystemType` | string|null | No | ประเภทระบบบำบัดน้ำเสีย |
| `dischargePoint` | string|null | No | จุดหรือพิกัดระบายน้ำทิ้ง |
| `averageDischarge` | string\|number|null | No | ปริมาณน้ำทิ้งวันที่ขัดข้อง เฉลี่ย (ลบ.ม./วัน) |
| `minimumDischarge` | string\|number|null | No | ปริมาณน้ำทิ้งวันที่ขัดข้อง ต่ำสุด (ลบ.ม./วัน) |
| `maximumDischarge` | string\|number|null | No | ปริมาณน้ำทิ้งวันที่ขัดข้อง สูงสุด (ลบ.ม./วัน) |
| `issueReasons` | enum[] | Yes | `เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง`, `ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน`, `ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง` |
| `reasonDetail` | string|null | No | รายละเอียดสาเหตุ |
| `problemDate` | `YYYY-MM-DD`\|null | No | วันที่พบปัญหาหรือหยุดส่งข้อมูล |
| `expectedDoneDate` | `YYYY-MM-DD`\|null | No | วันที่คาดว่าจะดำเนินการแล้วเสร็จ ต้องไม่ก่อน `problemDate` |
| `totalDays` | number|null | No | รวมระยะเวลาปรับปรุงแก้ไขหรือหยุดส่งข้อมูล |
| `failedParameters` | string[] | Yes | รายการตรวจวัดที่ไม่สามารถรายงานผลได้ ควรส่ง label พร้อมหน่วย เช่น `BOD (mg/l)`, `COD (mg/l)` |
| `correctiveAction` | string|null | No | แนวทางการปรับปรุงแก้ไข |
| `attachments` | object[] | No | ไฟล์แนบระดับรายงาน WPMS ที่ได้จาก `POST /attachments` |
| `attachments[].attachmentType` | string | Yes | ประเภทไฟล์ เช่น `WPMS_EVIDENCE`, `REPAIR_PLAN` |
| `attachments[].originalFileName` | string | Yes | ชื่อไฟล์เดิมจากผู้ใช้ |
| `attachments[].storedFileName` | string|null | No | ชื่อไฟล์ที่ระบบจัดเก็บจริง |
| `attachments[].mimeType` | string|null | No | MIME type เช่น `application/pdf` |
| `attachments[].fileSize` | number|null | No | ขนาดไฟล์เป็น byte |
| `attachments[].storagePath` | string|null | No | path หรือ object key ที่ backend/storage ใช้ดึงไฟล์ |

> หมายเหตุ: frontend ต้องอัปโหลดไฟล์ผ่าน `POST /api/v1/kwp-form-submissions/attachments` ก่อน แล้วนำ metadata ที่ได้มาใส่ใน `attachments[]`

### Example payload

```json
{
  "factoryId": "FID-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "10190000225448",
  "factoryAddress": "9 หมู่ 9",
  "industryType": "10100 / 3",
  "connectedPointId": 8,
  "pointCode": "P0001",
  "pointName": "จุดระบายน้ำทิ้ง A",
  "pointType": "WATER",
  "contactName": "สมชาย ทดสอบ",
  "contactPhone": "0812345678",
  "contactEmail": "operator@example.com",
  "instruments": ["ค่าบีโอดี (BOD)", "ค่าซีโอดี (COD)"],
  "measurementTimes": ["Real Time", "15 นาที"],
  "wastewaterSource": "ระบบบำบัดน้ำเสียส่วนกลาง",
  "receivingSource": "คลองสาธารณะ",
  "treatmentSystemType": "ระบบตะกอนเร่ง",
  "dischargePoint": "UTM 123456, 987654",
  "averageDischarge": 125.5,
  "minimumDischarge": 100.25,
  "maximumDischarge": 150.75,
  "issueReasons": [
    "เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง",
    "ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง"
  ],
  "reasonDetail": "สัญญาณเครือข่ายขัดข้องและต้องเปลี่ยนอุปกรณ์ตรวจวัด",
  "problemDate": "2026-07-01",
  "expectedDoneDate": "2026-07-05",
  "totalDays": 5,
  "failedParameters": ["BOD (mg/l)", "COD (mg/l)"],
  "correctiveAction": "เปลี่ยนอุปกรณ์และทดสอบการส่งข้อมูล WPMS",
  "attachments": [
    {
      "attachmentType": "WPMS_EVIDENCE",
      "originalFileName": "wpms-evidence.pdf",
      "storedFileName": "16-wpms-evidence.pdf",
      "mimeType": "application/pdf",
      "fileSize": 760000,
      "storagePath": "/uploads/kwp/16-wpms-evidence.pdf"
    }
  ],
  "reporterName": "สมชาย ทดสอบ",
  "reporterPosition": "ผู้จัดการสิ่งแวดล้อม"
}
```

### Response

```http
HTTP/1.1 201 Created
Location: /api/v1/kwp-form-reports/requests/16
```

```json
{
  "success": true,
  "data": {
    "id": 16,
    "requestNo": "KWP-69-00016",
    "form": "กวภ.03",
    "formType": "KWP03",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:20:00.000Z",
    "attachmentCount": 1
  }
}
```

### Tables and columns

| Table | Columns used | Meaning |
| --- | --- | --- |
| `kwp_form_submissions` | `id`, `submission_no`, `form_type`, `status`, `factory_id`, `factory_name`, `factory_registration_no`, `factory_address`, `industry_type`, `connected_point_id`, `point_code`, `point_name`, `point_type`, `contact_name`, `contact_phone`, `contact_email`, `reporter_name`, `reporter_position`, `submitted_at`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` | หัวฟอร์มกลางและ snapshot โรงงาน/จุดตรวจวัด/ผู้ติดต่อ/ผู้รายงาน โดย `form_type = KWP03` |
| `kwp03_wpms_issue_reports` | `id`, `submission_id`, `wastewater_source`, `receiving_source`, `treatment_system_type`, `discharge_point`, `average_discharge`, `minimum_discharge`, `maximum_discharge`, `reason_detail`, `problem_date`, `expected_done_date`, `total_days`, `corrective_action` | รายละเอียดเหตุขัดข้องหรือหยุดส่งข้อมูล WPMS |
| `kwp03_selected_options` | `id`, `submission_id`, `option_group`, `option_value`, `sort_order` | ตัวเลือกหลายค่า แยกกลุ่ม `INSTRUMENT`, `MEASUREMENT_TIME`, `ISSUE_REASON`, `FAILED_PARAMETER` |
| `kwp_form_attachments` | `id`, `submission_id`, `related_table`, `related_id`, `attachment_type`, `original_file_name`, `stored_file_name`, `mime_type`, `file_size`, `storage_path`, `uploaded_at`, `uploaded_by`, `deleted_at` | ไฟล์แนบ กวภ.03 เก็บ `related_table = "kwp03_wpms_issue_reports"` และ `related_id = kwp03_wpms_issue_reports.id` |
| `kwp_form_status_history` | `id`, `submission_id`, `status`, `note`, `changed_by`, `changed_at` | ประวัติสถานะเริ่มต้น `SUBMITTED` |

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:edit` | `403` | user ไม่มีสิทธิ์บันทึกแบบ กวภ. |
| ผู้ประกอบการ scope `OWN_FACTORY` ยื่นโรงงานที่ไม่ได้รับสิทธิ์ | `403` | backend ไม่อนุญาตให้ยื่นแทนโรงงานอื่น |
| payload ไม่ถูกต้อง | `400` | validation error เช่นไม่มี `issueReasons`, ไม่มี `failedParameters`, วันที่แล้วเสร็จก่อนวันที่พบปัญหา หรือไฟล์แนบไม่มี `attachmentType`/`originalFileName` |

## 4. Create KWP04 submission

บันทึกแบบ **กวภ.04 แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย กรณีได้รับการยกเว้นการติดตั้ง CEMS** เป็นสถานะ `SUBMITTED` ทันที โดยใช้ payload และตารางจัดเก็บรายการตรวจวัด/ไฟล์แนบชุดเดียวกับ กวภ.02

```http
POST /api/v1/kwp-form-submissions/kwp04
```

### Request body

ใช้ field เดียวกับ `POST /api/v1/kwp-form-submissions/kwp02`

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
| `measurementItems[].pollutant` | string | Yes | รายการสารมลพิษ ควรมีหน่วยใน label เช่น `CO (ppm)` |
| `measurementItems[].sampleDate` | `YYYY-MM-DD`\|null | No | วันที่เก็บตัวอย่าง |
| `measurementItems[].measuredValue` | string\|number\|null | No | ค่าที่ตรวจวัดได้ เก็บได้ทั้งตัวเลขและข้อความ เช่น `12.5` หรือ `<5` |
| `measurementItems[].unit` | string\|null | No | หน่วยการตรวจวัด |
| `measurementItems[].laboratoryNo` | string\|null | No | เลขที่ห้องปฏิบัติการ |
| `measurementItems[].reportNo` | string\|null | No | เลขที่รายงาน |
| `measurementItems[].method` | string\|null | No | วิธีการตรวจวัดวิเคราะห์ |
| `measurementItems[].attachments` | object[] | No | ไฟล์แนบของรายการตรวจวัดนั้น ๆ |
| `measurementItems[].attachments[].attachmentType` | string | Yes | ประเภทไฟล์ เช่น `SAMPLING_PHOTO`, `LAB_REPORT` |
| `measurementItems[].attachments[].originalFileName` | string | Yes | ชื่อไฟล์เดิมจากผู้ใช้ |
| `measurementItems[].attachments[].storedFileName` | string|null | No | ชื่อไฟล์ที่ระบบจัดเก็บจริง |
| `measurementItems[].attachments[].mimeType` | string|null | No | MIME type เช่น `image/jpeg`, `application/pdf` |
| `measurementItems[].attachments[].fileSize` | number|null | No | ขนาดไฟล์เป็น byte |
| `measurementItems[].attachments[].storagePath` | string|null | No | path หรือ object key ที่ backend/storage ใช้ดึงไฟล์ |
| `reporterName` | string|null | No | ชื่อผู้จัดทำรายงาน |
| `reporterPosition` | string|null | No | ตำแหน่งผู้จัดทำรายงาน |

> หมายเหตุ: frontend ต้องอัปโหลดไฟล์ผ่าน `POST /api/v1/kwp-form-submissions/attachments` ก่อน แล้วนำ metadata ที่ได้มาใส่ใน `measurementItems[].attachments[]`

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
      "pollutant": "CO (ppm)",
      "sampleDate": "2026-07-02",
      "measuredValue": "12.5",
      "unit": "ppm",
      "laboratoryNo": "LAB-004",
      "reportNo": "RPT-004",
      "method": "USEPA Method 10",
      "attachments": [
        {
          "attachmentType": "LAB_REPORT",
          "originalFileName": "kwp04-lab-report.pdf",
          "storedFileName": "14-kwp04-lab-report.pdf",
          "mimeType": "application/pdf",
          "fileSize": 940000,
          "storagePath": "/uploads/kwp/14-kwp04-lab-report.pdf"
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
Location: /api/v1/kwp-form-reports/requests/14
```

```json
{
  "success": true,
  "data": {
    "id": 14,
    "requestNo": "KWP-69-00014",
    "form": "กวภ.04",
    "formType": "KWP04",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:30:00.000Z",
    "measurementItemCount": 1,
    "attachmentCount": 1
  }
}
```

### Data source and stored columns

| Table | Columns used | Meaning |
| --- | --- | --- |
| `kwp_form_submissions` | `id`, `submission_no`, `form_type`, `status`, `factory_id`, `factory_name`, `factory_registration_no`, `factory_address`, `industry_type`, `connected_point_id`, `point_code`, `point_name`, `point_type`, `production_stack`, `primary_fuel`, `secondary_fuel`, `combustion_system`, `production_capacity`, `production_capacity_unit`, `contact_name`, `contact_phone`, `contact_email`, `reporter_name`, `reporter_position`, `submitted_at`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` | หัวฟอร์มกลางและ snapshot โรงงาน/จุดตรวจวัด/ผู้ติดต่อ/ผู้รายงาน โดยเก็บ `form_type = "KWP04"` |
| `kwp_emission_measurement_items` | `id`, `submission_id`, `pollutant`, `sample_date`, `measured_value`, `measured_value_text`, `unit`, `laboratory_no`, `report_no`, `method`, `sort_order` | รายการตรวจวัดมลพิษอากาศจากปล่องระบายของแบบ กวภ.04 |
| `kwp_form_attachments` | `id`, `submission_id`, `related_table`, `related_id`, `attachment_type`, `original_file_name`, `stored_file_name`, `mime_type`, `file_size`, `storage_path`, `uploaded_at`, `uploaded_by`, `deleted_at` | ไฟล์แนบ โดยไฟล์ระดับรายการตรวจวัดจะเก็บ `related_table = "kwp_emission_measurement_items"` และ `related_id = kwp_emission_measurement_items.id` |
| `kwp_form_status_history` | `id`, `submission_id`, `status`, `note`, `changed_by`, `changed_at` | ประวัติสถานะเริ่มต้น `SUBMITTED` |

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:edit` | `403` | user ไม่มีสิทธิ์บันทึกแบบ กวภ. |
| ผู้ประกอบการ scope `OWN_FACTORY` ยื่นโรงงานที่ไม่ได้รับสิทธิ์ | `403` | backend ไม่อนุญาตให้ยื่นแทนโรงงานอื่น |
| payload ไม่ถูกต้อง | `400` | validation error เช่นไม่มี `measurementItems`, วันที่ไม่ใช่ `YYYY-MM-DD`, หรือไฟล์แนบไม่มี `attachmentType`/`originalFileName` |

## 5. Create KWP05 submission

บันทึกแบบ **กวภ.05 แบบรายงานผลการสอบเทียบหรือทวนสอบระบบตรวจวัดคุณภาพอากาศแบบอัตโนมัติอย่างต่อเนื่อง (CEMS)** เป็นสถานะ `SUBMITTED` ทันที

```http
POST /api/v1/kwp-form-submissions/kwp05
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
| `businessActivity` | string|null | No | ประกอบกิจการ |
| `samplerName` | string|null | No | ผู้เก็บตัวอย่าง |
| `officerRegistration` | string|null | No | ทะเบียนเจ้าหน้าที่ |
| `laboratoryName` | string|null | No | หน่วยงาน/ชื่อห้องปฏิบัติการ |
| `laboratoryRegistration` | string|null | No | ทะเบียนห้องปฏิบัติการ |
| `cemsBrand` | string|null | No | ยี่ห้อ CEMS |
| `cemsDetail` | string|null | No | รายละเอียดเครื่องมือหรือเครื่องอุปกรณ์พิเศษ |
| `reportRound` | string|null | No | ครั้งที่รายงาน |
| `reportYear` | string|null | No | ปี พ.ศ. ที่รายงาน เช่น `2569` |
| `calibrationItems` | object[] | Yes | รายการผลการสอบเทียบหรือทวนสอบ CEMS ต้องมีอย่างน้อย 1 รายการ |
| `calibrationItems[].parameter` | string | Yes | พารามิเตอร์ ควรมีหน่วยใน label เช่น `NOx (ppm)` |
| `calibrationItems[].startDate` | `YYYY-MM-DD`|null | No | วันที่เริ่มดำเนินการ |
| `calibrationItems[].endDate` | `YYYY-MM-DD`|null | No | วันที่สิ้นสุดดำเนินการ ต้องไม่ก่อน `startDate` |
| `calibrationItems[].result` | string|null | No | ผลการตรวจสอบ เช่น `ผ่าน`, `ไม่ผ่าน` |
| `calibrationItems[].verifierCompany` | string|null | No | บริษัทที่ทำการทวนสอบ / สอบเทียบ |
| `calibrationItems[].cemsModel` | string|null | No | ยี่ห้อ/รุ่นของ CEMS |
| `calibrationItems[].rataReportLink` | string|null | No | Link / QR CODE รายงานผล RATA |
| `calibrationItems[].calibrationPhotoLink` | string|null | No | Link / QR CODE ภาพขณะสอบเทียบ |
| `calibrationItems[].attachments` | object[] | No | ไฟล์แนบของรายการสอบเทียบ |
| `calibrationItems[].attachments[].attachmentType` | string | Yes | ประเภทไฟล์ เช่น `RATA_REPORT`, `CALIBRATION_PHOTO` |
| `calibrationItems[].attachments[].originalFileName` | string | Yes | ชื่อไฟล์เดิมจากผู้ใช้ |
| `calibrationItems[].attachments[].storedFileName` | string|null | No | ชื่อไฟล์ที่ระบบจัดเก็บจริง |
| `calibrationItems[].attachments[].mimeType` | string|null | No | MIME type เช่น `image/jpeg`, `image/png`, `application/pdf` |
| `calibrationItems[].attachments[].fileSize` | number|null | No | ขนาดไฟล์เป็น byte |
| `calibrationItems[].attachments[].storagePath` | string|null | No | path หรือ object key ที่ backend/storage ใช้ดึงไฟล์ |
| `reporterName` | string|null | No | ชื่อผู้รายงานผลการทดสอบ |
| `reporterPosition` | string|null | No | ตำแหน่งผู้รายงานผลการทดสอบ |

> หมายเหตุ: frontend ต้องอัปโหลดไฟล์ผ่าน `POST /api/v1/kwp-form-submissions/attachments` ก่อน แล้วนำ metadata ที่ได้มาใส่ใน `calibrationItems[].attachments[]`

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
  "businessActivity": "ผลิตกระแสไฟฟ้า",
  "samplerName": "สมหญิง เก็บตัวอย่าง",
  "officerRegistration": "OFF-001",
  "laboratoryName": "ห้องปฏิบัติการทดสอบ จำกัด",
  "laboratoryRegistration": "LAB-REG-001",
  "cemsBrand": "CEMS Brand A",
  "cemsDetail": "CEMS Brand A รุ่น Model X",
  "reportRound": "1",
  "reportYear": "2569",
  "calibrationItems": [
    {
      "parameter": "NOx (ppm)",
      "startDate": "2026-07-01",
      "endDate": "2026-07-02",
      "result": "ผ่าน",
      "verifierCompany": "บริษัท สอบเทียบ จำกัด",
      "cemsModel": "Model X",
      "rataReportLink": "https://example.com/rata-nox",
      "calibrationPhotoLink": "https://example.com/photo-nox",
      "attachments": [
        {
          "attachmentType": "RATA_REPORT",
          "originalFileName": "rata-report.pdf",
          "storedFileName": "15-rata-report.pdf",
          "mimeType": "application/pdf",
          "fileSize": 840000,
          "storagePath": "/uploads/kwp/15-rata-report.pdf"
        },
        {
          "attachmentType": "CALIBRATION_PHOTO",
          "originalFileName": "calibration-photo.jpg",
          "storedFileName": "15-calibration-photo.jpg",
          "mimeType": "image/jpeg",
          "fileSize": 220000,
          "storagePath": "/uploads/kwp/15-calibration-photo.jpg"
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
Location: /api/v1/kwp-form-reports/requests/15
```

```json
{
  "success": true,
  "data": {
    "id": 15,
    "requestNo": "KWP-69-00015",
    "form": "กวภ.05",
    "formType": "KWP05",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:45:00.000Z",
    "calibrationItemCount": 1,
    "attachmentCount": 2
  }
}
```

### Detail response

```http
GET /api/v1/kwp-form-submissions/kwp05/15
```

```json
{
  "success": true,
  "data": {
    "id": 15,
    "requestNo": "KWP-69-00015",
    "form": "กวภ.05",
    "formType": "KWP05",
    "status": "SUBMITTED",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "pointCode": "S0001",
    "pointName": "ปล่องระบาย A",
    "calibrationReport": {
      "businessActivity": "ผลิตกระแสไฟฟ้า",
      "samplerName": "สมหญิง เก็บตัวอย่าง",
      "officerRegistration": "OFF-001",
      "laboratoryName": "ห้องปฏิบัติการทดสอบ จำกัด",
      "laboratoryRegistration": "LAB-REG-001",
      "cemsBrand": "CEMS Brand A",
      "cemsDetail": "CEMS Brand A รุ่น Model X",
      "reportRound": "1",
      "reportYear": "2569"
    },
    "calibrationItems": [
      {
        "id": 61,
        "parameter": "NOx (ppm)",
        "startDate": "2026-07-01",
        "endDate": "2026-07-02",
        "result": "ผ่าน",
        "verifierCompany": "บริษัท สอบเทียบ จำกัด",
        "cemsModel": "Model X",
        "rataReportLink": "https://example.com/rata-nox",
        "calibrationPhotoLink": "https://example.com/photo-nox",
        "attachments": [
          {
            "id": 71,
            "attachmentType": "RATA_REPORT",
            "originalFileName": "rata-report.pdf",
            "storedFileName": "15-rata-report.pdf",
            "mimeType": "application/pdf",
            "fileSize": 840000,
            "storagePath": "kwp/form-attachments/2026/07/15-rata-report.pdf",
            "fileUrl": "https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/15-rata-report.pdf",
            "uploadedAt": "2026-07-04T08:45:00.000Z",
            "uploadedBy": 42
          }
        ]
      }
    ]
  }
}
```

### Data source and stored columns

| Table | Columns used | Meaning |
| --- | --- | --- |
| `kwp_form_submissions` | `id`, `submission_no`, `form_type`, `status`, `factory_id`, `factory_name`, `factory_registration_no`, `factory_address`, `industry_type`, `connected_point_id`, `point_code`, `point_name`, `point_type`, `production_stack`, `primary_fuel`, `secondary_fuel`, `combustion_system`, `production_capacity`, `production_capacity_unit`, `contact_name`, `contact_phone`, `contact_email`, `reporter_name`, `reporter_position`, `submitted_at`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` | หัวฟอร์มกลางและ snapshot โรงงาน/จุดตรวจวัด/ผู้ติดต่อ/ผู้รายงาน โดยเก็บ `form_type = "KWP05"` |
| `kwp05_calibration_reports` | `id`, `submission_id`, `business_activity`, `sampler_name`, `officer_registration`, `laboratory_name`, `laboratory_registration`, `cems_brand`, `cems_detail`, `report_round`, `report_year` | ข้อมูลหัวรายงานผลการสอบเทียบหรือทวนสอบ CEMS |
| `kwp05_calibration_items` | `id`, `submission_id`, `parameter_name`, `start_date`, `end_date`, `result`, `verifier_company`, `cems_model`, `link_qr1`, `link_qr2`, `sort_order` | รายการผลการสอบเทียบหรือทวนสอบ CEMS หลายแถว |
| `kwp_form_attachments` | `id`, `submission_id`, `related_table`, `related_id`, `attachment_type`, `original_file_name`, `stored_file_name`, `mime_type`, `file_size`, `storage_path`, `uploaded_at`, `uploaded_by`, `deleted_at` | ไฟล์แนบ โดยไฟล์ระดับรายการสอบเทียบจะเก็บ `related_table = "kwp05_calibration_items"` และ `related_id = kwp05_calibration_items.id` |
| `kwp_form_status_history` | `id`, `submission_id`, `status`, `note`, `changed_by`, `changed_at` | ประวัติสถานะเริ่มต้น `SUBMITTED` |

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:edit` หรือ `kwp_forms:view` | `403` | user ไม่มีสิทธิ์บันทึก/ดูแบบ กวภ. |
| ผู้ประกอบการ scope `OWN_FACTORY` ยื่นโรงงานที่ไม่ได้รับสิทธิ์ | `403` | backend ไม่อนุญาตให้ยื่นแทนโรงงานอื่น |
| payload ไม่ถูกต้อง | `400` | validation error เช่นไม่มี `calibrationItems`, วันที่ไม่ใช่ `YYYY-MM-DD`, `endDate` ก่อน `startDate`, หรือไฟล์แนบไม่มี `attachmentType`/`originalFileName` |
| เรียก detail path ผิด form เช่น `/kwp04/15` แต่ข้อมูลเป็น `KWP05` | `404` | ไม่คืนข้อมูลให้ผู้ใช้ |

## 6. Get KWP submission detail

ดึงข้อมูลแบบ กวภ.01, กวภ.02, กวภ.03, กวภ.04, หรือ กวภ.05 ตาม `id` เพื่อเปิดหน้ารายละเอียด/preview ข้อมูลที่เคยยื่นไว้ ถ้าเป็นแบบที่มีไฟล์แนบ backend จะคืน `attachments[].fileUrl` สำหรับเปิดดูหรือดาวน์โหลดไฟล์ได้จาก `UPLOAD_PUBLIC_PATH`

```http
GET /api/v1/kwp-form-submissions/kwp01/:id
GET /api/v1/kwp-form-submissions/kwp02/:id
GET /api/v1/kwp-form-submissions/kwp03/:id
GET /api/v1/kwp-form-submissions/kwp04/:id
GET /api/v1/kwp-form-submissions/kwp05/:id
```

Permission: `kwp_forms:view`

### Path parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | `kwp_form_submissions.id` ต้องเป็น positive integer |

### Response: KWP01

```json
{
  "success": true,
  "data": {
    "id": 12,
    "requestNo": "KWP-69-00012",
    "form": "กวภ.01",
    "formType": "KWP01",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:00:00.000Z",
    "createdAt": "2026-07-04T08:00:00.000Z",
    "updatedAt": "2026-07-04T08:00:00.000Z",
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
    "reporterName": "สมชาย ทดสอบ",
    "reporterPosition": "ผู้จัดการสิ่งแวดล้อม",
    "issueReport": {
      "issueReason": "เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง",
      "reasonDetail": "เครื่องวิเคราะห์ก๊าซไม่สามารถส่งข้อมูลได้",
      "problemDate": "2026-07-01",
      "expectedDoneDate": "2026-07-05",
      "totalDays": 5,
      "correctiveAction": "ซ่อมบำรุงเครื่องมือและตรวจสอบระบบรับส่งข้อมูล",
      "unreportedParameters": ["NOx (ppm)", "SO2 (ppm)"]
    }
  }
}
```

### Response: KWP02

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
    "createdAt": "2026-07-04T08:15:00.000Z",
    "updatedAt": "2026-07-04T08:15:00.000Z",
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
    "reporterName": "สมชาย ทดสอบ",
    "reporterPosition": "ผู้จัดการสิ่งแวดล้อม",
    "measurementItems": [
      {
        "id": 31,
        "pollutant": "NOx (ppm)",
        "sampleDate": "2026-07-01",
        "measuredValue": "110.25",
        "numericValue": 110.25,
        "unit": "ppm",
        "laboratoryNo": "LAB-001",
        "reportNo": "RPT-001",
        "method": "USEPA Method 7E",
        "attachments": [
          {
            "id": 51,
            "attachmentType": "LAB_REPORT",
            "originalFileName": "lab-report.pdf",
            "storedFileName": "13-lab-report.pdf",
            "mimeType": "application/pdf",
            "fileSize": 880000,
            "storagePath": "kwp/form-attachments/2026/07/13-lab-report.pdf",
            "fileUrl": "https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/13-lab-report.pdf",
            "uploadedAt": "2026-07-04T08:15:00.000Z",
            "uploadedBy": 42
          }
        ]
      }
    ]
  }
}
```

### Response: KWP03

```json
{
  "success": true,
  "data": {
    "id": 16,
    "requestNo": "KWP-69-00016",
    "form": "กวภ.03",
    "formType": "KWP03",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:20:00.000Z",
    "createdAt": "2026-07-04T08:20:00.000Z",
    "updatedAt": "2026-07-04T08:20:00.000Z",
    "factoryId": "FID-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo": "10190000225448",
    "factoryAddress": "9 หมู่ 9",
    "industryType": "10100 / 3",
    "connectedPointId": 8,
    "pointCode": "P0001",
    "pointName": "จุดระบายน้ำทิ้ง A",
    "pointType": "WATER",
    "contactName": "สมชาย ทดสอบ",
    "contactPhone": "0812345678",
    "contactEmail": "operator@example.com",
    "reporterName": "สมชาย ทดสอบ",
    "reporterPosition": "ผู้จัดการสิ่งแวดล้อม",
    "wpmsIssueReport": {
      "wastewaterSource": "ระบบบำบัดน้ำเสียส่วนกลาง",
      "receivingSource": "คลองสาธารณะ",
      "treatmentSystemType": "ระบบตะกอนเร่ง",
      "dischargePoint": "UTM 123456, 987654",
      "averageDischarge": "125.500000",
      "minimumDischarge": "100.250000",
      "maximumDischarge": "150.750000",
      "reasonDetail": "สัญญาณเครือข่ายขัดข้องและต้องเปลี่ยนอุปกรณ์ตรวจวัด",
      "problemDate": "2026-07-01",
      "expectedDoneDate": "2026-07-05",
      "totalDays": 5,
      "correctiveAction": "เปลี่ยนอุปกรณ์และทดสอบการส่งข้อมูล WPMS",
      "instruments": ["ค่าบีโอดี (BOD)", "ค่าซีโอดี (COD)"],
      "measurementTimes": ["Real Time", "15 นาที"],
      "issueReasons": [
        "เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง",
        "ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง"
      ],
      "failedParameters": ["BOD (mg/l)", "COD (mg/l)"],
      "attachments": [
        {
          "id": 81,
          "attachmentType": "WPMS_EVIDENCE",
          "originalFileName": "wpms-evidence.pdf",
          "storedFileName": "16-wpms-evidence.pdf",
          "mimeType": "application/pdf",
          "fileSize": 760000,
          "storagePath": "kwp/form-attachments/2026/07/16-wpms-evidence.pdf",
          "fileUrl": "https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/16-wpms-evidence.pdf",
          "uploadedAt": "2026-07-04T08:20:00.000Z",
          "uploadedBy": 42
        }
      ]
    }
  }
}
```

### Response: KWP04

```json
{
  "success": true,
  "data": {
    "id": 14,
    "requestNo": "KWP-69-00014",
    "form": "กวภ.04",
    "formType": "KWP04",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-04T08:30:00.000Z",
    "createdAt": "2026-07-04T08:30:00.000Z",
    "updatedAt": "2026-07-04T08:30:00.000Z",
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
    "reporterName": "สมชาย ทดสอบ",
    "reporterPosition": "ผู้จัดการสิ่งแวดล้อม",
    "measurementItems": [
      {
        "id": 41,
        "pollutant": "CO (ppm)",
        "sampleDate": "2026-07-02",
        "measuredValue": "12.5",
        "numericValue": 12.5,
        "unit": "ppm",
        "laboratoryNo": "LAB-004",
        "reportNo": "RPT-004",
        "method": "USEPA Method 10",
        "attachments": [
          {
            "id": 61,
            "attachmentType": "LAB_REPORT",
            "originalFileName": "kwp04-lab-report.pdf",
            "storedFileName": "14-kwp04-lab-report.pdf",
            "mimeType": "application/pdf",
            "fileSize": 940000,
            "storagePath": "kwp/form-attachments/2026/07/14-kwp04-lab-report.pdf",
            "fileUrl": "https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/14-kwp04-lab-report.pdf",
            "uploadedAt": "2026-07-04T08:30:00.000Z",
            "uploadedBy": 42
          }
        ]
      }
    ]
  }
}
```

### Data source

| Response field | Source |
| --- | --- |
| Common submission fields | `kwp_form_submissions` |
| `issueReport` | `kwp01_issue_reports` + `kwp01_unreported_parameters` |
| `wpmsIssueReport` | `kwp03_wpms_issue_reports` + `kwp03_selected_options` + `kwp_form_attachments` |
| `measurementItems` | `kwp_emission_measurement_items` |
| `measurementItems[].attachments` | `kwp_form_attachments` where `related_table = "kwp_emission_measurement_items"` |
| `attachments[].fileUrl` | Derived from `PUBLIC_BASE_URL` or request host + `UPLOAD_PUBLIC_PATH` + `storage_path` |

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:view` | `403` | user ไม่มีสิทธิ์ดูรายละเอียดแบบ กวภ. |
| `id` ไม่ใช่ positive integer | `400` | path parameter ไม่ถูกต้อง |
| ไม่พบรายการ, รายการถูกลบ, เรียก path ผิด form เช่น `/kwp02/:id` แต่ข้อมูลเป็น `KWP01`, หรืออยู่นอก scope | `404` | ไม่คืนข้อมูลให้ผู้ใช้ |
| เรียก path กลางเดิม `/api/v1/kwp-form-submissions/:id` | `404` | ปิด path กลางแล้ว ให้ใช้ path แยกตาม form type |

## 7. Get KWP workflow

อ่านขั้นตอนปัจจุบันของแบบ กวภ.01-05 จาก backend เพื่อให้ frontend แสดง step และปุ่ม action โดยไม่ต้องเดาสถานะเอง

```http
GET /api/v1/kwp-form-submissions/:id/workflow
```

Permission: `kwp_forms:view`

### Response

```json
{
  "success": true,
  "data": {
    "id": 12,
    "requestNo": "KWP-69-00012",
    "form": "กวภ.01",
    "formType": "KWP01",
    "status": "SUBMITTED",
    "statusLabel": "รอพิจารณา",
    "revisionReason": null,
    "officerNote": null,
    "reviewedAt": null,
    "currentStep": {
      "key": "SUBMITTED",
      "label": "ส่งฟอร์ม",
      "status": "CURRENT"
    },
    "steps": [
      { "key": "SUBMITTED", "label": "ส่งฟอร์ม", "status": "CURRENT" },
      { "key": "REVISION_REQUESTED", "label": "ส่งแก้ไข", "status": "PENDING" },
      { "key": "APPROVED", "label": "ผ่านการพิจารณา", "status": "PENDING" }
    ],
    "allowedActions": ["REQUEST_REVISION", "APPROVE"]
  }
}
```

### Step/action mapping

| Current status | Current step | Allowed actions |
| --- | --- | --- |
| `SUBMITTED` | `SUBMITTED` / ส่งฟอร์ม | `REQUEST_REVISION`, `APPROVE` |
| `REVISION_REQUESTED` | `REVISION_REQUESTED` / ส่งแก้ไข | `APPROVE` |
| `APPROVED` | `APPROVED` / ผ่านการพิจารณา | none |
| `REJECTED`, `CANCELLED` | terminal status | none |

## 8. Change KWP workflow status

ให้เจ้าหน้าที่เปลี่ยนขั้นตอนของแบบ กวภ.01-05 ผ่าน action endpoint เดียว

```http
POST /api/v1/kwp-form-submissions/:id/workflow-actions
```

Permission: `kwp_forms:approve`

### Request: request revision

```json
{
  "action": "REQUEST_REVISION",
  "revisionReason": "เพิ่มเอกสารแนบผลตรวจวัด",
  "officerNote": "ตรวจพบเอกสารแนบยังไม่ครบ"
}
```

`revisionReason` บังคับส่งเมื่อ `action = REQUEST_REVISION` และถูกบันทึกเป็น note ของสถานะเหมือน workflow คำขอเชื่อมต่อ

### Request: approve

```json
{
  "action": "APPROVE",
  "officerNote": "ข้อมูลและเอกสารประกอบครบถ้วน"
}
```

### Response

คืน shape เดียวกับ `GET /workflow` แต่เป็นสถานะล่าสุดหลังเปลี่ยน step

### Data source

- `kwp_form_submissions.status` เก็บสถานะล่าสุด
- `kwp_form_submissions.officer_note` เก็บ note ล่าสุดของเจ้าหน้าที่หรือเหตุผลส่งแก้ไข
- `kwp_form_submissions.reviewed_at` และ `reviewed_by` ถูกเติมเมื่อ action เป็น `REQUEST_REVISION` หรือ `APPROVE`
- `kwp_form_status_history` เก็บทุก status transition พร้อม note และผู้เปลี่ยนสถานะ; `revisionReason` ใน workflow response อ่านจาก note ล่าสุดของ history ที่เป็น `REVISION_REQUESTED`

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `kwp_forms:approve` | `403` | user ไม่มีสิทธิ์เปลี่ยน workflow |
| `id` ไม่ใช่ positive integer | `400` | path parameter ไม่ถูกต้อง |
| payload ไม่ถูกต้อง เช่นไม่ส่ง `revisionReason` ตอน `REQUEST_REVISION` | `400` | validation error |
| action ไม่สอดคล้องกับ status ปัจจุบัน | `400` | backend คืน `allowedActions` ใน error details |
| ไม่พบรายการ, รายการถูกลบ, หรืออยู่นอก scope | `404` | ไม่คืนข้อมูลให้ผู้ใช้ |

## 9. Edit returned KWP submissions

ให้ผู้ประกอบการแก้ไขข้อมูลเดิมได้เฉพาะรายการที่เจ้าหน้าที่ส่งกลับแก้ไขแล้ว (`REVISION_REQUESTED`) โดย endpoint แยกตามชนิดฟอร์มเพื่อให้ frontend ระบุฟอร์มชัดเจน

```http
PATCH /api/v1/kwp-form-submissions/kwp01/:id
PATCH /api/v1/kwp-form-submissions/kwp02/:id
PATCH /api/v1/kwp-form-submissions/kwp03/:id
PATCH /api/v1/kwp-form-submissions/kwp04/:id
PATCH /api/v1/kwp-form-submissions/kwp05/:id
```

Permission: `kwp_forms:edit`

Payload ใช้ schema เดียวกับ create endpoint ของฟอร์มนั้น เช่น `PATCH /kwp01/:id` ใช้ payload เดียวกับ `POST /kwp01`

Behavior:

- ต้องเป็นรายการเดิมของ form type ตาม path เช่น `/kwp01/:id` ต้องเป็น `KWP01` เท่านั้น
- ถ้าอยู่นอก scope โรงงานของผู้ประกอบการ คืน `404`
- ถ้าสถานะไม่ใช่ `REVISION_REQUESTED` คืน `409 CONFLICT`
- การแก้ไข replace รายละเอียดฟอร์มและรายการลูกของฟอร์มนั้น แต่ไม่เปลี่ยนเลขคำขอหรือสถานะ workflow
- หลังผู้ประกอบการบันทึกแก้ไขด้วย `PATCH` แล้ว สถานะยังเป็น `REVISION_REQUESTED` และเจ้าหน้าที่สามารถ `APPROVE` ได้จากสถานะนี้โดยตรง
- Response คืน detail shape เดียวกับ `GET /api/v1/kwp-form-submissions/kwp01/:id`

## 10. Resubmit returned KWP submissions

ให้ผู้ประกอบการส่งฟอร์มที่แก้ไขแล้วกลับเข้าสู่ workflow หลังจากสถานะ `REVISION_REQUESTED`

```http
POST /api/v1/kwp-form-submissions/kwp01/:id/resubmit
POST /api/v1/kwp-form-submissions/kwp02/:id/resubmit
POST /api/v1/kwp-form-submissions/kwp03/:id/resubmit
POST /api/v1/kwp-form-submissions/kwp04/:id/resubmit
POST /api/v1/kwp-form-submissions/kwp05/:id/resubmit
```

Permission: `kwp_forms:edit`

Request body:

```json
{
  "note": "ปรับข้อมูลและแนบเอกสารครบแล้ว"
}
```

`note` เป็น optional string ไม่เกิน 1000 ตัวอักษร

Behavior:

- ต้องเป็นรายการเดิมของ form type ตาม path
- ต้องอยู่สถานะ `REVISION_REQUESTED`
- เมื่อสำเร็จ ระบบเปลี่ยน machine status กลับเป็น `SUBMITTED`
- ถ้ารายการเคยมีประวัติ `REVISION_REQUESTED` แล้วกลับมา `SUBMITTED` อีกครั้ง API จะแสดง label เป็น `แก้ไขแล้ว/รอพิจารณา`
- ระบบเพิ่มประวัติใน `kwp_form_status_history` พร้อม note ของผู้ประกอบการ
- Response คืน workflow shape เดียวกับ `GET /api/v1/kwp-form-submissions/:id/workflow`
