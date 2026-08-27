# API กลาง

> Owner: Backend

## Overview

หน้านี้รวบ API กลางที่ไม่ผูกกับเมนูใดเมนูหนึ่งโดยตรง และเป็นจุดอ้างอิงร่วมเรื่อง base URL, healthcheck, API root และ shared response/error envelope

## Base URL

- API base path: `/api/v1`
- Interactive docs: `/api/v1/docs`
- OpenAPI JSON: `/api/v1/openapi.json`

## Shared Endpoints

| Method | Path                                  | Auth                                | Purpose                            |
| ------ | ------------------------------------- | ----------------------------------- | ---------------------------------- |
| `GET`  | `/health`                             | Public                              | healthcheck ของ backend            |
| `GET`  | `/api/v1`                             | Public                              | root message และ version ของ API   |
| `GET`  | `/api/v1/docs`                        | Public when `API_DOCS_ENABLED=true` | redirect ไป Swagger UI             |
| `GET`  | `/api/v1/docs/swagger-initializer.js` | Public when `API_DOCS_ENABLED=true` | config ฝั่ง browser ของ Swagger UI |
| `GET`  | `/api/v1/openapi.json`                | Public when `API_DOCS_ENABLED=true` | contract machine-readable          |

Swagger UI ครอบคลุม 123 canonical endpoints และแสดง 132 operations แยกเป็น 11 กลุ่มงาน การเปิดหน้าเอกสารไม่ได้ข้าม auth ของ endpoint ที่กดทดสอบ และ `Try it out` อาจเปลี่ยนข้อมูลใน environment ปัจจุบันจริง

`API_DOCS_ENABLED` เปิดเป็นค่าเริ่มต้นทุก environment รวม production และตั้งเป็น `false` เมื่อต้องการปิดทั้ง Swagger UI กับ OpenAPI JSON

## Shared Response Shape

Success envelope ทั่วไป:

```json
{
  "success": true,
  "data": {}
}
```

Error envelope ทั่วไป:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed"
  }
}
```

## Maintainer Links

- App mounting: `backend/src/app.ts`
- API docs routes: `backend/src/modules/api-docs/api-docs.routes.ts`
- OpenAPI: `backend/src/modules/api-docs/poms.openapi.ts`
