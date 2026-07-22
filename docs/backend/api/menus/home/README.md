# หน้าหลัก

> Owner: Backend

## Frontend Quick Start

หน้าหลักแสดงโรงงานที่มีจุดตรวจวัด current/live ใน POMS แล้ว โดยไม่บังคับว่าโรงงานต้องมี row ใน `factories`. ผู้ใช้ที่ login ต้องมี `dashboard:view`; ผลลัพธ์ถูกกรองตาม scope ของ permission และพื้นที่ของเจ้าหน้าที่

### Main Flow

1. อ่านโรงงานจาก active `cems_wpms_connected_measurement_points` ที่ผูก active `eligible_factories`; `factoryName` ใช้ชื่อจาก current/live point ที่อัปเดตล่าสุด.
2. ถ้า current/live point ไม่มีชื่อจึง fallback ไป `eligible_factories.factory_name` และ `factories.name` ตามลำดับ; `factories` ยังเป็นข้อมูลเสริมและ ownership gate สำหรับ `OWN_FACTORY`.
3. แนบจุดตรวจวัด, favorite และค่ารายชั่วโมงล่าสุดตามสิทธิ์ของผู้เรียก.

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/operator-factory-dashboard?systemType=CEMS' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| รายการโรงงานบนหน้าหลัก | `GET` | `/api/v1/operator-factory-dashboard` | Bearer | `dashboard:view` | [Authenticated dashboard](#get-apiv1operator-factory-dashboard) |
| จุดโรงงานสำหรับแผนที่สาธารณะ | `GET` | `/api/v1/public/factory-map-points` | No | - | [Public map](#get-apiv1publicfactory-map-points) |
| ข้อมูลทั่วไปของโรงงาน | `GET` | `/api/v1/cems-wpms-requests/factories/:factoryId/general` | Bearer | `factories:view` | [Factory general](#get-apiv1cems-wpms-requestsfactoriesfactoryidgeneral) |
| ตั้งค่า favorite | `PUT` | `/api/v1/operator-factories/:factoryId/favorite` | Bearer | `factories:view` และ `dashboard.alerts:view` | [Favorite](#put-apiv1operator-factoriesfactoryidfavorite) |

## Contracts

### `GET /api/v1/operator-factory-dashboard`

Query fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `systemType` | `CEMS` \| `WPMS` | No | คืนเฉพาะโรงงานที่มี active point ของระบบนั้น |
| `favoriteOnly` | boolean | No | รองรับ `true`, `false`, `1`, `0`, `yes`, `no`; default `false` |

Request body: ไม่มี

Response fields ที่ใช้ระบุตัวโรงงานและการเชื่อมต่อ:

| Field | Type | Meaning |
| --- | --- | --- |
| `data[].id` | integer \| null | `factories.id`; เป็น `null` ได้เมื่อเจ้าหน้าที่เชื่อมโรงงานเข้าข่ายก่อนมี factory master |
| `data[].factoryId` | string | identifier หลักสำหรับหน้าและจุดตรวจวัด; eligible-only row ใช้เลขทะเบียนใหม่ |
| `data[].factoryName` | string | ชื่อโรงงานจาก current/live POMS point ล่าสุด; fallback เป็นโรงงานเข้าข่าย แล้วจึง factory master |
| `data[].newRegistrationNo` | string | เลขทะเบียนโรงงานใหม่ |
| `data[].isFavorite` | boolean | favorite ของผู้ใช้ปัจจุบัน |
| `data[].monitoringPointCountBySystem` | array | จำนวน active point แยก `CEMS` และ `WPMS` |
| `data[].measurementPoints` | array | active connected points และค่ารายชั่วโมงที่อ่านได้ตาม scope |
| `data[].status` | `แสดง` | display status ของ row |
| `meta.total` | integer | จำนวนโรงงานหลังใช้ query filters |

Minimal response (`200 OK`) สำหรับโรงงานที่เจ้าหน้าที่เชื่อมโดยยังไม่มี `factories` row:

```json
{
  "success": true,
  "data": [
    {
      "id": null,
      "factoryId": "40100007125560",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "newRegistrationNo": "40100007125560",
      "isFavorite": false,
      "monitoringPointCountBySystem": [
        { "systemType": "CEMS", "count": 1 },
        { "systemType": "WPMS", "count": 0 }
      ],
      "status": "แสดง",
      "measurementPoints": [
        {
          "stationId": "S4010",
          "pointName": "ปล่องหลัก",
          "pointCode": "S4010",
          "systemType": "CEMS",
          "parameters": ["CO (ppm)"]
        }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

Visibility and authorization:

- `ALL`, `IN_REGION` และ `IN_PROVINCE` ใช้ active POMS point และพื้นที่จาก `eligible_factories`; ไม่ต้องมี `factories` row.
- `OWN_FACTORY` ยังต้องผ่าน `user_juristics` หรือ `user_factory_access` ที่อ้างถึง `factories`; ระบบไม่อนุมาน ownership จากเลขทะเบียน.
- row ที่ `eligible_factories.deleted_at` หรือ connected point `deleted_at` ไม่เป็น `null` จะไม่แสดง.
- โรงงานที่มีหลาย active points แสดงเป็นหนึ่ง factory row และรวม points ใน `measurementPoints`.

### `GET /api/v1/public/factory-map-points`

Query fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `systemType` | `CEMS` \| `WPMS` | No | กรอง active point ตามระบบ |

Request body: ไม่มี

Response ใช้ identity, location, `monitoringPointCountBySystem`, `status` และ `measurementPoints` รูปแบบเดียวกับ dashboard แต่ไม่คืน `isFavorite`, `hasLatestHourlyMeasurement` หรือ raw measurement `data`.

```json
{
  "success": true,
  "data": [
    {
      "id": null,
      "factoryId": "40100007125560",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "newRegistrationNo": "40100007125560",
      "monitoringPointCountBySystem": [
        { "systemType": "CEMS", "count": 1 },
        { "systemType": "WPMS", "count": 0 }
      ],
      "status": "แสดง",
      "measurementPoints": [
        {
          "stationId": "S4010",
          "pointName": "ปล่องหลัก",
          "pointCode": "S4010",
          "systemType": "CEMS",
          "parameters": ["CO (ppm)"]
        }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

### `GET /api/v1/cems-wpms-requests/factories/:factoryId/general`

`factoryId` เป็น identifier ที่ได้จาก dashboard และต้องอยู่ใน access scope ของผู้เรียก ระบบอ่าน factory master ก่อนและ fallback ไปยัง active connected POMS factory ที่ผูก `eligible_factories` เมื่อยังไม่มี `factories` row. ฟิลด์ที่มีเฉพาะใน master เช่น `juristicId`, `systemId` และ `authorizeStart` จะเป็น `null` ในกรณี fallback.

Request body: ไม่มี

```json
{
  "success": true,
  "data": {
    "id": null,
    "eligibleFactoryId": 17,
    "factoryId": "40100007125560",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "newRegistrationNo": "40100007125560",
    "juristicId": null,
    "systemId": null,
    "formDefaults": {
      "factoryId": "40100007125560",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryRegistrationNo": "40100007125560"
    }
  }
}
```

### `PUT /api/v1/operator-factories/:factoryId/favorite`

Path and body fields:

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `factoryId` | path | string | Yes | 1-64 characters และต้องอยู่ใน access scope ของผู้เรียก; รองรับ connected eligible factory ที่ยังไม่มี `factories` row สำหรับ scope ที่อนุญาต |
| `isFavorite` | body | boolean | Yes | `true` เพื่อติดดาว, `false` เพื่อยกเลิก |

```json
{
  "isFavorite": true
}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "factoryId": "40100007125560",
    "isFavorite": true
  }
}
```

Error responses ใช้ shared error envelope. Validation ผิดตอบ `400`; ไม่ผ่าน authentication ตอบ `401`; ไม่ผ่าน permission/scope ตอบ `403` หรือ `404` ตาม access check ของ endpoint.

## Business Flow And Explanations

- [ขอเชื่อมต่อและ Direct Connection](../connection-requests/README.md)
- [โรงงานที่เข้าข่ายและข้อมูลที่ซิงก์](../eligible-factories/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [connection-requests.routes.ts](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts) |
| Validators | [connection-requests.validator.ts](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts) |
| Repository | [connection-requests.repository.ts](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts) |
| Public types | [connection-requests.types.ts](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Tests | [connection-requests.repository.test.ts](../../../../../backend/tests/unit/connection-requests.repository.test.ts), [connection-requests.service.test.ts](../../../../../backend/tests/unit/connection-requests.service.test.ts), [parameter-values.repository.test.ts](../../../../../backend/tests/unit/parameter-values.repository.test.ts) |
| Evidence | [Officer-connected dashboard TDD](../../../evidence/home/officer-direct-connected-dashboard.tdd.md), [Current/live POMS factory name TDD](../../../evidence/home/operator-dashboard-current-factory-name.tdd.md) |
