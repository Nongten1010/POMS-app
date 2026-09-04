# คำถามที่พบบ่อย

> Owner: Backend

## Frontend Quick Start

เมนูนี้โหลดคำถามทั้งหมดแบบ public แล้วให้ frontend ค้นหา กรอง และเรียงรายการเอง การเพิ่ม แก้ไข และลบต้องส่ง Bearer token ที่มี permission `faq:edit`; API ไม่รองรับ pagination, filter หรือ sort query

### Main Flow

1. เรียก `GET /api/v1/faqs` หนึ่งครั้งเพื่อรับรายการทั้งหมด
2. เก็บ `data[]` แล้วค้นจาก `question`, `answer`, `categoryLabel` และกรองด้วย `category` ใน frontend
3. ผู้ใช้ที่มี `faq:edit` จัดการรายการผ่าน `POST`, `PUT` และ `DELETE`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/faqs'
```

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/faqs' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "question": "หากระบบ CEMS ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?",
    "answer": "ให้ตรวจสอบสถานะอุปกรณ์และการเชื่อมต่อก่อน แล้วดำเนินการแจ้งแบบที่เกี่ยวข้อง",
    "category": "CEMS",
    "updatedDate": "2026-09-04"
  }'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission |
| --- | --- | --- | --- | --- |
| โหลดรายการทั้งหมด | `GET` | `/api/v1/faqs` | Public | - |
| เพิ่มคำถาม | `POST` | `/api/v1/faqs` | Bearer | `faq:edit` |
| แก้ไขคำถาม | `PUT` | `/api/v1/faqs/:id` | Bearer | `faq:edit` |
| ลบคำถาม | `DELETE` | `/api/v1/faqs/:id` | Bearer | `faq:edit` |

## Category Enum

ค่า `all` เป็น state ภายใน dropdown ของ frontend เท่านั้น ห้ามส่งเป็น `category` ให้ API

| `category` | `categoryLabel` |
| --- | --- |
| `CEMS` | `CEMS` |
| `WPMS` | `WPMS` |
| `OTHER` | `อื่นๆ` |

## Response DTO

รายการที่สร้าง แก้ไข หรืออยู่ใน `data[]` ใช้ shape เดียวกัน:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `id` | UUID string | No | public identifier ที่ใช้ใน path; ห้ามตีความเป็นเลขฐานข้อมูล |
| `question` | string | No | คำถาม 1-1,000 ตัวอักษรหลัง trim |
| `answer` | string | No | คำตอบอย่างน้อย 1 ตัวอักษรหลัง trim; ไม่มี field-level maximum เพิ่มเติม |
| `category` | enum | No | `CEMS`, `WPMS`, `OTHER` |
| `categoryLabel` | string | No | `CEMS`, `WPMS` หรือ `อื่นๆ` |
| `updatedDate` | string (`YYYY-MM-DD`) | No | วันที่เนื้อหาอัปเดต ค.ศ. ช่วง `1900-01-01` ถึง `9999-12-31` |
| `createdAt` | ISO 8601 datetime | No | เวลาสร้าง |
| `updatedAt` | ISO 8601 datetime | No | เวลาแก้ไขล่าสุดของระบบ |

## Contracts

### `GET /api/v1/faqs`

- Authentication: public
- Permission: -
- Request fields: ไม่มี path, query หรือ body
- Response: `200 OK`; คืนรายการทั้งหมดใน `data[]` ไม่มี `meta` และไม่มี pagination

```json
{
  "success": true,
  "data": [
    {
      "id": "8d6a040b-f133-41f6-860d-4bb4dc08e72e",
      "question": "หากระบบ CEMS ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?",
      "answer": "ให้ตรวจสอบสถานะอุปกรณ์และการเชื่อมต่อก่อน แล้วดำเนินการแจ้งแบบที่เกี่ยวข้อง",
      "category": "CEMS",
      "categoryLabel": "CEMS",
      "updatedDate": "2026-09-04",
      "createdAt": "2026-09-04T09:30:00.000Z",
      "updatedAt": "2026-09-04T09:30:00.000Z"
    }
  ]
}
```

Frontend เป็นผู้ค้นหาและกรอง; ห้ามส่ง `page`, `perPage`, `search`, `category`, filter หรือ sort query เพราะ API ปฏิเสธ query ที่ไม่รู้จัก

### Request Body สำหรับ `POST` และ `PUT`

Body เป็น strict JSON object; unknown field เช่น `id` ถูกปฏิเสธ และ `PUT` เป็น full replacement ของ 4 fields นี้

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `question` | string | Yes | trim แล้ว 1-1,000 ตัวอักษร |
| `answer` | string | Yes | trim แล้วอย่างน้อย 1 ตัวอักษร; payload ทั้งก้อนยังอยู่ภายใต้ global JSON body limit 1 MB |
| `category` | enum | Yes | `CEMS`, `WPMS`, `OTHER`; ห้ามใช้ `all` |
| `updatedDate` | string | Yes | วันจริงรูป `YYYY-MM-DD` ช่วงปี 1900-9999; future date ใช้ได้ |

```json
{
  "question": "หากระบบ CEMS ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?",
  "answer": "ให้ตรวจสอบสถานะอุปกรณ์และการเชื่อมต่อก่อน แล้วดำเนินการแจ้งแบบที่เกี่ยวข้อง",
  "category": "CEMS",
  "updatedDate": "2026-09-04"
}
```

### `POST /api/v1/faqs`

- Authentication: Bearer token
- Permission: `faq:edit`
- Request: ใช้ [Request Body สำหรับ `POST` และ `PUT`](#request-body-สำหรับ-post-และ-put)
- Response: `201 Created`; `data` เป็น [Response DTO](#response-dto)

```json
{
  "success": true,
  "data": {
    "id": "8d6a040b-f133-41f6-860d-4bb4dc08e72e",
    "question": "หากระบบ CEMS ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?",
    "answer": "ให้ตรวจสอบสถานะอุปกรณ์และการเชื่อมต่อก่อน แล้วดำเนินการแจ้งแบบที่เกี่ยวข้อง",
    "category": "CEMS",
    "categoryLabel": "CEMS",
    "updatedDate": "2026-09-04",
    "createdAt": "2026-09-04T09:30:00.000Z",
    "updatedAt": "2026-09-04T09:30:00.000Z"
  }
}
```

### `PUT /api/v1/faqs/:id`

- Authentication: Bearer token
- Permission: `faq:edit`
- Request: `id` อยู่ใน path และ body ใช้ [Request Body สำหรับ `POST` และ `PUT`](#request-body-สำหรับ-post-และ-put)
- Response: `200 OK`; คืนข้อมูลล่าสุดใน [Response DTO](#response-dto)

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | UUID string | Yes | public identifier ของคำถาม |

```json
{
  "question": "หากระบบ CEMS ขัดข้อง ต้องดำเนินการอย่างไร?",
  "answer": "ให้ตรวจสอบอุปกรณ์และดำเนินการแจ้งแบบตามเงื่อนไขของระบบ",
  "category": "CEMS",
  "updatedDate": "2026-09-04"
}
```

```json
{
  "success": true,
  "data": {
    "id": "8d6a040b-f133-41f6-860d-4bb4dc08e72e",
    "question": "หากระบบ CEMS ขัดข้อง ต้องดำเนินการอย่างไร?",
    "answer": "ให้ตรวจสอบอุปกรณ์และดำเนินการแจ้งแบบตามเงื่อนไขของระบบ",
    "category": "CEMS",
    "categoryLabel": "CEMS",
    "updatedDate": "2026-09-04",
    "createdAt": "2026-09-04T09:30:00.000Z",
    "updatedAt": "2026-09-04T10:00:00.000Z"
  }
}
```

### `DELETE /api/v1/faqs/:id`

- Authentication: Bearer token
- Permission: `faq:edit`
- Request body: ไม่มี

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | UUID string | Yes | คำถามที่ผู้ใช้ยืนยันลบ |

```json
{
  "id": "8d6a040b-f133-41f6-860d-4bb4dc08e72e"
}
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "id": "8d6a040b-f133-41f6-860d-4bb4dc08e72e",
    "deleted": true
  }
}
```

## Errors

ใช้ [shared error envelope](../../shared/common-api/README.md) โดย frontend อ่าน `error.message` และ `error.details` เมื่อมี:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "question": ["Too small: expected string to have >=1 characters"],
      "category": ["Invalid option"]
    }
  }
}
```

| HTTP | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | path, query หรือ JSON body ไม่ตรง schema | แสดงรายละเอียดราย field และแก้ request |
| `401` | `UNAUTHORIZED` | write request ไม่มี token หรือ token ใช้ไม่ได้ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `faq:edit` | ซ่อน action หรือแจ้งผู้ดูแลสิทธิ์ |
| `404` | `NOT_FOUND` | UUID ไม่มีอยู่หรือรายการถูกลบแล้ว | โหลดรายการใหม่และแจ้งผู้ใช้ |

## Business Flow And Explanations

- [API กลางและ shared envelope](../../shared/common-api/README.md)
- [Endpoint registry](../../ENDPOINTS.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`faqs.routes.ts`](../../../../../backend/src/modules/faqs/faqs.routes.ts) |
| Controller | [`faqs.controller.ts`](../../../../../backend/src/modules/faqs/faqs.controller.ts) |
| Validator | [`faqs.validator.ts`](../../../../../backend/src/modules/faqs/faqs.validator.ts) |
| Public types | [`faqs.types.ts`](../../../../../backend/src/modules/faqs/faqs.types.ts) |
| Service | [`faqs.service.ts`](../../../../../backend/src/modules/faqs/faqs.service.ts) |
| Repository | [`faqs.repository.ts`](../../../../../backend/src/modules/faqs/faqs.repository.ts) |
| Migration | [`0108_create_laws_and_faqs.ts`](../../../../../backend/src/db/migrations/0108_create_laws_and_faqs.ts) |
| Runtime tests | [`faqs.validator.test.ts`](../../../../../backend/tests/unit/faqs.validator.test.ts), [`faqs.service.test.ts`](../../../../../backend/tests/unit/faqs.service.test.ts), [`faqs.repository.test.ts`](../../../../../backend/tests/unit/faqs.repository.test.ts), [`faqs.controller.test.ts`](../../../../../backend/tests/unit/faqs.controller.test.ts), [`faqs.route.test.ts`](../../../../../backend/tests/unit/faqs.route.test.ts) |
| Contract test | [`laws-faqs.openapi.test.ts`](../../../../../backend/tests/unit/laws-faqs.openapi.test.ts) |
| OpenAPI source | [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts) |
