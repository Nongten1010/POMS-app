# โรงงานที่เข้าข่าย

> Owner: Backend

## Frontend Quick Start

อ่านรายการโรงงานที่ถูกเลือกเป็นโรงงานเข้าข่าย:

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/eligible-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission |
| --- | --- | --- | --- | --- |
| รายการ candidate | `GET` | `/api/v1/eligible-factories/candidates` | Bearer | `eligible_factories:manage` |
| รายการโรงงานที่เข้าข่าย | `GET` | `/api/v1/eligible-factories` | Bearer | `eligible_factories:manage` |
| เลือกโรงงานเข้าข่าย | `POST` | `/api/v1/eligible-factories` | Bearer | `eligible_factories:manage` |
| ถอดโรงงานออกจากเข้าข่าย | `DELETE` | `/api/v1/eligible-factories/:id` | Bearer | `eligible_factories:manage` |
| รายการฟอร์มข้อมูลจุดตรวจวัด | `GET` | `/api/v1/monitoring-point-forms` | Bearer | `cems_wpms_requests:view` |
| รายละเอียดฟอร์มข้อมูลจุดตรวจวัด | `GET` | `/api/v1/monitoring-point-forms/:id` | Bearer | `cems_wpms_requests:view` |
| เพิ่มข้อมูลจุดตรวจวัด | `POST` | `/api/v1/monitoring-point-forms` | Bearer | `cems_wpms_requests:edit` |
| แก้ไขข้อมูลจุดตรวจวัด | `PUT` | `/api/v1/monitoring-point-forms/:id` | Bearer | `cems_wpms_requests:edit` |
| เลือกฟอร์มเป็นโรงงานเข้าข่าย | `POST` | `/api/v1/monitoring-point-forms/:id/select-eligible` | Bearer | `eligible_factories:manage` |

## ฟอร์มเพิ่ม/แก้ไขข้อมูลจุดตรวจวัด

`POST /api/v1/monitoring-point-forms` และ `PUT /api/v1/monitoring-point-forms/:id` ใช้ request body shape เดียวกัน โดยข้อมูลโครงการและ EIA เป็นข้อมูลระดับโรงงานภายใต้ `factory` ไม่ใช่ข้อมูลของแต่ละ `points[]`.

Relevant request fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `factory.eiaInfo` | string \| null | no | field EIA เดิมของฟอร์ม; trim แล้วสูงสุด 255 ตัวอักษร |
| `factory.eiaOther` | string \| null | conditional | ช่อง “ระบุ”; trim แล้วสูงสุด 500 ตัวอักษร และต้องไม่ว่างเมื่อ `factory.eiaInfo` เป็น `อื่นๆ`; ค่าอื่นจะ normalize เป็น `null` |
| `factory.projectName` | string \| null | no | ชื่อโครงการ; trim แล้วสูงสุด 500 ตัวอักษร; ค่าว่าง normalize เป็น `null` |
| `points` | array | no | รายการจุดตรวจวัด; ว่างได้ และ validation รายจุดยังใช้ contract เดิม |

Minimal create request:

```json
{
  "factory": {
    "eiaInfo": "อื่นๆ",
    "eiaOther": "รายงานสิ่งแวดล้อมประเภทเฉพาะ",
    "projectName": "โครงการปรับปรุงระบบตรวจวัด"
  },
  "points": []
}
```

Minimal create response (`201 Created`; `PUT` สำเร็จตอบ `200 OK` ด้วย data shape เดียวกัน):

```json
{
  "success": true,
  "data": {
    "id": 12,
    "factory": {
      "factoryName": null,
      "factoryRegistrationNoNew": null,
      "factoryRegistrationNoOld": null,
      "provinceName": null,
      "factoryTypeMain": null,
      "factoryTypeSub": null,
      "operationStatus": null,
      "eiaInfo": "อื่นๆ",
      "eiaOther": "รายงานสิ่งแวดล้อมประเภทเฉพาะ",
      "projectName": "โครงการปรับปรุงระบบตรวจวัด",
      "address": null,
      "businessActivity": null,
      "machineryHorsepower": null,
      "latitude": null,
      "longitude": null
    },
    "points": [],
    "createdAt": "2026-07-22T00:00:00.000Z",
    "updatedAt": "2026-07-22T00:00:00.000Z"
  }
}
```

`GET /api/v1/monitoring-point-forms` คืน fields ทั้งสามใต้ `data[].factory`; `GET /api/v1/monitoring-point-forms/:id` คืนใต้ `data.factory` เพื่อให้หน้าแก้ไข prefill ค่าเดิมได้. รายการที่สร้างก่อน migration คืน `eiaOther: null` และ `projectName: null`.

เมื่อฟอร์มผูกกับโรงงานเข้าข่าย ระบบ sync แบบ patch:

- `projectName` ที่ไม่เป็น `null` อัปเดต `eligible_factories.project_name`; ค่า `null` หรือไม่ได้ส่งคงค่าปัจจุบัน.
- `eiaInfo` ที่เป็น `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA` หรือ `อื่นๆ` อัปเดต `eia`, derived `hasEia` และ `eiaOther` ให้สอดคล้องกัน.
- `eiaInfo` ที่เป็น `null` หรือไม่ได้ส่งไม่ล้าง EIA ปัจจุบันใน `eligible_factories`.
- `eiaInfo` แบบ free-text เดิมที่ไม่ตรงหกค่า canonical ยังบันทึกและอ่านกลับจากฟอร์มได้ แต่ไม่แก้ EIA ใด ๆ ใน `eligible_factories` เพื่อป้องกันข้อมูล categorical กับ `hasEia` ขัดกัน.
- ฟอร์มข้อมูลจุดตรวจวัดเองยังบันทึก `null` ได้ แม้ค่าใน `eligible_factories` จะถูกเก็บไว้ตาม patch semantics.

## ข้อมูลที่ซิงก์หลังเชื่อมต่อ

`GET /api/v1/eligible-factories` อ่านค่าปัจจุบันจาก `eligible_factories`. เมื่อคำขอของโรงงานเข้าสู่ `CONNECTED` ระบบอัปเดตพิกัดโรงงาน, EIA และชื่อโครงการใน transaction เดียวกับข้อมูล POMS.

Relevant response fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `data[].id` | integer | `eligible_factory_id` ที่ใช้ผูก request/POMS |
| `data[].latitude` | number \| null | ละติจูดโรงงาน |
| `data[].longitude` | number \| null | ลองจิจูดโรงงาน |
| `data[].eia` | string \| null | `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA` หรือ `อื่นๆ` |
| `data[].eiaOther` | string \| null | รายละเอียดเมื่อ `eia` เป็น `อื่นๆ` |
| `data[].hasEia` | boolean \| null | ค่าที่ derive จาก `eia` |
| `data[].projectName` | string \| null | ชื่อโครงการล่าสุดที่ซิงก์เมื่อเชื่อมต่อ |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 25,
      "factoryId": "3-106-33/50สบ",
      "latitude": 13.7563,
      "longitude": 100.5018,
      "eia": "มี EIA",
      "eiaOther": null,
      "hasEia": true,
      "projectName": "โครงการปรับปรุงโรงงาน"
    }
  ],
  "meta": { "total": 1 }
}
```

รูปหน้าโรงงานและโลโก้เป็นข้อมูล POMS current/live จึงไม่เพิ่มใน response ของโรงงานเข้าข่าย.

## การถอดโรงงานออกจากเข้าข่าย

Path fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | integer | yes | id ของ active eligible factory |

Minimal request: ไม่มี request body.

- สำเร็จตอบ `204 No Content`.
- ไม่พบ active row ตอบ `404 Not Found`.
- หากโรงงานยังมี active POMS connected point ตอบ `409 Conflict` และไม่ soft-delete eligible row เพื่อคง invariant ว่าโรงงานใน POMS ต้องเป็นโรงงานที่เข้าข่าย.

## Business Flow And Explanations

- [Connected factory profile sync workflow](../../../../../workflows/connected-factory-profile-sync.md)
- [Eligible factory monitoring-point project fields workflow](../../../../../workflows/eligible-factory-monitoring-point-project-fields.md)
- [ขอเชื่อมต่อ](../connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`eligible-factories.routes.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.routes.ts), [`monitoring-point-forms.routes.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts) |
| Validators | [`monitoring-point-forms.validator.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.validator.ts) |
| Repository | [`eligible-factories.repository.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.repository.ts), [`monitoring-point-forms.repository.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.repository.ts) |
| Public types | [`eligible-factories.types.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.types.ts), [`monitoring-point-forms.types.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.types.ts) |
| Tests | [`monitoring-point-forms.validator.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.validator.test.ts), [`monitoring-point-forms.repository.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.repository.test.ts), [`monitoring-point-forms.service.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.service.test.ts), [`monitoring-point-forms.route.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.route.test.ts) |
