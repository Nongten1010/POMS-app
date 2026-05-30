# Device Connections API

API สำหรับตั้งค่าและทดสอบการเชื่อมต่ออุปกรณ์/แหล่งข้อมูลของ station เช่น MODBUS RTU, MODBUS TCP, MSSQL, MYSQL

## Endpoints

| Method | Path | Auth | Permission | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/device-connections` | No | - | รายการ config ตาม station |
| `GET` | `/api/v1/device-connections/:id` | No | - | รายละเอียด config |
| `POST` | `/api/v1/device-connections` | Yes | `cems_wpms_requests:edit` | บันทึก config |
| `POST` | `/api/v1/device-connections/test-connection` | Yes | `cems_wpms_requests:edit` | ทดสอบ config แบบ mock |

หมายเหตุ: `GET` endpoints ยังเปิด public ตาม route ปัจจุบัน แต่ `POST` ต้อง login

## Protocol Values

```text
MODBUS_RTU
MODBUS_TCP
MSSQL
MYSQL
```

## `GET /api/v1/device-connections`

### Query

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `stationId` | string | Yes | 1-64 chars | station ที่ต้องการดู config |
| `protocol` | string | No | protocol values | filter เฉพาะ protocol |

ถ้า database ไม่มี config backend จะ fallback เป็น mock config ตาม `stationId`

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "stationId": "STATION-001",
      "protocol": "MODBUS_TCP",
      "settings": {
        "hostIp": "192.168.1.10",
        "slaveId": 1,
        "port": 502
      },
      "channels": [
        {
          "addressId": 40001,
          "dataType": "NOx",
          "unit": "ppm",
          "valueRange": {
            "min": 0,
            "max": 1000
          },
          "valueFormat": "MEASUREMENT_VALUE",
          "offset": 0,
          "encoding": "FLOAT32_BIG_ENDIAN"
        }
      ],
      "createdBy": 1,
      "createdAt": "2026-05-30T00:00:00.000Z",
      "updatedAt": "2026-05-30T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## `GET /api/v1/device-connections/:id`

คืน config เดี่ยว ถ้าไม่พบใน database จะหาใน mock source ต่อ

```json
{
  "success": true,
  "data": {
    "id": 1,
    "stationId": "STATION-001",
    "protocol": "MODBUS_TCP",
    "settings": {},
    "channels": []
  }
}
```

## `POST /api/v1/device-connections`

บันทึก config ใหม่ address ของ channel ต้องไม่ซ้ำกันใน config เดียวกัน

### Common Field

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `stationId` | string | Yes | station id, 1-64 chars |
| `protocol` | string | Yes | protocol values |
| `settings` | object | Yes | schema เปลี่ยนตาม protocol |
| `channels` | array | Yes | 1-200 items |

### MODBUS RTU Request

```json
{
  "stationId": "STATION-001",
  "protocol": "MODBUS_RTU",
  "settings": {
    "comPort": 1,
    "slaveId": 1,
    "baudRate": 9600,
    "parity": "NONE",
    "stopBits": 1,
    "dataBits": 8,
    "quantity": 2,
    "valueRange": {
      "min": 0,
      "max": 1000
    }
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "NOx",
      "unit": "ppm",
      "valueRange": {
        "min": 0,
        "max": 1000
      },
      "valueFormat": "MEASUREMENT_VALUE",
      "offset": 0,
      "encoding": "FLOAT32_BIG_ENDIAN"
    }
  ]
}
```

### MODBUS TCP Request

```json
{
  "stationId": "STATION-001",
  "protocol": "MODBUS_TCP",
  "settings": {
    "hostIp": "192.168.1.10",
    "slaveId": 1,
    "port": 502
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "NOx",
      "unit": "ppm",
      "valueRange": {
        "min": 0,
        "max": 1000
      },
      "valueFormat": "MEASUREMENT_VALUE",
      "offset": 0,
      "encoding": "FLOAT32_BIG_ENDIAN"
    }
  ]
}
```

### MSSQL Request

```json
{
  "stationId": "STATION-001",
  "protocol": "MSSQL",
  "settings": {
    "hostIp": "192.168.1.20",
    "port": 1433,
    "dbUser": "readonly",
    "dbPass": "secret",
    "dbName": "poms_source"
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "NOx",
      "unit": "ppm",
      "offset": 0
    }
  ]
}
```

### MYSQL Request

```json
{
  "stationId": "STATION-001",
  "protocol": "MYSQL",
  "settings": {
    "hostIp": "192.168.1.30",
    "port": 3306,
    "dbUser": "readonly",
    "dbPass": "secret",
    "dbName": "poms_source"
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "NOx",
      "unit": "ppm",
      "offset": 0
    }
  ]
}
```

### Settings Validation

| Protocol | Field | Rule |
| --- | --- | --- |
| `MODBUS_RTU` | `comPort` | positive integer |
| `MODBUS_RTU` | `slaveId` | positive integer |
| `MODBUS_RTU` | `baudRate` | `2400`, `4800`, `9600`, `14400`, `19200`, `38400` |
| `MODBUS_RTU` | `parity` | `EVEN`, `ODD`, `NONE`, default `NONE` |
| `MODBUS_RTU` | `stopBits` | `1` หรือ `2`, default `1` |
| `MODBUS_RTU` | `dataBits` | `7` หรือ `8`, default `8` |
| `MODBUS_RTU` | `quantity` | positive integer |
| `MODBUS_TCP` | `hostIp` | IPv4 |
| `MODBUS_TCP` | `slaveId` | positive integer |
| `MODBUS_TCP` | `port` | 1-65535, default `502` |
| `MSSQL` | `hostIp` | IPv4 |
| `MSSQL` | `port` | 1-65535, default `1433` |
| `MYSQL` | `hostIp` | IPv4 |
| `MYSQL` | `port` | 1-65535, default `3306` |
| `MSSQL`, `MYSQL` | `dbUser`, `dbPass`, `dbName` | required string |

### Channel Validation

| Protocol | Field | Rule |
| --- | --- | --- |
| all | `addressId` | integer >= 40001, ห้ามซ้ำใน config เดียวกัน |
| all | `dataType` | required, 1-128 chars |
| all | `unit` | required, 1-64 chars |
| all | `offset` | number |
| MODBUS only | `valueRange.min`, `valueRange.max` | number และ `min <= max` |
| MODBUS only | `valueFormat` | `MEASUREMENT_VALUE`, `CURRENT`, `VOLTAGE`, default `MEASUREMENT_VALUE` |
| MODBUS only | `encoding` | enum ตามรายการด้านล่าง |

### MODBUS Encoding Values

```text
SIGNED
UNSIGNED
BIG_ENDIAN
LITTLE_ENDIAN
SIGNED16_BIG_ENDIAN
SIGNED16_LITTLE_ENDIAN
UNSIGNED16_BIG_ENDIAN
UNSIGNED16_LITTLE_ENDIAN
SIGNED32_BIG_ENDIAN
SIGNED32_LITTLE_ENDIAN
UNSIGNED32_BIG_ENDIAN
UNSIGNED32_LITTLE_ENDIAN
FLOAT32_BIG_ENDIAN
FLOAT32_LITTLE_ENDIAN
FLOAT64_BIG_ENDIAN
FLOAT64_LITTLE_ENDIAN
```

## `POST /api/v1/device-connections/test-connection`

ใช้ request body เหมือน `POST /api/v1/device-connections` แต่ไม่บันทึกลง database และตอบผล mock

### Success Response

```json
{
  "success": true,
  "data": {
    "success": true,
    "mode": "MOCK",
    "protocol": "MODBUS_TCP",
    "stationId": "STATION-001",
    "message": "Mock connection succeeded",
    "checkedAt": "2026-05-30T00:00:00.000Z",
    "details": {
      "endpoint": "192.168.1.10:502:slave-1",
      "channelCount": 1
    }
  }
}
```

## Business Errors

| HTTP | Case |
| --- | --- |
| `400` | IP ไม่ใช่ IPv4, port ผิด, channel ว่าง, address ซ้ำ |
| `401` | POST โดยไม่มี token |
| `403` | ไม่มี `cems_wpms_requests:edit` |
| `404` | ไม่พบ config id |
