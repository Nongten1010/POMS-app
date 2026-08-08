# ค่าตรวจวัดและการทดสอบข้อมูลเชื่อมต่อ

[กลับไปหน้าขอเชื่อมต่อ](./README.md)

## Frontend Quick Start

อ่านข้อมูลทดสอบล่าสุดของจุดตรวจวัด โดย backend จะใช้ค่าตรวจวัดเฉพาะเมื่อ POMS Client ส่ง `StatusCode = 1`; สถานะอื่นจะแสดงชื่อสถานะแทนค่า:

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/parameter-values/connection-test?stationId=S2001' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## StatusCode Contract

กติกานี้ใช้กับค่าที่จัดรูปสำหรับแสดงผลใน connection test, dashboard, public map และ measurement statistics:

| `StatusCode` | POMS Client status | ค่าที่แสดง |
| ---: | --- | --- |
| `0` | `NoData` | `NoData` |
| `1` | `Ok` | ใช้ค่าใน `*_value` |
| `2` | `Calibration` | `Calibration` |
| `3` | `Defective` | `Defective` |
| `4` | `Maintenance` | `Maintenance` |
| `5` | `Start up` | `Start up` |
| `6` | `Shut Down` | `Shut Down` |
| `7` | `Turnaround` | `Turnaround` |
| `8` | `Etc.` | `Etc.` |
| `9` | `No Discharge` | `No Discharge` |

- Source รองรับทั้ง integer เช่น `6`, numeric string เช่น `"6"` และชื่อสถานะเดิม เช่น `Maintenance`.
- ถ้า source ส่งชื่อสถานะเดิม `Normal` หรือ `Ok` จะใช้ค่าตรวจวัด.
- Raw endpoints `/parameter-values` และ `/parameter-values/latest` ไม่แทนค่า `*_value`; client จะได้รับ `*_value` และ `*_status` ตาม source เพื่อใช้ตรวจสอบข้อมูลต้นทาง.

## `GET /api/v1/parameter-values/tables`

คืนเฉพาะตารางค่าตรวจวัดของ station ที่ผู้เรียกมีสิทธิ์อ่าน

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: ตาม scope ของ permission

### Request Fields

Endpoint นี้ไม่มี path, query หรือ request body fields

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data[].schemaName` | string | No | schema ของ parameter source database |
| `data[].tableName` | string | No | ชื่อตาราง `{stationId}_data_{interval}` |
| `data[].columnCount` | integer | No | จำนวนคอลัมน์ |
| `data[].rowCount` | integer | No | จำนวนแถว |
| `meta.total` | integer | No | จำนวนตารางที่คืน |

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "schemaName": "ingest",
      "tableName": "S2001_data_real",
      "columnCount": 392,
      "rowCount": 24
    }
  ],
  "meta": { "total": 1 }
}
```

## `GET /api/v1/parameter-values`

อ่าน raw rows ของ station และ interval ตามช่วงวันที่ โดยคืนเฉพาะคอลัมน์ของพารามิเตอร์ที่ลงทะเบียน

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: ตาม scope ของ permission

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | query | string | Yes | รหัสจุดตรวจวัด ความยาวไม่เกิน 64 ตัวอักษร |
| `interval` | query | enum string | No | `real`, `1m`, `5m`, `60m`, `1day` หรือ `test`; default `real` |
| `startDate` | query | `YYYY-MM-DD` | Yes | วันเริ่มต้น |
| `endDate` | query | `YYYY-MM-DD` | Yes | วันสิ้นสุด ต้องไม่น้อยกว่า `startDate` |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data[]` | object[] | No | raw source rows หลังกรอง registered parameters |
| `data[].*_value` | unknown | Yes | ค่าตรวจวัดดิบ ไม่ถูกแทนด้วยชื่อสถานะ |
| `data[].*_units` | string | Yes | หน่วยของพารามิเตอร์ |
| `data[].*_status` | integer \| string | Yes | StatusCode หรือข้อความจาก source |
| `meta.registeredParameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วยที่ลงทะเบียน |
| `meta.returnedColumns` | string[] | No | คอลัมน์ที่คืนจริง |

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "station_id": "S2001",
      "nox_value": 88.2,
      "nox_units": "ppm",
      "nox_status": 6,
      "cdate": "2026-08-08",
      "ctime": "10:00:00"
    }
  ],
  "meta": {
    "stationId": "S2001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S2001_data_real",
    "startDate": "2026-08-08",
    "endDate": "2026-08-08",
    "count": 1,
    "registeredParameters": ["NOx (ppm)"],
    "returnedColumns": ["station_id", "nox_value", "nox_units", "nox_status", "cdate", "ctime"]
  }
}
```

## `GET /api/v1/parameter-values/latest`

อ่าน raw row ล่าสุดของ station และ interval โดยใช้ contract ของ `*_value`, `*_units` และ `*_status` แบบเดียวกับ list endpoint

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: ตาม scope ของ permission

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | query | string | Yes | รหัสจุดตรวจวัด |
| `interval` | query | enum string | No | `real`, `1m`, `5m`, `60m`, `1day` หรือ `test`; default `real` |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data` | object | Yes | raw row ล่าสุด หรือ `null` เมื่อยังไม่มีข้อมูล |
| `meta.count` | integer | No | `1` เมื่อพบ row หรือ `0` เมื่อไม่พบ |
| `meta.registeredParameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วยที่ลงทะเบียน |
| `meta.returnedColumns` | string[] | No | คอลัมน์ที่คืนจริง |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "station_id": "S2001",
    "nox_value": 88.2,
    "nox_units": "ppm",
    "nox_status": 6,
    "cdate": "2026-08-08",
    "ctime": "10:00:00"
  },
  "meta": {
    "stationId": "S2001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S2001_data_real",
    "count": 1,
    "registeredParameters": ["NOx (ppm)"],
    "returnedColumns": ["station_id", "nox_value", "nox_units", "nox_status", "cdate", "ctime"]
  }
}
```

## `GET /api/v1/parameter-values/connection-test`

อ่านข้อมูลทดสอบล่าสุดไม่เกิน 5 rows และจัดกลุ่มเป็น `values` กับ `statuses` ตามชื่อพารามิเตอร์พร้อมหน่วย

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: current connected point หรือจุดในคำขอสถานะ `WAITING_CONNECTION` ที่ผู้เรียกมีสิทธิ์

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | query | string | Yes | รหัสจุดตรวจวัด |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data[].timestamp` | string | Yes | วันที่และเวลาของ source row |
| `data[].values` | object | No | map จากชื่อพารามิเตอร์พร้อมหน่วยไปยังค่าตรวจวัดเมื่อ status เป็น `1`, `Ok` หรือ `Normal`; status อื่นใช้ชื่อสถานะแทน |
| `data[].statuses` | object | No | map สถานะของพารามิเตอร์; numeric StatusCode ถูกแปลงเป็นชื่อสถานะ |
| `meta.registeredParameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วยที่ลงทะเบียน |

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-08-08 10:15:00",
      "values": {
        "CO (ppm)": "12.5",
        "NOx (ppm)": "Shut Down",
        "Flow Rate (m3/hr)": "No Discharge"
      },
      "statuses": {
        "CO (ppm)": "Ok",
        "NOx (ppm)": "Shut Down",
        "Flow Rate (m3/hr)": "No Discharge"
      }
    }
  ],
  "meta": {
    "stationId": "S2001",
    "interval": "test",
    "schemaName": "ingest",
    "tableName": "S2001_data_test",
    "count": 1,
    "registeredParameters": ["CO (ppm)", "NOx (ppm)", "Flow Rate (m3/hr)"]
  }
}
```

### Validation And Business Rules

- ชื่อ key ใน `values` และ `statuses` ต้องเป็นชื่อพารามิเตอร์พร้อมหน่วยจาก `registeredParameters`.
- StatusCode ที่รองรับคือ `0` ถึง `9`; `9` แสดงเป็น `No Discharge`.
- Status ที่ไม่มีหรือไม่รู้จักยังใช้ค่าเดิมเพื่อรองรับ source rows รุ่นเก่าที่ไม่มี StatusCode.

## Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | query ไม่ผ่าน validation | แก้ `stationId`, interval หรือวันที่ |
| `401` | `UNAUTHORIZED` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403` | `FORBIDDEN` | station อยู่นอก data scope | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ source table | ตรวจ station และ interval |

## Backend Maintainer Links

- Route: [`parameter-values.routes.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.routes.ts)
- Validator: [`parameter-values.validator.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.validator.ts)
- Service: [`parameter-values.service.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.service.ts)
- Status mapping: [`parameter-status.ts`](../../../../../backend/src/modules/parameter-values/parameter-status.ts)
- Types: [`parameter-values.types.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.types.ts)
- Tests: [`parameter-values.service.test.ts`](../../../../../backend/tests/unit/parameter-values.service.test.ts)
