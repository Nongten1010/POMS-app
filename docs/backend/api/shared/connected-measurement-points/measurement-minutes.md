# ข้อมูลรายนาทีของชั่วโมงที่เลือก

[กลับไปหน้าข้อมูลจุดตรวจวัด](./README.md) · [หน้าหลัก](../../menus/home/README.md)

## Frontend Quick Start

เรียกเมื่อผู้ใช้เปิด dialog ของชั่วโมงในตารางรายชั่วโมงเท่านั้น ใช้รหัสจุด วันที่ และชั่วโมงจากช่องที่คลิก ไม่โหลดรายนาทีล่วงหน้าทั้งวัน ไม่รีเฟรชอัตโนมัติ และปิด dialog แล้วคงตัวเลือกเดิม

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/connected-measurement-points/S0199/measurement-minutes?date=2026-11-11&hour=09' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

ใช้ `data.parameters` เป็นลำดับคอลัมน์พารามิเตอร์พร้อมหน่วย และวางคอลัมน์ `value`/`status` คู่กัน อ่านตารางจาก `data.rows` ซึ่งมี 60 แถวอยู่แล้ว แสดง `null` เป็นขีดโดยเก็บเลข `0` จริงไว้ ไม่ปัดเศษเพิ่มหรือแปลง decimal string ผ่านตัวเลขก่อนแสดงผล หัว dialog ใช้ `stationId`, `pointName`, `date`, `hour` ตาม timezone ที่ส่งมา

`meta.minutesWithData: 0` ให้แสดงสถานะไม่พบข้อมูล; แยกสถานะกำลังโหลดและโหลดไม่สำเร็จ การแสดงคอลัมน์กว้างเท่ากัน ตรึงเวลา และเลื่อนแนวนอนเป็นพฤติกรรมฝั่ง frontend งาน backend นี้ไม่เพิ่มกราฟ Export ตัวกรอง หรือการเปลี่ยนชั่วโมงใน dialog

## `GET /api/v1/connected-measurement-points/:stationId/measurement-minutes`

อ่านตัวอย่างรายนาทีที่จัดเก็บไว้เพื่อเทียบค่ารายชั่วโมงด้วยตนเอง ไม่คำนวณรายชั่วโมงหรือประเมินค่ามลพิษใหม่

### Authentication And Permission

- Authentication: Bearer token
- Permission: `dashboard.stats:view`
- Data scope และการซ่อนโรงงาน/จุด/พารามิเตอร์ใช้เกณฑ์เดียวกับ [สถิติรายชั่วโมง](./README.md#get-apiv1connected-measurement-pointsstationidmeasurement-statistics) รวม scope qualifiers และ assigned factory access
- ไม่เปิดข้อมูลจุดที่ถูกลบ โรงงาน/จุดที่ยกเลิกเชื่อมต่อ โรงงาน inactive หรือจุดที่ยกเว้นทั้งหมด/อยู่ระหว่างขยายเวลา

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัสจุดแบบเดิม หรือ annual code ที่ URL-encode เช่น `CEMS-0001%2F2569` |
| `date` | query | `YYYY-MM-DD` | Yes | วันที่จริงตามปฏิทิน ค.ศ. ตาม `Asia/Bangkok` |
| `hour` | query | string | Yes | ชั่วโมงสองหลัก `00`–`23` เช่น `09` |

รองรับ path alias `/api/v1/connected-measurement-points/:stationId/:buddhistYear/measurement-minutes` เช่น `CEMS-0001/2569/measurement-minutes` ใช้ contract เดียวกัน Query เป็น strict object: ไม่รับช่วงวัน ตัวกรองพารามิเตอร์ pagination หรือ fields อื่น

### Request Example

```http
GET /api/v1/connected-measurement-points/S0199/measurement-minutes?date=2026-11-11&hour=09
```

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` |
| `data.stationId` | string | No | รหัสจุดที่เลือก |
| `data.pointName` | string | No | ชื่อจุด current/live |
| `data.date` | string | No | วันที่ ค.ศ. |
| `data.hour` | string | No | ชั่วโมง `00`–`23` |
| `data.timezone` | string | No | `Asia/Bangkok` |
| `data.parameters` | string[] | No | พารามิเตอร์ที่มีสิทธิ์เห็นพร้อมหน่วย; Flow ใช้ `Flow Rate (m3/hr)` เพียงชื่อเดียว |
| `data.rows` | object[] | No | 60 แถว เรียงจากนาที 00–59 แม้ไม่มีข้อมูล |
| `data.rows[].time` | string | No | เวลา `HH:mm` ในชั่วโมงที่ขอ |
| `data.rows[].values` | object | No | key เป็นพารามิเตอร์พร้อมหน่วย ตรงกับ `data.parameters` |
| `data.rows[].values[label].value` | number หรือ numeric string | Yes | ค่าต้นทาง ไม่ format/ปัดเศษเพิ่ม; ตัวเลขที่เก็บเป็น string คงชนิดและข้อความเดิม รวมช่องว่างรอบค่าที่ต้นทางเก็บ; ขาดหรือไม่ใช่ตัวเลขเป็น `null` |
| `data.rows[].values[label].status` | string | Yes | `Normal`, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `Turnaround`, `Etc.`; ไม่มีสถานะเป็น `null` |
| `data.rows[].values[label].sourceStatus` | number หรือ string | Yes | สถานะต้นทางเดิม ไม่แทนค่าตรวจวัด; ดู mapping ด้านล่าง |
| `data.rows[].values[label].measuredAt` | ISO datetime | Yes | `cdate`/`ctime` ของตัวอย่างที่เลือก พร้อม `+07:00`; ไม่ใช่เวลารับข้อมูล |
| `meta.interval` | string | No | `1m` |
| `meta.minutesWithData` | integer | No | 0–60 จำนวนนาทีที่มีตัวอย่างตรงพารามิเตอร์/หน่วยที่แสดงได้ แม้ค่าหายแต่มีสถานะ; ไม่ใช่ completeness หรือจำนวน Normal |

### Success Response Example

ตัวอย่างชั่วโมงที่มีข้อมูลหนึ่งนาที โดยสถานะ Maintenance ยังคงค่าตรวจวัด:

```json
{
  "success": true,
  "data": {
    "stationId": "S0199",
    "pointName": "Stack",
    "date": "2026-11-11",
    "hour": "09",
    "timezone": "Asia/Bangkok",
    "parameters": ["CO (ppm)"],
    "rows": [
      {"time":"09:00","values":{"CO (ppm)":{"value":12.3456789,"status":"Maintenance","sourceStatus":4,"measuredAt":"2026-11-11T09:00:00+07:00"}}},
      {"time":"09:01","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:02","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:03","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:04","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:05","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:06","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:07","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:08","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:09","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:10","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:11","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:12","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:13","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:14","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:15","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:16","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:17","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:18","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:19","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:20","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:21","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:22","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:23","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:24","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:25","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:26","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:27","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:28","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:29","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:30","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:31","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:32","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:33","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:34","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:35","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:36","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:37","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:38","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:39","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:40","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:41","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:42","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:43","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:44","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:45","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:46","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:47","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:48","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:49","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:50","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:51","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:52","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:53","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:54","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:55","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:56","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:57","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:58","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}},
      {"time":"09:59","values":{"CO (ppm)":{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}}}
    ]
  },
  "meta": {"interval": "1m", "minutesWithData": 1}
}
```

### Validation And Business Rules

- อ่านตาราง `1m` เดิม เฉพาะวันและชั่วโมงที่ขอ ตามเวลาตรวจวัด `cdate`/`ctime` รวมวินาทีและเศษวินาทีสุดท้ายของชั่วโมง ไม่ใช้ `udate`/`utime` เลือกชั่วโมง และไม่ชดเชย timezone ซ้ำ
- ไม่ใช้ evaluator รายชั่วโมง: ไม่ซ่อนค่าตามสถานะหรือ completeness ไม่คำนวณค่าเฉลี่ยใหม่ และไม่สร้างสถานะ `exceeded`/`lateData` สำหรับรายนาที
- ใช้พารามิเตอร์ที่แสดงได้ในปัจจุบันจาก current/live POMS แยกชื่อกับหน่วย; ค่ากับสถานะต้องมาจาก column family เดียวกัน ไม่ยืมสถานะหรือค่าข้ามหน่วย
- `Flow`, `Flow Rate (m3/hr)` และ `Flow Rate (m³/hr)` ใช้ identity เดียวกันทั้งรายการที่แสดงและรายการที่ลงทะเบียน จึงอ่าน generic `flow_value`/`flow_status` แบบเดิมที่ไม่ระบุหน่วยได้ตามเกณฑ์หน่วยเดียว
- ชื่อที่ลงทะเบียนแบบไม่มีหน่วย เช่น `CO` จะใช้หน่วยเดียวที่ยืนยันได้จากรายการลงทะเบียนปัจจุบันและ `<parameter>_units` ในชั่วโมงที่อ่าน โดยพิจารณาหน่วยที่ซ่อนด้วย เช่น source `co_units: "ppm"` และไม่มีหน่วยอื่นขัดแย้ง คืน `CO (ppm)` พร้อมค่าที่เก็บไว้; ใช้ identity ที่แก้หน่วยแล้วกับตัวอย่างอื่นในชั่วโมงนั้นด้วย และไม่สร้างคอลัมน์ซ้ำเมื่อมีทั้ง `CO` กับ `CO (ppm)`
- หากชื่อไม่มีหน่วยและ metadata/source ไม่ยืนยันหน่วยเดียวได้ คืน `503 MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE` ทั้งคำขอ ไม่เดาหน่วย ไม่คืน key ที่ไม่มีหน่วย และไม่รายงานว่าไม่มีข้อมูล; กรณีชั่วโมงว่างยังคืน 200 ได้เมื่อ metadata ระบุหน่วยเดียวชัดเจน แต่ถ้าทั้งชั่วโมงและ metadata ไม่มีหน่วยจะคืน 503 เช่นกัน ข้อยกเว้นคือ `pH` ซึ่งเป็นพารามิเตอร์ไร้มิติ
- หน่วยเซลเซียส `DegC`, `C°` และ `°C` เทียบเท่ากัน โดยไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างรอบหน่วย ไม่แปลงค่าตัวเลขและคง label ที่ลงทะเบียน เช่น `Temp. (C°)` อ่าน `temp_value: "150.77"`, `temp_units: "DegC"`, `temp_status: "1"` เป็นค่า `"150.77"` พร้อม `Normal`; หน่วย `NULL`/ว่างยังใช้เกณฑ์ generic หน่วยเดียวด้านล่าง ไม่อนุมานเซลเซียสเมื่อมีหน่วยอื่นทำให้กำกวม
- column ที่บ่งชี้หน่วยโดยชื่อใช้ได้เมื่อไม่มีหน่วยในแถว; generic column ที่ไม่มีหน่วยใช้ได้เฉพาะพารามิเตอร์ชื่อเดียวกันที่ลงทะเบียนหน่วยเดียวเมื่อพิจารณาทั้งพารามิเตอร์ที่แสดงและซ่อน และไม่มี column family หน่วยอื่นแข่งกัน ถ้ากำกวมคืนช่องว่าง
- หลายแถวในนาทีเดียว เลือกแยกต่อพารามิเตอร์และหน่วย: `ctime` ล่าสุดก่อน แล้ว `udate` และ `utime` ล่าสุด ไม่เลือกค่ามากสุดและไม่เฉลี่ย หากเวลาเท่ากันทั้งหมด ใช้ลำดับข้อความ JSON ของแถวหลังเรียงชื่อ key เป็นตัวตัดสินคงที่ แถวซ้ำเหมือนกันให้ผลเหมือนกัน และไม่ขึ้นกับลำดับที่ฐานข้อมูลคืน
- ส่งค่าตัวเลขที่เก็บไว้แม้ต้นทางแจ้ง `NoData` หรือ `No Discharge`; สถานะเหล่านี้เป็นคนละข้อมูลกับ value และไม่เปลี่ยนเลขจริงเป็นข้อความ
- ชุด `status` มาตรฐาน map รหัส `1`/`Ok` เป็น `Normal`, รหัส `2`–`8` ตามชื่อสถานะ, รหัส `0` (`NoData`), `9` (`No Discharge`) และสถานะที่ไม่รู้จักเป็น `Etc.` โดย `sourceStatus` เก็บค่าเดิมไว้เสมอ; เมื่อไม่มีสถานะ `status` และ `sourceStatus` เป็น `null` ไม่อนุมาน Normal จากการมีตัวเลข
- ไม่พบตัวอย่างที่ตรงพารามิเตอร์/หน่วย ให้ทั้ง value/status/sourceStatus/measuredAt เป็น `null`; หากมีสถานะแต่ไม่มีค่าตัวเลขยังคงสถานะนั้นไว้
- ไม่พบข้อมูลทั้งชั่วโมงคืน `200` พร้อม 60 ช่องว่างและ `minutesWithData: 0`; ไม่มีตารางรายนาทีคืน `404` ไม่ใช้ข้อมูล real/5m/60m แทน; กรณีหน่วยไม่สมบูรณ์ใช้ 503 ตามกติกาข้างต้น
- Response ใช้ `Cache-Control: no-store` และ rate limit กลาง 300 requests ต่อ 15 นาทีต่อ IP

### Errors

ใช้ [shared error envelope](../common-api/README.md) ยกเว้น `429` ของ global limiter ซึ่งคืนข้อความ `text/plain` ตามระบบเดิม

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | รหัสจุด วันที่ ชั่วโมง หรือ query ไม่ถูกต้อง | ตรวจ request; ไม่ retry อัตโนมัติ |
| `401` | `UNAUTHORIZED` | ไม่มี token หรือ token ไม่ถูกต้อง | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission หรืออยู่นอก scope | แจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่มีจุด/ตารางรายนาที หรือจุดไม่แสดงตามเกณฑ์หน้าหลัก | แจ้งข้อมูลยังไม่พร้อมใช้งาน |
| `429` | — | เกิน global rate limit | รอตาม `Retry-After` |
| `503` | `MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE` | ชื่อพารามิเตอร์ไม่มีหน่วย และ metadata/source ยืนยันหน่วยเดียวไม่ได้ | แสดงข้อมูลยังไม่พร้อมใช้งานและให้ผู้ดูแลตรวจหน่วย; ไม่ retry อัตโนมัติ |
| `500` | `INTERNAL_ERROR` | อ่านข้อมูลล้มเหลว | แสดงโหลดไม่สำเร็จ; ไม่เผย SQL/stack trace |

## Backend Maintainer Links

- Route: [connected-measurement-points.routes.ts](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts)
- Controller: [connection-requests.controller.ts](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts)
- Point access/visibility: [connection-requests.service.ts](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- Reader และ public types: [measurement-minutes.ts](../../../../../backend/src/modules/parameter-values/measurement-minutes.ts)
- Query: [parameter-values.repository.ts](../../../../../backend/src/modules/parameter-values/parameter-values.repository.ts)
- Validator: [parameter-values.validator.ts](../../../../../backend/src/modules/parameter-values/parameter-values.validator.ts)
- OpenAPI: [measurement-minutes.openapi.ts](../../../../../backend/src/modules/api-docs/measurement-minutes.openapi.ts)
- SQL Server test แบบ opt-in: [measurement-minutes.sql-server.test.ts](../../../../../backend/tests/integration/measurement-minutes.sql-server.test.ts)
- Tests: [HTTP](../../../../../backend/tests/unit/measurement-minutes.api.test.ts), [query](../../../../../backend/tests/unit/measurement-minutes.repository.test.ts), [OpenAPI](../../../../../backend/tests/unit/measurement-minutes.openapi.test.ts)

- Evidence: [TDD และผลตรวจ](../../../evidence/home/hourly-minute-details.tdd.md)
