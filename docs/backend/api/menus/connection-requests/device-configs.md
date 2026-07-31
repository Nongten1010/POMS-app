# ตั้งค่าอุปกรณ์ของจุดตรวจวัด

[กลับไปหน้าขอเชื่อมต่อ](./README.md)

หน้า contract นี้ใช้ร่วมกันทั้งการตั้งค่าอุปกรณ์ระหว่างคำขอเชื่อมต่อและการแก้ค่าของจุดตรวจวัดที่เชื่อมต่อแล้ว โดย frontend ใช้ dialog และรูปแบบข้อมูลชุดเดียวกัน แต่เลือก endpoint ตาม context

## Endpoint Summary

| งาน | Method | Path | Permission |
| --- | --- | --- | --- |
| อ่านค่าในแบบตั้งค่าอุปกรณ์ของคำขอ | `GET` | `/api/v1/cems-wpms-requests/:id/device-configs?stationId=:stationId` | `cems_wpms_requests:view` |
| บันทึกค่าอุปกรณ์ระหว่างคำขอ | `POST` | `/api/v1/cems-wpms-requests/:id/device-configs` | `cems_wpms_requests:edit` |
| อ่านค่าอุปกรณ์ปัจจุบันของจุดที่เชื่อมต่อแล้ว | `GET` | `/api/v1/connected-measurement-points/:stationId/device-configs` | `cems_wpms_requests:view` |
| แทนที่ค่าอุปกรณ์ปัจจุบันของจุดที่เชื่อมต่อแล้ว | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | `cems_wpms_requests:edit` |

## Shared Request Contract

POST ทั้งสอง endpoint รับ body ได้สามรูปแบบ:

1. config เดี่ยวแบบ normalized;
2. batch แบบ `{ "configs": [...] }` จำนวน 1-50 configs;
3. form payload แบบ `{ "config": { "stationId", "device", "channels", "statusManagement" } }` ซึ่ง frontend ใช้เมื่อมีหลายอุปกรณ์หรือแก้จุดที่เชื่อมต่อแล้ว

`stationId` และ `protocol` ยังเป็นข้อมูลโครงสร้างที่จำเป็นสำหรับระบุตัวจุดและชนิดการเชื่อมต่อ ส่วนค่าที่ผู้ใช้กรอกใน `settings`, `channels` และ `statusManagement` เป็น optional/nullable ตามตารางด้านล่าง

แต่ละ config รับได้ไม่เกิน 200 channels ขีดจำกัดจำนวน config/channel เป็น structural payload limit ไม่ใช่ business validation ของค่าในแบบ

### Config Fields

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `stationId` | string | Yes | No | รหัสหรือชื่อจุดตรวจวัด ต้องตรงกับจุดใน request หรือ `:stationId` ใน path |
| `deviceCode` | string | No | Yes | รหัสอุปกรณ์; ใช้จับคู่ `device` กับ `channels` เมื่อส่ง form payload |
| `protocol` | `MODBUS_RTU` \| `MODBUS_TCP` \| `MSSQL` \| `MYSQL` | Yes | No | discriminator ของ config แต่ละอุปกรณ์ |
| `settings` | object | No | Yes | ถ้าไม่ส่งหรือส่ง `null` backend normalize เป็น `{}`; field ภายในเป็น optional และส่ง `null` ได้ |
| `channels` | array | No | Yes | ถ้าไม่ส่งหรือส่ง `null` backend normalize เป็น `[]` |
| `statusManagement` | object | No | Yes | ถ้าไม่ส่ง, ส่ง `null` หรือส่งข้อมูลไม่ครบ backend เก็บเป็น `null` |

### Database Settings

ใช้กับ `MSSQL` และ `MYSQL`:

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `settings.hostIp` | string | No | Yes | host ของฐานข้อมูล |
| `settings.port` | number | No | Yes | port ของฐานข้อมูล |
| `settings.dbUser` | string | No | Yes | username |
| `settings.dbPass` | string | No | Yes | password จริงที่ต้องบันทึก; response สำหรับ UI ใช้ `********` แทน secret เดิม และเมื่อ client ส่ง placeholder นี้กลับมา backend จะรักษารหัสจริงเดิมไว้ |
| `settings.dbName` | string | No | Yes | ชื่อฐานข้อมูล |
| `settings.minuteTableName` | string | No | Yes | ชื่อ Table ข้อมูลแบบรายนาที |
| `settings.fiveMinuteTableName` | string | No | Yes | ชื่อ Table ข้อมูลแบบราย 5 นาที |
| `settings.hourlyTableName` | string | No | Yes | ชื่อ Table ข้อมูลแบบรายชั่วโมง |
| `settings.valueRange` | object | No | Yes | ช่วงค่าระดับอุปกรณ์; ส่ง `null` ได้ |
| `settings.valueRange.min` | number | No | Yes | ค่าต่ำสุด |
| `settings.valueRange.max` | number | No | Yes | ค่าสูงสุด |

### Modbus Settings

| Protocol | Optional nullable fields in `settings` |
| --- | --- |
| `MODBUS_RTU` | `comPort`, `slaveId`, `baudRate`, `parity`, `stopBits`, `dataBits`, `quantity`, `valueRange` |
| `MODBUS_TCP` | `hostIp`, `slaveId`, `port`, `valueRange` |

### Channel Fields

`channels` ว่างได้ หากส่งสมาชิกใน array สมาชิกนั้นต้องมี `dataType` เพื่อเป็น structural identifier ของพารามิเตอร์

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `deviceCode` | string | Conditional | Yes | ใช้ใน form payload เพื่อจับคู่ channel กับอุปกรณ์; ละได้เมื่อมีอุปกรณ์เดียว |
| `addressId` | number | No | Yes | Address ID; backend ไม่บังคับค่าต่ำสุดและไม่ตรวจค่าซ้ำใน config เดียวกัน |
| `dataType` | string | Yes, when row exists | No | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `CO (ppm)` |
| `unit` | string | No | Yes | รองรับ legacy payload; backend ต่อหน่วยท้าย `dataType` เมื่อชื่อยังไม่มีหน่วย |
| `valueRange` | object | No | Yes | ช่วงค่าของ channel |
| `valueRange.min` | number | No | Yes | ค่าต่ำสุด |
| `valueRange.max` | number | No | Yes | ค่าสูงสุด |
| `alertLow` | number | No | Yes | ค่าแจ้งเตือนต่ำ |
| `alertHigh` | number | No | Yes | ค่าแจ้งเตือนสูง |
| `valueFormat` | string | No | Yes | รูปแบบค่า เช่น `MEASUREMENT_VALUE`, `CURRENT`, `VOLTAGE`; backend ไม่ตรวจ enum เชิง business |
| `offset` | number | No | Yes | offset ของค่าที่อ่าน |
| `encoding` | string | No | Yes | รูปแบบ encoding; backend ไม่ตรวจ enum เชิง business |
| `status` | string | No | Yes | สถานะพารามิเตอร์ |

### Status-management Fields

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `selectedParameters` | string[] | No | Yes | รายการพารามิเตอร์ที่ใช้สถานะ |
| `startAt` | string | No | Yes | เวลาเริ่ม |
| `endAt` | string | No | Yes | เวลาสิ้นสุด |
| `status` | string | No | Yes | สถานะที่เลือก |
| `schedules` | array | No | Yes | ตารางสถานะเพิ่มเติม |

### Server-managed Identity And Relations

Client ไม่ส่ง primary key/foreign key ของตารางโดยตรง:

| Persistence field | Role | Client behavior |
| --- | --- | --- |
| config `id` | primary key | backend สร้าง |
| config `requestId` | nullable foreign key ไปยัง request | backend กำหนดจาก `:id` ใน request-bound endpoint; current connected config อาจไม่มีค่า |
| channel `id` | primary key | backend สร้าง |
| channel `configId` | foreign key ไปยัง config | backend กำหนดหลังสร้าง config |

ชุด `(stationId, protocol, deviceCode)` ยังเป็น identity ของอุปกรณ์และต้องไม่ซ้ำกันใน batch เดียวกัน ส่วน `addressId` ไม่ใช่ primary key/foreign key และสามารถเป็น `null` หรือซ้ำกันได้

## `GET /api/v1/cems-wpms-requests/:id/device-configs`

อ่านข้อมูลสำหรับ prefill dialog จาก config ของ request ที่ผู้เรียกมีสิทธิ์อ่าน และตอบ `200 OK`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: scope ของ permission และ region/province/owner ที่ผูกกับ request

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | integer | Yes | ID ของคำขอ |
| `stationId` | query | string | Conditional | frontend ส่งเพื่อเลือกจุดที่กำลังตั้งค่า; หากไม่ส่ง backend ใช้จุดแรกใน request |

### Request Example

ไม่มี request body:

```text
GET /api/v1/cems-wpms-requests/101/device-configs?stationId=CEMS-0001%2F2569
```

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data.requestId` | number | No | ID ของคำขอ |
| `data.requestNo` | string | No | เลขคำขอ |
| `data.stationId` | string | No | จุดที่ response นี้ใช้อ้างอิง |
| `data.monitoringPoint` | object | Yes | snapshot ของจุดตรวจวัด |
| `data.parameterOptions` | string[] | No | รายชื่อพารามิเตอร์พร้อมหน่วยสำหรับ dropdown |
| `data.deviceCodeOptions` | string[] | No | ตัวเลือกรหัสอุปกรณ์ |
| `data.connectionForms` | object[] | No | ค่า prefill ของแต่ละอุปกรณ์ |
| `data.connectionForms[].values` | object | No | ค่า `settings` ในรูปแบบ string สำหรับ form; ค่า `null` แสดงเป็น `""` |
| `data.parameterMappings` | object[] | No | ค่า prefill ของ channel; ค่า nullable แสดงเป็น `""` |
| `data.statusManagement` | object | No | ค่า prefill สถานะ; ใช้ default `Normal` เมื่อไม่มีค่าที่บันทึก |
| `data.rawConfigs` | object | No | config รูปแบบ machine-readable ซึ่งรักษา `null` ไว้ |
| `data.testResults` | unknown[] | No | ผลทดสอบการเชื่อมต่อ; ปัจจุบันคืน array |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "requestId": 101,
    "requestNo": "CEMS-69-00101",
    "stationId": "CEMS-0001/2569",
    "monitoringPoint": {
      "id": 55,
      "pointName": "ปล่องระบาย 1",
      "pointCode": "CEMS-0001/2569",
      "pointType": "STACK",
      "parameters": ["CO (ppm)"]
    },
    "parameterOptions": ["CO (ppm)"],
    "deviceCodeOptions": ["CEMS-0001/2569/01"],
    "connectionForms": [
      {
        "id": 12,
        "configId": 12,
        "type": "Microsoft SQL",
        "protocol": "MSSQL",
        "deviceCode": "CEMS-0001/2569/01",
        "values": {
          "hostIp": "",
          "port": "",
          "dbUser": "",
          "dbPass": "",
          "dbName": "",
          "minuteTableName": "measurements_1m",
          "fiveMinuteTableName": "measurements_5m",
          "hourlyTableName": "measurements_1h",
          "measureMin": "",
          "measureMax": ""
        }
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    },
    "parameterMappings": [],
    "testResults": [],
    "rawConfigs": {
      "stationId": "CEMS-0001/2569",
      "device": [
        {
          "deviceCode": "CEMS-0001/2569/01",
          "protocol": "MSSQL",
          "settings": {
            "hostIp": null,
            "port": null,
            "dbUser": null,
            "dbPass": null,
            "dbName": null,
            "minuteTableName": "measurements_1m",
            "fiveMinuteTableName": "measurements_5m",
            "hourlyTableName": "measurements_1h",
            "valueRange": null
          }
        }
      ],
      "channels": [],
      "statusManagement": {
        "selectedParameters": ["ทั้งหมด"],
        "startAt": null,
        "endAt": null,
        "status": "Normal",
        "schedules": []
      }
    }
  }
}
```

### Validation And Business Rules

- `stationId` ใน query ควรเป็น `pointCode` หรือ `pointName` ของจุดใน request; frontend ต้องส่งค่าเมื่อ dialog เปิดจากจุดที่ผู้ใช้เลือก
- API นี้ยังตรวจ authentication, permission และ data scope ตาม request

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `id` หรือ `stationId` ผิดชนิด/โครงสร้าง | ตรวจ identifier |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้องหรือหมดอายุ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission หรือ request อยู่นอก data scope | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ request | refresh รายการ |

## `POST /api/v1/cems-wpms-requests/:id/device-configs`

สร้าง config ที่ผูกกับ request ระหว่างสถานะ `WAITING_CONNECTION` และตอบ `201 Created`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: ผู้เรียกต้องเป็นเจ้าของ request

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | integer | Yes | ID ของคำขอ |
| body | body | config object \| batch object \| form payload | Yes | ใช้ schema ใน [Shared Request Contract](#shared-request-contract) |

### Request Example

```json
{
  "stationId": "CEMS-0001/2569",
  "deviceCode": "CEMS-0001/2569/01",
  "protocol": "MSSQL",
  "settings": {
    "hostIp": null,
    "port": null,
    "dbUser": null,
    "dbPass": null,
    "dbName": null,
    "minuteTableName": "measurements_1m",
    "fiveMinuteTableName": "measurements_5m",
    "hourlyTableName": "measurements_1h",
    "valueRange": null
  },
  "channels": []
}
```

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อบันทึกสำเร็จ |
| `data` | object \| object[] | No | machine-readable config จัดกลุ่มตาม `stationId`; batch หลาย station คืน array |
| `data.stationId` | string | No | รหัสจุดตรวจวัด |
| `data.device` | object[] | No | protocol, device code และ settings ของอุปกรณ์ |
| `data.channels` | object[] | No | channel ที่บันทึก โดยค่าที่ว่างยังเป็น `null` |
| `data.statusManagement` | object | No | ค่าสถานะที่บันทึก หรือ default form status |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "stationId": "CEMS-0001/2569",
    "device": [
      {
        "deviceCode": "CEMS-0001/2569/01",
        "protocol": "MSSQL",
        "settings": {
          "hostIp": null,
          "port": null,
          "dbUser": null,
          "dbPass": null,
          "dbName": null,
          "minuteTableName": "measurements_1m",
          "fiveMinuteTableName": "measurements_5m",
          "hourlyTableName": "measurements_1h",
          "valueRange": null
        }
      }
    ],
    "channels": [],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    }
  }
}
```

### Validation And Business Rules

- `stationId` ต้องตรงกับ `pointCode` หรือ `pointName` ของ measurement point ใน request
- ผู้เรียกต้องเป็นเจ้าของ request และ request ต้องอยู่สถานะ `WAITING_CONNECTION`
- เมื่อ `settings.dbPass` เป็น `********` backend จะใช้รหัสจริงของ active config ที่มี `stationId + protocol + deviceCode` เดียวกัน; หากไม่มีรหัสจริงให้รักษา ต้องตอบ `400 BAD_REQUEST` และ client ต้องให้ผู้ใช้กรอกรหัสใหม่
- backend ไม่ตรวจ required, format, IP, port range, Address ID range, min/max order, alert order, encoding/value-format enum หรือ Address ID ซ้ำของค่าที่ผู้ใช้กรอกใน config
- backend ยังตรวจโครงสร้าง JSON, `stationId`, `protocol`, ความสัมพันธ์ request-station และขนาด batch/channel เพื่อป้องกัน payload ผิดรูปแบบหรือใหญ่เกินกำหนด

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | body ไม่มี `stationId`/`protocol` หรือโครงสร้างผิด | แก้โครงสร้าง payload |
| `400` | `BAD_REQUEST` | station ไม่อยู่ใน request หรือ request ไม่ได้อยู่สถานะ `WAITING_CONNECTION` | refresh request และเลือก station ใหม่ |
| `400` | `BAD_REQUEST` | ส่ง `settings.dbPass = "********"` แต่ไม่มีรหัสจริงเดิมให้รักษา | ให้ผู้ใช้กรอกรหัสฐานข้อมูลจริงใหม่ |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้องหรือหมดอายุ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission หรือไม่ใช่เจ้าของ request | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ request | refresh รายการ |

## `GET /api/v1/connected-measurement-points/:stationId/device-configs`

อ่าน config ปัจจุบันและ form prefill ของจุดที่เชื่อมต่อแล้ว และตอบ `200 OK`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: scope ของ permission และ region/province/owner ของ connected request ล่าสุด

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัสจุดตรวจวัด; encode `/` เป็น `%2F` เมื่อสร้าง URL |

### Request Example

ไม่มี request body:

```text
GET /api/v1/connected-measurement-points/CEMS-0001%2F2569/device-configs
```

### Success Response Fields

Response ใช้ schema เดียวกับ [GET ของ request](#success-response-fields) โดย `requestId` และ `requestNo` มาจาก connected request ล่าสุดที่ผู้เรียกมีสิทธิ์อ่าน

### Success Response Example

```json
{
  "success": true,
  "data": {
    "requestId": 101,
    "requestNo": "CEMS-69-00101",
    "stationId": "CEMS-0001/2569",
    "monitoringPoint": {
      "id": 55,
      "pointName": "ปล่องระบาย 1",
      "pointCode": "CEMS-0001/2569",
      "pointType": "STACK",
      "parameters": []
    },
    "parameterOptions": [],
    "deviceCodeOptions": ["CEMS-0001/2569/01"],
    "connectionForms": [],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    },
    "parameterMappings": [],
    "testResults": [],
    "rawConfigs": {
      "stationId": "CEMS-0001/2569",
      "device": [],
      "channels": [],
      "statusManagement": {
        "selectedParameters": ["ทั้งหมด"],
        "startAt": null,
        "endAt": null,
        "status": "Normal",
        "schedules": []
      }
    }
  }
}
```

### Validation And Business Rules

- backend ค้นหา connected request ล่าสุดของ `stationId` ภายใน data scope ก่อนอ่าน config
- ค่า `stationId` ยังคงเป็น routing/identity field และไม่เป็น optional

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `stationId` ผิดโครงสร้าง | ตรวจรหัสจุด |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้องหรือหมดอายุ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission หรือจุดอยู่นอก data scope | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ connected point ใน scope | refresh รายการจุด |

## `POST /api/v1/connected-measurement-points/:stationId/device-configs`

แทนที่ config ปัจจุบันทั้งหมดของ `stationId` หลังยืนยันว่าจุดเชื่อมต่อแล้วและอยู่ใน edit scope ของผู้เรียก จากนั้นตอบ `201 Created`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: scope ของ permission และ region/province/owner ของ connected request ล่าสุด

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | จุดที่ต้องการแทนที่ config |
| body | body | config object \| batch object \| form payload | Yes | ทุก config ใน body ต้องใช้ `stationId` เดียวกับ path |

### Request Example

```json
{
  "config": {
    "stationId": "CEMS-0001/2569",
    "device": [
      {
        "deviceCode": null,
        "protocol": "MYSQL",
        "settings": {
          "hostIp": null,
          "port": null,
          "dbUser": null,
          "dbPass": null,
          "dbName": null,
          "minuteTableName": null,
          "fiveMinuteTableName": null,
          "hourlyTableName": null,
          "valueRange": null
        }
      }
    ],
    "channels": [
      {
        "deviceCode": null,
        "addressId": null,
        "dataType": "CO (ppm)",
        "valueRange": {
          "min": null,
          "max": null
        },
        "alertLow": null,
        "alertHigh": null,
        "valueFormat": null,
        "offset": null,
        "encoding": null,
        "status": null
      }
    ],
    "statusManagement": {
      "selectedParameters": null,
      "startAt": null,
      "endAt": null,
      "status": null,
      "schedules": []
    }
  }
}
```

### Success Response Fields

Response ใช้ schema เดียวกับ [POST ของ request](#success-response-fields-1) และคืน config ชุดใหม่หลังแทนที่ค่าปัจจุบัน

### Success Response Example

```json
{
  "success": true,
  "data": {
    "stationId": "CEMS-0001/2569",
    "device": [
      {
        "deviceCode": "CEMS-0001/2569/01",
        "protocol": "MYSQL",
        "settings": {
          "hostIp": null,
          "port": null,
          "dbUser": null,
          "dbPass": null,
          "dbName": null,
          "minuteTableName": null,
          "fiveMinuteTableName": null,
          "hourlyTableName": null,
          "valueRange": null
        }
      }
    ],
    "channels": [
      {
        "deviceCode": "CEMS-0001/2569/01",
        "addressId": null,
        "dataType": "CO (ppm)",
        "valueRange": {
          "min": null,
          "max": null
        },
        "alertLow": null,
        "alertHigh": null,
        "valueFormat": null,
        "offset": null,
        "encoding": null,
        "status": null
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    }
  }
}
```

### Validation And Business Rules

- `stationId` ใน body ทุก config ต้องตรงกับ `:stationId` ใน path
- backend ตรวจว่ามี connected request ล่าสุดของจุดและผู้เรียกมี edit scope
- endpoint นี้ใช้ replace semantics: config ปัจจุบันของ station ถูกแทนที่ด้วยชุดที่ส่งมา
- เมื่อ `settings.dbPass` เป็น `********` backend จะรักษารหัสจริงของ config เดิมที่มี device key เดียวกัน; หากข้อมูลเดิมเป็น placeholder หรือไม่มีรหัสจริง ต้องกรอกรหัสใหม่
- business validation ของ form fields ถูกถอดเหมือน POST ของ request; frontend เป็นผู้ตรวจ required/format/range/duplicate ก่อนเรียก API
- primary key และ foreign key เช่น config ID, channel ID, request/config relation เป็น server-managed และ client ไม่ต้องส่ง

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | body ไม่มี `stationId`/`protocol` หรือโครงสร้างผิด | แก้โครงสร้าง payload |
| `400` | `BAD_REQUEST` | `stationId` ใน body ไม่ตรงกับ path | ใช้ station เดียวกับจุดที่เลือก |
| `400` | `BAD_REQUEST` | ส่ง `settings.dbPass = "********"` แต่ไม่มีรหัสจริงเดิมให้รักษา | ให้ผู้ใช้กรอกรหัสฐานข้อมูลจริงใหม่ |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้องหรือหมดอายุ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission หรือจุดอยู่นอก edit scope | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ connected point ใน scope | refresh รายการจุด |

## Backend Maintainer Links

- Request routes: [`connection-requests.routes.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts)
- Connected-point routes: [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts)
- Controller and form mapper: [`connection-requests.controller.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts), [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- Device validator and types: [`device-connections.validator.ts`](../../../../../backend/src/modules/device-connections/device-connections.validator.ts), [`device-connections.types.ts`](../../../../../backend/src/modules/device-connections/device-connections.types.ts)
- Persistence: [`device-connections.service.ts`](../../../../../backend/src/modules/device-connections/device-connections.service.ts), [`device-connections.repository.ts`](../../../../../backend/src/modules/device-connections/device-connections.repository.ts)
- Migration: [`0083_relax_device_config_form_constraints.ts`](../../../../../backend/src/db/migrations/0083_relax_device_config_form_constraints.ts)
- Validator/service tests: [`device-connections.validator.test.ts`](../../../../../backend/tests/unit/device-connections.validator.test.ts), [`device-connections.service.test.ts`](../../../../../backend/tests/unit/device-connections.service.test.ts), [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts)
- Route tests: [`connected-measurement-points.route.test.ts`](../../../../../backend/tests/unit/connected-measurement-points.route.test.ts), [`connection-requests.create.route.test.ts`](../../../../../backend/tests/unit/connection-requests.create.route.test.ts)
