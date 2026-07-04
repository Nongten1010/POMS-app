# KWP Form Submission APIs

API สำหรับบันทึกแบบแจ้ง กวภ.01 - กวภ.05 โดยเอกสารนี้เริ่มจากแบบ **กวภ.01 แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ** ก่อน

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
