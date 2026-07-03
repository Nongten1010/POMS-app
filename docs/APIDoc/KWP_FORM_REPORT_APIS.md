# KWP Form Report APIs

API สำหรับหน้า **แจ้งแบบ กวภ.01 - กวภ.05** ใช้สำหรับดึงข้อมูลตารางก่อน โดยยังไม่แก้ frontend ใน change นี้

Base URL: `/api/v1/kwp-form-reports`

Auth: `Authorization: Bearer <access_token>`

Permission: `kwp_forms:view`

## 1. Operator factory table

ผู้ประกอบการใช้ API นี้สำหรับตาราง **รายชื่อโรงงาน** โดย backend จำกัดข้อมูลตาม scope `OWN_FACTORY` ผ่าน `user_juristics`

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

- `factories` เป็นฐานโรงงานหลักของ POMS
- `eligible_factories` enrich เลขทะเบียนเก่าและที่อยู่
- `cems_wpms_connected_measurement_points` นับจำนวนจุดตรวจวัด

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
