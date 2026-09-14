# กฎหมายที่เกี่ยวข้อง

> Owner: Backend

## Frontend Quick Start

เมนูนี้โหลดรายการกฎหมายทั้งหมดแบบ public และใช้ `file.downloadUrl` ดาวน์โหลด PDF ได้โดยตรง ส่วนการเพิ่ม แก้ไข และลบต้องส่ง Bearer token ที่มี permission `laws:edit` โดย API ไม่รองรับ pagination, filter หรือ sort query

### Main Flow

1. เรียก `GET /api/v1/laws` หนึ่งครั้งเพื่อรับรายการทั้งหมด
2. กรองด้วย `category` และเรียงด้วย `title` ใน frontend
3. เปิด `file.downloadUrl` เพื่อดาวน์โหลด PDF
4. ผู้ใช้ที่มี `laws:edit` จัดการรายการผ่าน `POST`, `PUT` และ `DELETE`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/laws'
```

การเพิ่มรายการเป็น `multipart/form-data`:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/laws' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'title=ประกาศกรมโรงงานอุตสาหกรรม เรื่อง การทวนสอบระบบ CEMS' \
  --form 'category=CEMS' \
  --form 'type=DEPARTMENT_ANNOUNCEMENT' \
  --form 'publishedDate=2025-07-09' \
  --form 'file=@./announcement.pdf;type=application/pdf'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission |
| --- | --- | --- | --- | --- |
| โหลดรายการทั้งหมด | `GET` | `/api/v1/laws` | Public | - |
| เพิ่มรายการพร้อม PDF | `POST` | `/api/v1/laws` | Bearer | `laws:edit` |
| แก้ไขข้อมูลหรือเปลี่ยน PDF | `PUT` | `/api/v1/laws/:id` | Bearer | `laws:edit` |
| ลบรายการ | `DELETE` | `/api/v1/laws/:id` | Bearer | `laws:edit` |
| ดาวน์โหลด PDF | `GET` | `/api/v1/laws/:id/file` | Public | - |

## Enums

### `category`

| Value | `categoryLabel` |
| --- | --- |
| `CEMS` | `CEMS` |
| `WPMS` | `WPMS` |
| `OTHER` | `อื่นๆ` |

### `type`

ตัวเลือกสำหรับเพิ่มและแก้ไขเรียงตามลำดับนี้ (`LawInputType` ใน OpenAPI):

| ลำดับ | Value | `typeLabel` |
| --- | --- | --- |
| 1 | `MINISTERIAL_REGULATION` | `กฎกระทรวงอุตสาหกรรม` |
| 2 | `MINISTRY_ANNOUNCEMENT` | `ประกาศกระทรวงอุตสาหกรรม` |
| 3 | `DEPARTMENT_ANNOUNCEMENT` | `ประกาศกรมโรงงานอุตสาหกรรม` |
| 4 | `REGULATION_REQUIREMENT` | `ระเบียบ ข้อบังคับ และข้อกำหนด` |
| 5 | `OTHER` | `อื่นๆ` |

ข้อมูลเดิมยังคืน `type: RULE_AND_ANNOUNCEMENT` และ `typeLabel: กฎและประกาศ` ได้ใน `GET`; `LawType` สำหรับ response จึงรวมค่านี้ด้วย แต่ `POST` และ `PUT` ไม่รับค่านี้และตอบ `400 VALIDATION_ERROR` พร้อม `error.details.type` ผู้ใช้ต้องเลือกหนึ่งใน 5 ประเภทก่อนบันทึก แม้แก้เฉพาะชื่อหรือไฟล์ ไม่มีการจับคู่หรือย้ายข้อมูลเก่าอัตโนมัติ

`MINISTERIAL_REGULATION` คงค่าเดิม แต่ label เปลี่ยนเป็น `กฎกระทรวงอุตสาหกรรม` การเรียงตัวเลือกข้างต้นไม่เปลี่ยนลำดับรายการที่ `GET` คืน ดู [ผลกระทบและขั้นตอนปรับ client](../../CHANGELOG.md#law-document-types)

## Response DTO

รายการที่สร้าง แก้ไข หรืออยู่ใน `data[]` ใช้ shape เดียวกัน:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `id` | UUID string | No | public identifier ที่ใช้ใน path; ห้ามตีความเป็นเลขฐานข้อมูล |
| `title` | string | No | ชื่อกฎหมาย 1-500 ตัวอักษรหลัง trim |
| `category` | enum | No | ค่า machine-stable ตามตาราง `category` |
| `categoryLabel` | string | No | label สำหรับแสดงผล |
| `type` | enum | No | ค่า machine-stable ตามตาราง `type` หรือ `RULE_AND_ANNOUNCEMENT` สำหรับข้อมูลเดิม |
| `typeLabel` | string | No | label ภาษาไทยสำหรับแสดงผล |
| `publishedDate` | string (`YYYY-MM-DD`) | No | วันประกาศ ค.ศ. ช่วง `1900-01-01` ถึง `9999-12-31` |
| `file.fileName` | string | No | ชื่อไฟล์เดิม สูงสุด 255 ตัวอักษร |
| `file.fileSize` | integer | No | ขนาดไฟล์หน่วย byte ช่วง 1-10,485,760 |
| `file.mimeType` | string | No | `application/pdf` |
| `file.downloadUrl` | URI reference | No | URL public รูป `/api/v1/laws/:id/file` ที่ใช้ดาวน์โหลดโดยตรง |
| `createdAt` | ISO 8601 datetime | No | เวลาสร้าง |
| `updatedAt` | ISO 8601 datetime | No | เวลาแก้ไขล่าสุด |

## Contracts

### `GET /api/v1/laws`

- Authentication: public
- Permission: -
- Request fields: ไม่มี path, query หรือ body
- Response: `200 OK`; คืนรายการทั้งหมดใน `data[]` ไม่มี `meta` และไม่มี pagination

```json
{
  "success": true,
  "data": [
    {
      "id": "0f2386e5-80e0-4f91-a920-586ec2d4d6cb",
      "title": "ประกาศกรมโรงงานอุตสาหกรรม เรื่อง การทวนสอบระบบ CEMS",
      "category": "CEMS",
      "categoryLabel": "CEMS",
      "type": "DEPARTMENT_ANNOUNCEMENT",
      "typeLabel": "ประกาศกรมโรงงานอุตสาหกรรม",
      "publishedDate": "2025-07-09",
      "file": {
        "fileName": "announcement.pdf",
        "fileSize": 824512,
        "mimeType": "application/pdf",
        "downloadUrl": "/api/v1/laws/0f2386e5-80e0-4f91-a920-586ec2d4d6cb/file"
      },
      "createdAt": "2026-09-04T09:30:00.000Z",
      "updatedAt": "2026-09-04T09:30:00.000Z"
    }
  ]
}
```

Frontend เป็นผู้กรอง `category` และเรียง `title`; `page`, `perPage`, filter และ sort query ไม่อยู่ใน contract และ backend ไม่นำไปใช้

### `POST /api/v1/laws`

- Authentication: Bearer token
- Permission: `laws:edit`
- Content type: `multipart/form-data`
- Response: `201 Created`; `data` เป็น [Response DTO](#response-dto)

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `title` | form | string | Yes | trim แล้ว 1-500 ตัวอักษร |
| `category` | form | enum | Yes | `CEMS`, `WPMS`, `OTHER` |
| `type` | form | enum | Yes | ค่าตามตาราง `type` |
| `publishedDate` | form | string | Yes | วันจริงรูป `YYYY-MM-DD` ช่วงปี 1900-9999; future date ใช้ได้ |
| `file` | form | binary | Yes | PDF 1 ไฟล์, 1 byte-10 MB, MIME `application/pdf`, นามสกุล `.pdf` และ signature `%PDF-` ต้องตรงกัน |

ตัวอย่างเชิงโครงสร้างของ form fields นี้ไม่ใช่ JSON wire format:

```json
{
  "title": "ประกาศกรมโรงงานอุตสาหกรรม เรื่อง การทวนสอบระบบ CEMS",
  "category": "CEMS",
  "type": "DEPARTMENT_ANNOUNCEMENT",
  "publishedDate": "2025-07-09",
  "file": "<binary PDF>"
}
```

```json
{
  "success": true,
  "data": {
    "id": "0f2386e5-80e0-4f91-a920-586ec2d4d6cb",
    "title": "ประกาศกรมโรงงานอุตสาหกรรม เรื่อง การทวนสอบระบบ CEMS",
    "category": "CEMS",
    "categoryLabel": "CEMS",
    "type": "DEPARTMENT_ANNOUNCEMENT",
    "typeLabel": "ประกาศกรมโรงงานอุตสาหกรรม",
    "publishedDate": "2025-07-09",
    "file": {
      "fileName": "announcement.pdf",
      "fileSize": 824512,
      "mimeType": "application/pdf",
      "downloadUrl": "/api/v1/laws/0f2386e5-80e0-4f91-a920-586ec2d4d6cb/file"
    },
    "createdAt": "2026-09-04T09:30:00.000Z",
    "updatedAt": "2026-09-04T09:30:00.000Z"
  }
}
```

### `PUT /api/v1/laws/:id`

- Authentication: Bearer token
- Permission: `laws:edit`
- Content type: `multipart/form-data`
- Response: `200 OK`; คืนข้อมูลล่าสุดใน [Response DTO](#response-dto)

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `id` | path | UUID string | Yes | public identifier ของรายการ |
| `title` | form | string | Yes | full replacement, trim แล้ว 1-500 ตัวอักษร |
| `category` | form | enum | Yes | full replacement |
| `type` | form | enum | Yes | full replacement; หนึ่งใน 5 ค่าตามตาราง `type` เท่านั้น |
| `publishedDate` | form | string | Yes | วันจริงรูป `YYYY-MM-DD` |
| `file` | form | binary | No | เมื่อไม่ส่งจะเก็บไฟล์เดิม; เมื่อส่งใช้กติกา PDF เดียวกับ create |

```json
{
  "title": "ประกาศฉบับแก้ไข เรื่อง การทวนสอบระบบ CEMS",
  "category": "CEMS",
  "type": "DEPARTMENT_ANNOUNCEMENT",
  "publishedDate": "2026-09-04"
}
```

```json
{
  "success": true,
  "data": {
    "id": "0f2386e5-80e0-4f91-a920-586ec2d4d6cb",
    "title": "ประกาศฉบับแก้ไข เรื่อง การทวนสอบระบบ CEMS",
    "category": "CEMS",
    "categoryLabel": "CEMS",
    "type": "DEPARTMENT_ANNOUNCEMENT",
    "typeLabel": "ประกาศกรมโรงงานอุตสาหกรรม",
    "publishedDate": "2026-09-04",
    "file": {
      "fileName": "announcement.pdf",
      "fileSize": 824512,
      "mimeType": "application/pdf",
      "downloadUrl": "/api/v1/laws/0f2386e5-80e0-4f91-a920-586ec2d4d6cb/file"
    },
    "createdAt": "2026-09-04T09:30:00.000Z",
    "updatedAt": "2026-09-04T10:00:00.000Z"
  }
}
```

`id` อยู่ใน path เท่านั้น; ห้ามส่ง `id` ใน form body

### `DELETE /api/v1/laws/:id`

- Authentication: Bearer token
- Permission: `laws:edit`

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | UUID string | Yes | รายการที่ผู้ใช้ยืนยันลบ |

```json
{
  "id": "0f2386e5-80e0-4f91-a920-586ec2d4d6cb"
}
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "id": "0f2386e5-80e0-4f91-a920-586ec2d4d6cb",
    "deleted": true
  }
}
```

### `GET /api/v1/laws/:id/file`

- Authentication: public
- Permission: -
- Request body: ไม่มี

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | UUID string | Yes | public identifier จาก `file.downloadUrl` |

Response `200 OK` เป็น binary PDF ไม่ใช่ JSON:

| Header/body | Value |
| --- | --- |
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment` พร้อมชื่อไฟล์เดิม |
| body | byte stream ที่ขึ้นต้นด้วย PDF signature |

```text
%PDF-<binary data>
```

## Errors

ใช้ [shared error envelope](../../shared/common-api/README.md) โดย frontend อ่าน `error.message` และ `error.details` เมื่อมี:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลรายการกฎหมายไม่ถูกต้อง",
    "details": {
      "category": "กรุณาเลือกหมวดหมู่",
      "file": "กรุณาแนบไฟล์ PDF"
    }
  }
}
```

| HTTP | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | path/query/form field ไม่ตรง schema, ไม่มีไฟล์ตอน create หรือ PDF ว่าง/MIME/นามสกุล/signature ไม่ตรง | แสดงรายละเอียดราย field และให้ผู้ใช้แก้ข้อมูลหรือเลือก PDF ใหม่ |
| `400` | `UPLOAD_ERROR` | ไฟล์เกิน 10 MB, จำนวนไฟล์/field หรือ multipart limit | ลดไฟล์หรือแก้ multipart แล้วส่งใหม่ |
| `401` | `UNAUTHORIZED` | write request ไม่มี token หรือ token ใช้ไม่ได้ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `laws:edit` | ซ่อน action หรือแจ้งผู้ดูแลสิทธิ์ |
| `404` | `NOT_FOUND` | UUID ไม่มีอยู่ ถูกลบแล้ว หรือหาไฟล์จริงไม่พบ | โหลดรายการใหม่และแจ้งผู้ใช้ |

## Business Flow And Explanations

- [API กลางและ shared envelope](../../shared/common-api/README.md)
- [Endpoint registry](../../ENDPOINTS.md)

## การนำขึ้นระบบ

ต้องใช้ migration [`0120_expand_law_document_types.ts`](../../../../../backend/src/db/migrations/0120_expand_law_document_types.ts) ก่อนเปิดใช้งาน backend รุ่นนี้ เพื่อขยาย CHECK constraint ให้บันทึกประกาศทั้งสองประเภทได้ โดยยังเก็บประเภทเดิมไว้ ไม่มีการแก้ record เดิม การ rollback จะหยุดหากพบประเภทใหม่ในแถวใดก็ตามรวมถึงแถว soft-delete; ให้ใช้ forward migration ตามการจัดประเภทที่ได้รับอนุมัติแทนการเดาค่า

หลัง deploy ตรวจ `/api/v1/openapi.json` ว่า `LawInputType` มี 5 ค่าตามลำดับ และ `LawType` รวมประเภทเดิมด้วย

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`laws.routes.ts`](../../../../../backend/src/modules/laws/laws.routes.ts) |
| Controller | [`laws.controller.ts`](../../../../../backend/src/modules/laws/laws.controller.ts) |
| Validator | [`laws.validator.ts`](../../../../../backend/src/modules/laws/laws.validator.ts) |
| Public types | [`laws.types.ts`](../../../../../backend/src/modules/laws/laws.types.ts) |
| Service | [`laws.service.ts`](../../../../../backend/src/modules/laws/laws.service.ts) |
| Repository | [`laws.repository.ts`](../../../../../backend/src/modules/laws/laws.repository.ts) |
| Private file storage | [`laws-file-storage.ts`](../../../../../backend/src/modules/laws/laws-file-storage.ts) |
| Migration | [`0108_create_laws_and_faqs.ts`](../../../../../backend/src/db/migrations/0108_create_laws_and_faqs.ts) |
| Runtime tests | [`laws.validator.test.ts`](../../../../../backend/tests/unit/laws.validator.test.ts), [`laws.file-storage.test.ts`](../../../../../backend/tests/unit/laws.file-storage.test.ts), [`laws.repository.test.ts`](../../../../../backend/tests/unit/laws.repository.test.ts), [`laws.service.test.ts`](../../../../../backend/tests/unit/laws.service.test.ts), [`laws.routes.test.ts`](../../../../../backend/tests/unit/laws.routes.test.ts) |
| Type migration test | [`laws-document-types-migration.test.ts`](../../../../../backend/tests/unit/laws-document-types-migration.test.ts) |
| Contract test | [`laws-faqs.openapi.test.ts`](../../../../../backend/tests/unit/laws-faqs.openapi.test.ts) |
| OpenAPI source | [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts) |
