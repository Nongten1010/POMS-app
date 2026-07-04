# KWP Form Report APIs

API สำหรับหน้า **แจ้งแบบ กวภ.01 - กวภ.05** ใช้สำหรับดึงข้อมูลตารางก่อน โดยยังไม่แก้ frontend ใน change นี้

Base URL: `/api/v1/kwp-form-reports`

Auth: `Authorization: Bearer <access_token>`

Permission: `kwp_forms:view`

## 1. Operator factory table

ผู้ประกอบการใช้ API นี้สำหรับตาราง **รายชื่อโรงงาน** โดย backend จำกัดข้อมูลตาม scope `OWN_FACTORY` ผ่าน `user_juristics` และแสดงเฉพาะโรงงานที่มี POMS current data หรือมีจุดตรวจวัดที่เชื่อมต่อแล้วใน `cems_wpms_connected_measurement_points`

```http
GET /api/v1/kwp-form-reports/factories
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "10550000125197",
      "factoryId": "10550000125197",
      "factoryName": "ห้างหุ้นส่วนสามัญ สถานีบ่มใบยาสบหนอง",
      "newRegistrationNo": "10550000125197",
      "oldRegistrationNo": "3-1-1/19นน",
      "industryType": "100 / 003,000",
      "province": "น่าน",
      "address": "99 หมู่ 1",
      "monitoringPointCount": 2
    }
  ],
  "meta": {
    "total": 1
  }
}
```

Data source:

- `cems_wpms_connected_measurement_points` เป็นตัวกรองหลักของ POMS current data; โรงงานที่มีเพียงคำขอแต่ยังไม่ `CONNECTED` จะไม่ถูกแสดง
- `factories` เป็นฐานโรงงานหลักของ POMS สำหรับเติมชื่อโรงงาน/เลขทะเบียน/จังหวัดและตรวจสิทธิ์
- `eligible_factories` enrich เลขทะเบียนเก่าและที่อยู่
- `monitoringPointCount` นับจำนวนจุดตรวจวัดที่เชื่อมต่อแล้วจาก `cems_wpms_connected_measurement_points`

## 2. KWP request table

ผู้ประกอบการและเจ้าหน้าที่ใช้ API นี้สำหรับตาราง **รายการคำขอ** เจ้าหน้าที่เห็นตาม scope ของ permission menu และ `regionalAccess`

```http
GET /api/v1/kwp-form-reports/requests
GET /api/v1/kwp-form-reports/requests?formType=KWP01&status=SUBMITTED
```

Query:

| Field | Type | Description |
| --- | --- | --- |
| `formType` | `KWP01`-`KWP05` | กรองแบบ กวภ.01-05 |
| `status` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `CANCELLED` | กรองสถานะ |
| `factoryId` | string | กรองรหัสโรงงานหรือเลขทะเบียน |

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 9,
      "factoryId": "10550000125197",
      "factoryName": "ห้างหุ้นส่วนสามัญ สถานีบ่มใบยาสบหนอง",
      "factoryRegistration": "10550000125197",
      "industryType": "100 / 003,000",
      "factoryAddress": "99 หมู่ 1",
      "province": "น่าน",
      "type": "CEMS",
      "monitoringPointCode": "S0001",
      "monitoringPointName": "ปล่องระบาย A",
      "requestNo": "KWP-69-00001",
      "form": "กวภ.01",
      "formType": "KWP01",
      "submittedDate": "15/06/2569",
      "reviewedDate": "-",
      "status": "รอพิจารณา",
      "statusCode": "SUBMITTED",
      "revisionNote": null,
      "statusHistory": []
    }
  ],
  "meta": {
    "total": 1
  }
}
```

Data source:

- `kwp_form_submissions` เป็นตารางหัวฟอร์ม กวภ.01-05
- `kwp_form_status_history` เป็นประวัติสถานะของแต่ละรายการ
- `factories` และ `provinces` ใช้ตรวจสิทธิ์และเติมจังหวัดจากระบบ POMS
- `cems_wpms_connected_measurement_points` เติม `systemType` ของจุดตรวจวัดเมื่อมี `connected_point_id`

## 3. Measurement point detail modal

ปุ่ม **รายละเอียดจุดตรวจวัด** ในหน้า KWP ใช้ API กลางของจุดตรวจวัดที่เชื่อมต่อแล้ว ไม่ได้อยู่ใต้ base path `/api/v1/kwp-form-reports`

```http
GET /api/v1/connected-measurement-points/factories/:factoryId
```

Auth: `Authorization: Bearer <access_token>`

Permission: `cems_wpms_requests:view`

### When to call

ใช้เมื่อต้องการเปิด modal รายละเอียดจุดตรวจวัดจากแถวใน KWP request table หรือ factory table:

1. อ่านรหัสโรงงานจาก `factoryId` ของแถว KWP request table หรือ factory table เช่น `factory-001`
2. ส่งค่านั้นเป็น `:factoryId`
3. แสดง `data[]` ในตาราง modal 4 คอลัมน์:
   - รหัสจุดตรวจวัด
   - ชื่อจุดตรวจวัด
   - ประเภทจุดตรวจวัด
   - รายละเอียดพารามิเตอร์

ตัวอย่าง:

```bash
curl "http://d-poms.diw.go.th/api/v1/connected-measurement-points/factories/factory-001" \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "pointCode": "S0001",
      "pointName": "ปล่องระบาย A",
      "pointType": "STACK",
      "parameterDetails": [
        "CO (ppm)",
        "NOx (ppm)",
        "SO2 (ppm)",
        "Temp. (C°)"
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `success` | boolean | สถานะการเรียก API |
| `data` | array | รายการจุดตรวจวัดที่เชื่อมต่อแล้วของโรงงานนั้น |
| `data[].pointCode` | string|null | รหัสจุดตรวจวัด เช่น `S0001`, `P0001`; ถ้าข้อมูลเดิมไม่มีรหัสจะเป็น `null` |
| `data[].pointName` | string | ชื่อจุดตรวจวัด |
| `data[].pointType` | `STACK`\|`WASTEWATER`\|`OTHER` | ประเภทจุดตรวจวัด |
| `data[].parameterDetails` | string[] | รายละเอียดพารามิเตอร์ที่ลงทะเบียนไว้กับจุดตรวจวัด พร้อมหน่วยถ้ามี เช่น `NOx (ppm)` |
| `meta.total` | number | จำนวนจุดตรวจวัดที่คืนใน `data[]` |

### Data source

- API lookup จุดตรวจวัดจาก current connected measurement points ตาม `factoryId`
- `pointCode`, `pointName`, `pointType` มาจากข้อมูลจุดตรวจวัดที่อยู่ใต้โรงงานนั้น
- `parameterDetails` มาจากการ parse ค่า `parameters_json` เป็น array ไม่ส่ง raw JSON string กลับไปให้ frontend
- ถ้า `parameters_json` เก็บเป็น code เปล่า backend จะคืน code นั้นตามที่เก็บไว้; ถ้าต้องการให้แสดงหน่วย ควรเก็บ label พร้อมหน่วยตั้งแต่ workflow เชื่อมต่อ เช่น `NOx (ppm)`

### Error behavior

| Case | HTTP status | Meaning |
| --- | --- | --- |
| ไม่ส่ง token หรือ token ไม่ถูกต้อง | `401` | ต้อง login ก่อน |
| token ไม่มี permission `cems_wpms_requests:view` | `403` | user ไม่มีสิทธิ์ดูจุดตรวจวัด |
| ไม่พบจุดตรวจวัดที่เชื่อมต่อแล้วสำหรับ `factoryId` นี้ | `200` | คืน `data: []` และ `meta.total: 0` |

### Related documents

- Contract หลักของ API นี้อยู่ที่ [`CEMS_WPMS_REQUEST_APIS.md`](./CEMS_WPMS_REQUEST_APIS.md)
- API detail page อื่นของจุดตรวจวัดอยู่ที่ [`OPERATOR_FACTORY_DASHBOARD.md`](./OPERATOR_FACTORY_DASHBOARD.md)
- Logic ของ `parameterDetails` อยู่ที่ [`DERIVED_FIELD_LOGIC.md`](./DERIVED_FIELD_LOGIC.md)