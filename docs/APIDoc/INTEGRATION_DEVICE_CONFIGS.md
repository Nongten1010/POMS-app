# Integration Device Config APIs

เอกสาร API สำหรับระบบภายนอก/worker ที่ต้องดึง device config ปัจจุบันของจุดตรวจวัดที่เชื่อมต่อแล้ว เพื่อเอาไปตั้งค่าการอ่านข้อมูลจริง

## Base URL

```text
http://localhost:3000/api/v1
```

## Authentication

API ชุดนี้ไม่ใช้ user token (`Authorization: Bearer ...`) แต่ใช้ integration key:

```http
X-API-Key: <integration-key>
```

Backend อ่าน key จาก environment variable เฉพาะ endpoint นี้:

```bash
DEVICE_CONFIG_API_KEYS=device-config-key-1,device-config-key-2
```

หมายเหตุ backward compatibility: ถ้ายังไม่ได้ตั้ง `DEVICE_CONFIG_API_KEYS` ระบบจะ fallback ไปอ่าน `INTEGRATION_API_KEYS` ชั่วคราวเพื่อไม่ให้ deployment เดิมพังทันที แต่ production ใหม่ควรแยก key ตาม endpoint

หมายเหตุ:

- เก็บ key ไว้ใน `.env`/secret manager เท่านั้น ห้าม commit key จริง
- API นี้เป็น read-only
- `dbPass` ใน response มาจาก active device config ที่ backend hydrate แล้ว และถูก mask เป็น `********` ตาม policy ป้องกัน secret รั่ว

## Endpoint Summary

| รายการ | Method | Path | Auth |
| --- | --- | --- | --- |
| ดึง config สำหรับระบบ integration | GET | `/integrations/device-configs/:stationId` | `X-API-Key` |

## GET `/integrations/device-configs/:stationId`

ใช้ดึง config ปัจจุบันของจุดตรวจวัดที่เชื่อมต่อแล้วเท่านั้น เช่น `S0002` หรือ `P0001`

```bash
curl "http://localhost:3000/api/v1/integrations/device-configs/S0002" \
  -H "X-API-Key: $INTEGRATION_API_KEY"
```

Response แยกเป็น 3 ชุด:

| Field | Description |
| --- | --- |
| `deviceConfigs` | ข้อมูล connection ของอุปกรณ์ แยก 1 row ต่อ 1 device |
| `parameterConfigs` | ข้อมูล register/parameter/standard แยก 1 row ต่อ 1 channel/parameter |
| `statusSchedules` | ตารางตั้งเวลาเปลี่ยนสถานะ แยก 1 row ต่อ 1 parameter |

ตัวอย่าง response:

```json
{
  "success": true,
  "data": {
    "stationId": "S0002",
    "deviceConfigs": [
      {
        "deviceCode": "S0002/01",
        "protocol": "MODBUS_TCP",
        "hostIp": "127.0.0.1",
        "port": 1,
        "slaveId": 1,
        "comPort": null,
        "baudRate": null,
        "parity": null,
        "stopBits": null,
        "dataBits": null,
        "quantity": null,
        "dbUser": null,
        "dbPass": null,
        "dbName": null,
        "deviceValueRangeMin": null,
        "deviceValueRangeMax": null
      },
      {
        "deviceCode": "S0002/02",
        "protocol": "MODBUS_RTU",
        "hostIp": null,
        "port": null,
        "slaveId": 1,
        "comPort": 1,
        "baudRate": 9600,
        "parity": "NONE",
        "stopBits": 1,
        "dataBits": 8,
        "quantity": 1,
        "dbUser": null,
        "dbPass": null,
        "dbName": null,
        "deviceValueRangeMin": 20,
        "deviceValueRangeMax": 200
      }
    ],
    "parameterConfigs": [
      {
        "deviceCode": "S0002/01",
        "addressId": 40001,
        "parameter": "NOx (ppm)",
        "valueRange": { "min": 0, "max": 200 },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 0,
        "encoding": "UNSIGNED16_BIG_ENDIAN",
        "standardCriteria": 120,
        "eiaCriteria": null,
        "status": "Normal"
      },
      {
        "deviceCode": "S0002/01",
        "addressId": 40002,
        "parameter": "SO2 (ppm)",
        "valueRange": { "min": 0, "max": 500 },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 0,
        "encoding": "UNSIGNED16_BIG_ENDIAN",
        "standardCriteria": 300,
        "eiaCriteria": 250,
        "status": "Normal"
      }
    ],
    "statusSchedules": [
      {
        "parameter": "NOx (ppm)",
        "startAt": "2026-06-13T00:00:00+07:00",
        "endAt": "2026-06-13T06:00:00+07:00",
        "status": "Calibration"
      },
      {
        "parameter": "SO2 (ppm)",
        "startAt": "2026-06-13T00:00:00+07:00",
        "endAt": "2026-06-13T06:00:00+07:00",
        "status": "Calibration"
      }
    ]
  }
}
```

## Field Dictionary

### `deviceConfigs[]`

| Field | Type | Description |
| --- | --- | --- |
| `deviceCode` | string | รหัสอุปกรณ์ เช่น `S0002/01` |
| `protocol` | string | `MODBUS_RTU`, `MODBUS_TCP`, `MSSQL`, `MYSQL` |
| `hostIp` | string|null | IP สำหรับ TCP/database |
| `port` | number|null | port สำหรับ TCP/database |
| `slaveId` | number|null | Slave ID สำหรับ Modbus |
| `comPort` | number|null | COM port สำหรับ `MODBUS_RTU` |
| `baudRate` | number|null | baud rate สำหรับ `MODBUS_RTU` |
| `parity` | string|null | parity สำหรับ `MODBUS_RTU` |
| `stopBits` | number|null | stop bits สำหรับ `MODBUS_RTU` |
| `dataBits` | number|null | data bits สำหรับ `MODBUS_RTU` |
| `quantity` | number|null | quantity สำหรับ `MODBUS_RTU` |
| `dbUser` | string|null | database user สำหรับ `MSSQL`/`MYSQL` |
| `dbPass` | string|null | database password แบบ masked |
| `dbName` | string|null | database name |
| `deviceValueRangeMin` | number|null | ช่วงข้อมูลตรวจวัด min จาก connection card |
| `deviceValueRangeMax` | number|null | ช่วงข้อมูลตรวจวัด max จาก connection card |

### `parameterConfigs[]`

| Field | Type | Description |
| --- | --- | --- |
| `deviceCode` | string | รหัสอุปกรณ์ที่ channel นี้ผูกอยู่ |
| `addressId` | number | register/address/field id |
| `parameter` | string | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `NOx (ppm)` |
| `valueRange` | object|null | ช่วงข้อมูลของ channel เช่น `{ "min": 0, "max": 200 }` |
| `valueFormat` | string|null | `MEASUREMENT_VALUE`, `CURRENT`, `VOLTAGE` หรือ `null` |
| `offset` | number | offset |
| `encoding` | string|null | encoding สำหรับ Modbus |
| `standardCriteria` | number|string|null | `standardValue` ตามประกาศ อก.; parse เป็น number เมื่อทำได้ |
| `eiaCriteria` | number|string|null | `standardValue` ตาม EIA; parse เป็น number เมื่อทำได้ |
| `status` | string | สถานะ parameter เช่น `Normal`, `Calibration`, `Maintenance` |

### `statusSchedules[]`

| Field | Type | Description |
| --- | --- | --- |
| `parameter` | string | พารามิเตอร์ที่ได้รับผล; ถ้าเลือกทั้งหมดจะเป็น `ทั้งหมด` |
| `startAt` | string|null | วันเวลาเริ่มใช้สถานะ |
| `endAt` | string|null | วันเวลาสิ้นสุดสถานะ |
| `status` | string | สถานะที่จะใช้ในช่วงเวลานั้น |

## Error Responses

ไม่มี/ส่ง API key ผิด:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid integration API key"
  }
}
```

ไม่พบจุดตรวจวัดที่เชื่อมต่อแล้ว:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Connected measurement point not found"
  }
}
```
