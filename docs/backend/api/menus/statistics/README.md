# สถิติข้อมูล

> Owner: Backend

## Frontend Quick Start

กลุ่มนี้ใน Swagger ใช้รวม API สถิติข้อมูลของจุดตรวจวัด, ปฏิทินสถานะ และการส่งออก CSV เพื่อให้เจ้าหน้าที่ทดสอบ query/path ได้จากเมนูเดียว สถิติและปฏิทินของหน้าหลักใช้ [กติกาเวลาและการแสดงผลร่วมกัน](../../shared/connected-measurement-points/README.md#home-measurement-rules)

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

- สถิติใช้ `date`; calendar ใช้ `month` และ optional `endDate`; details ใช้ `year` และ optional `endDate` โดยส่งวันสิ้นสุดเดียวกับ calendar เพื่อให้ drill-down ตรงกับจำนวนวันที่เลือก
- `endDate` ของ calendar/details ต้องเป็นวันจริงในเดือน/ปีที่ขอและไม่เกินวันนี้ตาม `Asia/Bangkok`; เมื่อไม่ส่งใช้วันที่น้อยกว่าระหว่างวันนี้กับวันสิ้นเดือน/ปีตาม endpoint
- วันปัจจุบันนับเฉพาะชั่วโมงที่จบแล้ว ใช้เวลาตรวจวัด `cdate`/`ctime` จัด bucket และเวลาส่งจากเครื่อง `udate`/`utime` ตรวจเส้นตาย โดยใช้เวลาต้นทางที่ปรับเป็น `Asia/Bangkok` แล้วตาม [กติกาหน้าหลัก](../../shared/connected-measurement-points/README.md#home-measurement-rules) ข้อมูลส่งช้าใช้ `lateData` เมื่อค่าปกติ และคง `warning`/`exceeded` เมื่อเข้าเกณฑ์นั้น
- `data.summary` ของสถิติ/calendar เป็นผลรวมของจุด; `exceededDays` นับวันไม่ซ้ำตั้งแต่ต้นปีถึงวันสิ้นสุด ส่วน `lowDataDays` เป็นช่วงต่ำกว่า 80% ต่อเนื่องล่าสุด ไม่รวม counters รายพารามิเตอร์เพื่อสร้างยอดวันรวม
- Swagger เพิ่ม annual variants เพื่อให้ทดสอบกรณี reverse proxy แตก path เป็น `:stationId/:buddhistYear` ได้จากหน้าเดียว
- CSV export ใช้ query `startDate`/`endDate` และยังคืน `text/csv` ตาม contract เดิม กติกาหน้าหลักไม่เปลี่ยน CSV หรือ API ของเมนูอื่น

## Maintainer Links

- Routes: `backend/src/modules/connection-requests/connected-measurement-points.routes.ts`
- OpenAPI: `backend/src/modules/api-docs/connection-requests.openapi.ts`
- Swagger aggregation: `backend/src/modules/api-docs/poms.openapi.ts`
