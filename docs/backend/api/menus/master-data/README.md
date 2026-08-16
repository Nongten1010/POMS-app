# ข้อมูลพื้นฐาน

> Owner: Backend

## Frontend Quick Start

กลุ่มนี้ใน Swagger ใช้รวม API อ่านข้อมูลจุดตรวจวัดที่เชื่อมต่อแล้ว ประวัติคำขอที่ผูกกับจุด และ device configuration ปัจจุบัน เพื่อให้เปิดดูและกดเทสได้จากเมนูเดียว

หน้า interactive test ใช้ชุดเดียวกับ backend ที่ `/api/v1/docs` และ OpenAPI JSON อยู่ที่ `/api/v1/openapi.json`

## Endpoint Scope

Canonical routes ของกลุ่มนี้มี `6` endpoints และใน Swagger แสดง `10` operations เพราะเพิ่ม annual path variants อีก `4` รายการสำหรับ `stationId/{buddhistYear}`

| งาน                                | Method | Path                                                             | Auth   | Permission                | Canonical contract                                                                         |
| ---------------------------------- | ------ | ---------------------------------------------------------------- | ------ | ------------------------- | ------------------------------------------------------------------------------------------ |
| อ่านจุดที่เชื่อมต่อแล้ว            | `GET`  | `/api/v1/connected-measurement-points`                           | Bearer | `cems_wpms_requests:view` | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |
| อ่านจุดของโรงงาน                   | `GET`  | `/api/v1/connected-measurement-points/factories/:factoryId`      | Bearer | `cems_wpms_requests:view` | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |
| อ่านประวัติคำขอของจุด              | `GET`  | `/api/v1/connected-measurement-points/:stationId/requests`       | Bearer | `cems_wpms_requests:view` | [Shared connected measurement points](../../shared/connected-measurement-points/README.md) |
| อ่าน prefill ฟอร์มเพิ่มพารามิเตอร์ | `GET`  | `/api/v1/connected-measurement-points/:stationId/parameter-form` | Bearer | `cems_wpms_requests:view` | [ขอเชื่อมต่อ](../connection-requests/README.md#add-parameter-prefill)                      |
| อ่าน config ปัจจุบัน               | `GET`  | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:view` | [Device configs](../connection-requests/device-configs.md)                                 |
| แทนที่ config ปัจจุบัน             | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:edit` | [Device configs](../connection-requests/device-configs.md)                                 |

## Notes

- ถ้า `stationId` มี `/` อยู่ในรหัส ต้อง URL-encode เป็น `%2F` เมื่อเรียก path ปกติ
- Swagger เพิ่ม annual variants เพื่อให้ทดสอบกรณี reverse proxy แตก path เป็น `:stationId/:buddhistYear` ได้จากหน้าเดียว
- Contract เต็มของ payload และ response อยู่ที่หน้า shared/connection ที่ลิงก์ไว้ด้านบน ไม่คัดลอกซ้ำในหน้านี้

## Maintainer Links

- Routes: `backend/src/modules/connection-requests/connected-measurement-points.routes.ts`
- OpenAPI: `backend/src/modules/api-docs/connection-requests.openapi.ts`
- Swagger aggregation: `backend/src/modules/api-docs/poms.openapi.ts`
