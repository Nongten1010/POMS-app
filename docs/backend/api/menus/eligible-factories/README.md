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
- [ขอเชื่อมต่อ](../connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`eligible-factories.routes.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.routes.ts) |
| Repository | [`eligible-factories.repository.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.repository.ts) |
| Public types | [`eligible-factories.types.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.types.ts) |
| Tests | [`eligible-factories.repository.test.ts`](../../../../../backend/tests/unit/eligible-factories.repository.test.ts), [`eligible-factories.connected-removal.repository.test.ts`](../../../../../backend/tests/unit/eligible-factories.connected-removal.repository.test.ts) |
