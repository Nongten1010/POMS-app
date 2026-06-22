# เพิ่ม/แก้ไข ข้อมูลจุดตรวจวัด

เอกสารนี้อธิบายส่วนฟอร์มเพิ่ม/แก้ไขข้อมูลจุดตรวจวัดที่แยกจาก workflow คำขอเชื่อมต่อเดิม เพื่อให้เจ้าหน้าที่บันทึกข้อมูลโรงงานและจุดตรวจวัดได้หลายจุดในชุดเดียว โดยแต่ละจุดเลือกได้ว่าเป็น `CEMS` หรือ `WPMS`

## ขอบเขต

- ใช้สำหรับบันทึกข้อมูลจุดตรวจวัดของโรงงานหนึ่งแห่งได้มากกว่า 1 จุด
- รองรับจุดตรวจวัดชนิด `CEMS` และ `WPMS`
- ฟอร์มนี้ยังไม่เชื่อมกับตารางคำขอเชื่อมต่อหรือข้อมูล current/live เดิม
- มี API สำหรับบันทึก, แก้ไข, เรียกดูรายการ, และเรียกดูรายละเอียด
- หน้า frontend เพิ่มเมนู `ข้อมูลจุดตรวจวัด`

## Database Design

### `factory_monitoring_point_forms`

ตาราง parent เก็บ snapshot ข้อมูลโรงงานของฟอร์มหนึ่งชุด

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | BIGINT IDENTITY | Yes | Primary key |
| `factory_name` | NVARCHAR(500) | Yes | ชื่อโรงงาน |
| `factory_registration_no_new` | NVARCHAR(64) | Yes | เลขทะเบียนโรงงานแบบใหม่ |
| `factory_registration_no_old` | NVARCHAR(64) | No | เลขทะเบียนโรงงานแบบเดิม |
| `province_name` | NVARCHAR(128) | No | จังหวัด |
| `factory_type_main` | NVARCHAR(128) | No | ลำดับประเภทโรงงานหลัก |
| `factory_type_sub` | NVARCHAR(128) | No | ลำดับประเภทโรงงานรอง |
| `operation_status` | NVARCHAR(128) | No | สถานะการประกอบกิจการ |
| `eia_info` | NVARCHAR(255) | No | ข้อมูล EIA |
| `address` | NVARCHAR(1000) | No | สถานที่ตั้ง |
| `business_activity` | NVARCHAR(4000) | No | การประกอบกิจการ |
| `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` | audit fields | Mixed | ข้อมูล audit |

Index:

- `uq_factory_monitoring_forms_registration` unique เฉพาะรายการที่ `deleted_at IS NULL`

### `factory_monitoring_points`

ตาราง child เก็บจุดตรวจวัดหลายจุดภายใต้ฟอร์มเดียว

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | BIGINT IDENTITY | Yes | Primary key |
| `form_id` | BIGINT | Yes | FK ไปยัง `factory_monitoring_point_forms.id` |
| `system_type` | VARCHAR(8) | Yes | `CEMS` หรือ `WPMS` |
| `point_code` | VARCHAR(64) | No | รหัสจุดตรวจวัด |
| `point_name` | NVARCHAR(255) | Yes | ชื่อจุดตรวจวัด |
| `production_unit_type` | NVARCHAR(255) | No | ประเภทของหน่วยการผลิต |
| `production_capacity` | NVARCHAR(255) | No | กำลังการผลิตต่อหน่วย |
| `cems_installation_required_by` | NVARCHAR(255) | No | สถานะการเข้าข่ายติดตั้ง CEMS |
| `cems_installation_required_other` | NVARCHAR(255) | No | รายละเอียดอื่นๆ |
| `legal_annex_no` | NVARCHAR(255) | No | ลำดับบัญชีหรือหมายเหตุ |
| `accounting_connection_status` | NVARCHAR(255) | No | สถานะการเข้าข่ายตามบัญชีแนบท้าย |
| `eligible_parameters_json` | NVARCHAR(MAX) | Yes | พารามิเตอร์ที่เข้าข่าย |
| `exempted_parameters_json` | NVARCHAR(MAX) | Yes | พารามิเตอร์ที่ได้รับการยกเว้น |
| `connected_parameters_json` | NVARCHAR(MAX) | Yes | พารามิเตอร์ที่เชื่อมต่อแล้ว |
| `pending_parameters_json` | NVARCHAR(MAX) | Yes | พารามิเตอร์ที่ยังไม่เชื่อมต่อ |
| `primary_fuel` | NVARCHAR(255) | No | เชื้อเพลิงหลัก |
| `secondary_fuel` | NVARCHAR(255) | No | เชื้อเพลิงรอง |
| `details_json` | NVARCHAR(MAX) | No | รายละเอียดเสริมสำหรับอนาคต |
| `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` | audit fields | Mixed | ข้อมูล audit |

Constraints:

- `ck_factory_monitoring_points_system_type` จำกัดค่าเป็น `CEMS`, `WPMS`
- `ix_factory_monitoring_points_form` สำหรับเรียก child points ตาม form

## API

Base path:

```text
/api/v1/monitoring-point-forms
```

## Production Test Example

วันที่ทดสอบ: `2026-06-22`

Production base URL ที่ยิง:

```text
http://d-poms.diw.go.th/api/v1/monitoring-point-forms
```

ผลการทดสอบจริง:

- deploy production แล้วที่ commit `6de7d6e`
- รัน migration แล้ว: `Batch 21 run: 1 migrations`
- `GET /api/v1/monitoring-point-forms` แบบไม่มี token ได้ `401 UNAUTHORIZED` แปลว่า route พร้อมใช้งาน
- `POST /api/v1/monitoring-point-forms` พร้อม token สำเร็จ ได้ `success: true`
- `GET /api/v1/monitoring-point-forms/1` พร้อม token อ่านข้อมูลที่บันทึกกลับมาได้

Response จากการยิง `POST` production:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "factory": {
      "factoryName": "โรงงานทดสอบ Production CEMS WPMS",
      "factoryRegistrationNoNew": "POMS-PROD-TEST-20260622-001"
    },
    "points": [
      {
        "id": 1,
        "formId": 1,
        "systemType": "CEMS",
        "pointCode": "S-PROD-TEST-001",
        "pointName": "ปล่องทดสอบ Production 1"
      },
      {
        "id": 2,
        "formId": 1,
        "systemType": "WPMS",
        "pointCode": "P-PROD-TEST-001",
        "pointName": "จุดระบายน้ำทิ้งทดสอบ Production 1"
      }
    ]
  }
}
```

Payload ที่ใช้ทดสอบยิง production โดยมี `CEMS` และ `WPMS` ในครั้งเดียว:

```json
{
  "factory": {
    "factoryName": "โรงงานทดสอบ Production CEMS WPMS",
    "factoryRegistrationNoNew": "POMS-PROD-TEST-20260622-001",
    "factoryRegistrationNoOld": "TEST-OLD-001",
    "provinceName": "ลำปาง",
    "factoryTypeMain": "100",
    "factoryTypeSub": "003,000",
    "operationStatus": "แจ้งประกอบแล้ว",
    "eiaInfo": "-",
    "address": "1 หมู่ 9 ถนนบ้านช่องคอม ตำบลทดสอบ อำเภอทดสอบ 52240",
    "businessActivity": "ทดสอบบันทึกข้อมูลจุดตรวจวัด"
  },
  "points": [
    {
      "systemType": "CEMS",
      "pointCode": "S-PROD-TEST-001",
      "pointName": "ปล่องทดสอบ Production 1",
      "productionUnitType": "หม้อไอน้ำ",
      "productionCapacity": "10 ตันไอน้ำ/ชั่วโมง",
      "cemsInstallationRequiredBy": "เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย",
      "cemsInstallationRequiredOther": null,
      "legalAnnexNo": "บัญชีแนบท้ายลำดับที่ 1",
      "accountingConnectionStatus": "เข้าข่ายตามบัญชีแนบท้ายลำดับที่",
      "eligibleParameters": ["NOx (ppm)", "SO2 (ppm)", "O2 (%)"],
      "exemptedParameters": [],
      "connectedParameters": [],
      "pendingParameters": ["NOx (ppm)", "SO2 (ppm)", "O2 (%)"],
      "primaryFuel": "ก๊าซธรรมชาติ",
      "secondaryFuel": "น้ำมันเตา",
      "details": null
    },
    {
      "systemType": "WPMS",
      "pointCode": "P-PROD-TEST-001",
      "pointName": "จุดระบายน้ำทิ้งทดสอบ Production 1",
      "productionUnitType": "ระบบบำบัดน้ำเสีย",
      "productionCapacity": "500 ลบ.ม./วัน",
      "cemsInstallationRequiredBy": null,
      "cemsInstallationRequiredOther": null,
      "legalAnnexNo": "บัญชีแนบท้ายลำดับที่ 2",
      "accountingConnectionStatus": "เข้าข่ายตามบัญชีแนบท้ายลำดับที่",
      "eligibleParameters": ["BOD (mg/l)", "COD (mg/l)", "Flow (m³/hr)"],
      "exemptedParameters": [],
      "connectedParameters": [],
      "pendingParameters": ["BOD (mg/l)", "COD (mg/l)", "Flow (m³/hr)"],
      "primaryFuel": null,
      "secondaryFuel": null,
      "details": null
    }
  ]
}
```

Payload นี้ถูกบันทึกลงตาราง:

- `factory_monitoring_point_forms` จำนวน 1 แถว สำหรับข้อมูลโรงงาน
- `factory_monitoring_points` จำนวน 2 แถว สำหรับจุด `CEMS` 1 จุด และ `WPMS` 1 จุด

ข้อมูลที่ได้จาก production:

- `factory_monitoring_point_forms.id = 1`
- `factory_monitoring_points.id = 1`, `system_type = CEMS`
- `factory_monitoring_points.id = 2`, `system_type = WPMS`

สิทธิ์ที่ใช้:

- เรียกดู: `cems_wpms_requests:view`
- บันทึก/แก้ไข: `cems_wpms_requests:edit`

### GET `/api/v1/monitoring-point-forms`

เรียกดูรายการฟอร์มที่บันทึกแล้ว

Query optional:

| Query | Description |
| --- | --- |
| `factoryRegistrationNoNew` | กรองตามเลขทะเบียนโรงงานแบบใหม่ |
| `systemType` | กรองฟอร์มที่มีจุดชนิด `CEMS` หรือ `WPMS` |

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factory": {
        "factoryName": "สถานีบ่มใบยาสบหนอง",
        "factoryRegistrationNoNew": "10520000225172",
        "factoryRegistrationNoOld": "3-1-2/17ลป",
        "provinceName": "ลำปาง",
        "factoryTypeMain": "100",
        "factoryTypeSub": "003,000",
        "operationStatus": "แจ้งประกอบแล้ว",
        "eiaInfo": "-",
        "address": "1 หมู่ 9 ...",
        "businessActivity": "บ่มใบยาสูบ"
      },
      "pointCount": 2,
      "cemsPointCount": 1,
      "wpmsPointCount": 1,
      "createdAt": "2026-06-22T00:00:00.000Z",
      "updatedAt": "2026-06-22T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### GET `/api/v1/monitoring-point-forms/:id`

เรียกดูรายละเอียดฟอร์มพร้อมรายการจุดตรวจวัดทั้งหมด

### POST `/api/v1/monitoring-point-forms`

สร้างฟอร์มใหม่และบันทึกจุดตรวจวัดหลายจุดในครั้งเดียว

Request:

```json
{
  "factory": {
    "factoryName": "สถานีบ่มใบยาสบหนอง",
    "factoryRegistrationNoNew": "10520000225172",
    "factoryRegistrationNoOld": "3-1-2/17ลป",
    "provinceName": "ลำปาง",
    "factoryTypeMain": "100",
    "factoryTypeSub": "003,000",
    "operationStatus": "แจ้งประกอบแล้ว",
    "eiaInfo": "-",
    "address": "1 หมู่ 9 ถนนบ้านช่องคอม ตำบล4 อำเภอ13 52240",
    "businessActivity": "บ่มใบยาสูบ"
  },
  "points": [
    {
      "systemType": "CEMS",
      "pointCode": "S0001",
      "pointName": "ปล่องหลัก",
      "productionUnitType": "หม้อไอน้ำ",
      "productionCapacity": "10 ตัน/ชั่วโมง",
      "cemsInstallationRequiredBy": "เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย",
      "accountingConnectionStatus": "เข้าข่ายตามบัญชีแนบท้ายลำดับที่",
      "eligibleParameters": ["NOx (ppm)", "SO2 (ppm)"],
      "exemptedParameters": [],
      "connectedParameters": [],
      "pendingParameters": ["NOx (ppm)", "SO2 (ppm)"],
      "primaryFuel": "ก๊าซธรรมชาติ",
      "secondaryFuel": ""
    },
    {
      "systemType": "WPMS",
      "pointCode": "P0001",
      "pointName": "จุดระบายน้ำทิ้ง",
      "productionUnitType": "ระบบบำบัดน้ำเสีย",
      "productionCapacity": "500 ลบ.ม./วัน",
      "accountingConnectionStatus": "เข้าข่ายตามบัญชีแนบท้ายลำดับที่",
      "eligibleParameters": ["BOD (mg/l)", "COD (mg/l)"],
      "exemptedParameters": [],
      "connectedParameters": [],
      "pendingParameters": ["BOD (mg/l)", "COD (mg/l)"],
      "primaryFuel": "",
      "secondaryFuel": ""
    }
  ]
}
```

### PUT `/api/v1/monitoring-point-forms/:id`

แก้ไขฟอร์มเดิม โดย backend จะ update ข้อมูลโรงงานและแทนที่รายการจุดตรวจวัดด้วย `points` ชุดใหม่ใน payload

## Frontend

ไฟล์ที่เพิ่ม:

- `frontend/src/pages/MonitoringPointFormsPage.jsx`

ไฟล์ที่แก้:

- `frontend/src/App.jsx`
- `frontend/src/components/DpomsSidebar.jsx`

เมนูใหม่:

```text
ข้อมูลจุดตรวจวัด
```

ความสามารถบนหน้า:

- เรียกดูรายการที่บันทึกแล้ว
- โหลดฟอร์มเดิมกลับมาแก้ไข
- เพิ่มจุดตรวจวัดหลายจุด
- ลบจุดตรวจวัดที่เลือก
- เลือกชนิดจุดเป็น `CEMS` หรือ `WPMS`
- บันทึกผ่าน `POST` เมื่อเป็นฟอร์มใหม่ และ `PUT` เมื่อแก้ไขฟอร์มเดิม

## Validation

- ต้องมี `factory.factoryName`
- ต้องมี `factory.factoryRegistrationNoNew`
- ต้องมี `points` อย่างน้อย 1 จุด
- แต่ละจุดต้องมี `systemType` เป็น `CEMS` หรือ `WPMS`
- แต่ละจุดต้องมี `pointName`
- รายการพารามิเตอร์เก็บเป็น array และ backend แปลงเป็น JSON ในฐานข้อมูล
