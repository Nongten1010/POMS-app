# Parameter Values API

API สำหรับดึงค่าพารามิเตอร์จากฐานข้อมูล external parameter ingestion ตาม env:

```text
PARAMETER_DB_NAME=parameter_ingest
PARAMETER_DB_SCHEMA=ingest
PARAMETER_DB_TABLE=parameter_values
```

ปัจจุบัน backend อ่านจากตารางกว้างราย station/interval เช่น `ingest.S0001_data_real` ก่อน ส่วน `PARAMETER_DB_TABLE=parameter_values` เตรียมไว้สำหรับ normalized table ในอนาคต

## Endpoints

| Method | Path | Auth | Permission | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/parameter-values/tables` | No | - | รายการตารางใน schema `PARAMETER_DB_SCHEMA` |
| `GET` | `/api/v1/parameter-values` | No | - | ดึงข้อมูลจากตารางของ station/interval พร้อม pagination |
| `GET` | `/api/v1/parameter-values/latest` | No | - | ดึง row ล่าสุดของ station/interval |

หมายเหตุ: endpoints ชุดนี้ยังเปิด public ตาม route ปัจจุบัน เพื่อให้อุปกรณ์/client ที่ไม่มี token ดึงข้อมูลได้ ระวังอย่า expose production โดยไม่มี network/access control เพิ่มเติม

## Interval Values

```text
real
1m
5m
60m
1day
test
```

การ map table:

```text
{stationId}_data_{interval}
```

ตัวอย่าง:

| stationId | interval | table |
| --- | --- | --- |
| `S0001` | `real` | `ingest.S0001_data_real` |
| `S0001` | `1m` | `ingest.S0001_data_1m` |
| `S0001` | `5m` | `ingest.S0001_data_5m` |
| `S0001` | `60m` | `ingest.S0001_data_60m` |
| `S0001` | `1day` | `ingest.S0001_data_1day` |
| `S0001` | `test` | `ingest.S0001_data_test` |

## `GET /api/v1/parameter-values/tables`

คืนรายการตารางทั้งหมดใน schema ที่ตั้งค่าไว้ (`PARAMETER_DB_SCHEMA`)

### Example

```bash
curl "http://localhost:3000/api/v1/parameter-values/tables"
```

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "schemaName": "ingest",
      "tableName": "S0001_data_real",
      "columnCount": 392,
      "rowCount": 1
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## `GET /api/v1/parameter-values`

ดึงข้อมูลจากตารางของ `stationId` และ `interval` พร้อม pagination

### Query

| Field | Type | Required | Default | Validation | Description |
| --- | --- | --- | --- | --- | --- |
| `stationId` | string | Yes | - | 1-64 chars, pattern `^[A-Za-z][A-Za-z0-9_]*$` | station id เช่น `S0001` |
| `interval` | string | No | `real` | interval values | รอบข้อมูลที่ต้องการ |
| `limit` | number | No | `100` | 1-1000 | จำนวน row ที่ต้องการ |
| `offset` | number | No | `0` | >= 0 | offset สำหรับ pagination |

### Example

```bash
curl "http://localhost:3000/api/v1/parameter-values?stationId=S0001&interval=real&limit=100&offset=0"
```

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "station_id": "S0001",
      "co2_value": null,
      "co2_units": null,
      "co2_status": null,
      "cdate": "2026-06-04",
      "ctime": "10:00:23",
      "udate": "2026-06-04",
      "utime": "10:00:23"
    }
  ],
  "meta": {
    "stationId": "S0001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S0001_data_real",
    "limit": 100,
    "offset": 0,
    "count": 1,
    "hasMore": false
  }
}
```

Response `data[]` คืนทุก column จาก source table ปัจจุบัน โดย `S0001_*` มี 392 fields ตาม `table_structure.xlsx`

## `GET /api/v1/parameter-values/latest`

ดึง row ล่าสุดของ `stationId` และ `interval`

### Query

| Field | Type | Required | Default | Validation | Description |
| --- | --- | --- | --- | --- | --- |
| `stationId` | string | Yes | - | 1-64 chars, pattern `^[A-Za-z][A-Za-z0-9_]*$` | station id เช่น `S0001` |
| `interval` | string | No | `real` | interval values | รอบข้อมูลที่ต้องการ |

### Example

```bash
curl "http://localhost:3000/api/v1/parameter-values/latest?stationId=S0001&interval=real"
```

### Success Response

```json
{
  "success": true,
  "data": {
    "station_id": "S0001",
    "co2_value": null,
    "co2_units": null,
    "co2_status": null,
    "cdate": "2026-06-04",
    "ctime": "10:00:23",
    "udate": "2026-06-04",
    "utime": "10:00:23"
  },
  "meta": {
    "stationId": "S0001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S0001_data_real",
    "limit": 1,
    "offset": 0,
    "count": 1,
    "hasMore": false
  }
}
```

ถ้าตารางมีอยู่แต่ยังไม่มีข้อมูล `data` จะเป็น `null`

## Errors

### Validation error

เกิดเมื่อ query ผิด เช่น `interval=15m`, `limit` เกิน 1000, หรือ `stationId` มีอักขระไม่ปลอดภัย

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "interval": ["Invalid option: expected one of ..."]
    }
  }
}
```

### Table not found

เกิดเมื่อไม่มีตารางตาม `stationId + interval`

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Parameter value table ingest.S9999_data_real not found"
  }
}
```

## Data Notes

- ใช้ schema ตาม `PARAMETER_DB_SCHEMA`; ตอนนี้คือ `ingest`
- ตาราง `dbo.S0001_*` ที่เคยสร้างไว้เป็นชุดซ้ำจากก่อนเปลี่ยน schema ไม่ใช่ source หลักของ API นี้
- API sort ด้วย `cdate DESC, ctime DESC`
- ค่า `cdate`/`udate` serialize เป็น `YYYY-MM-DD`
- ค่า `ctime`/`utime` serialize เป็น `HH:mm:ss`
