# สถิติข้อมูล

> Owner: Backend

## Frontend Quick Start

กลุ่มนี้ใน Swagger ใช้รวม API สถิติข้อมูลของจุดตรวจวัด, ปฏิทินสถานะ และการส่งออก CSV เพื่อให้เจ้าหน้าที่ทดสอบ query/path ได้จากเมนูเดียว

หน้า interactive test ใช้ชุดเดียวกับ backend ที่ `/api/v1/docs` และ OpenAPI JSON อยู่ที่ `/api/v1/openapi.json`

## Endpoint Scope

Canonical routes ของกลุ่มนี้มี `4` endpoints และใน Swagger แสดง `8` operations เพราะเพิ่ม annual path variants อีก `4` รายการสำหรับ `stationId/{buddhistYear}`

| งาน                       | Method | Path                                                                      | Auth   | Permission               | Canonical contract                                                                         |
| ------------------------- | ------ | ------------------------------------------------------------------------- | ------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| อ่านสถิติข้อมูล           | `GET`  | `/api/v1/connected-measurement-points/:stationId/measurement-statistics`  | Bearer | `dashboard.stats:view`   | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |
| ส่งออก CSV                | `GET`  | `/api/v1/connected-measurement-points/:stationId/measurement-export.csv`  | Bearer | `dashboard.stats:export` | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |
| อ่านปฏิทินสถานะ           | `GET`  | `/api/v1/connected-measurement-points/:stationId/calendar-status`         | Bearer | `dashboard.stats:view`   | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |
| อ่านรายละเอียดปฏิทินสถานะ | `GET`  | `/api/v1/connected-measurement-points/:stationId/calendar-status/details` | Bearer | `dashboard.stats:view`   | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |

## Notes

- Query `startDate` และ `endDate` ใช้ validation ตาม implementation จริงใน route/controller เดียวกับ shared connected measurement points
- Swagger เพิ่ม annual variants เพื่อให้ทดสอบกรณี reverse proxy แตก path เป็น `:stationId/:buddhistYear` ได้จากหน้าเดียว
- CSV export ใช้ endpoint เดิมและยังคืน `text/csv`

## Maintainer Links

- Routes: `backend/src/modules/connection-requests/connected-measurement-points.routes.ts`
- OpenAPI: `backend/src/modules/api-docs/connection-requests.openapi.ts`
- Swagger aggregation: `backend/src/modules/api-docs/poms.openapi.ts`
