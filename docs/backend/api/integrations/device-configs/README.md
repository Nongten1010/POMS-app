# Integration Device Config

[กลับไป Integration API Index](../README.md)

API read-only สำหรับอุปกรณ์ worker หรือระบบภายนอกดึง active device, parameter และ status config ของจุดตรวจวัดที่เชื่อมต่อแล้ว

## Quick Start

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/integrations/device-configs/S0002' \
  --header 'X-API-Key: <DEVICE_CONFIG_API_KEY>'
```

ใช้ key จาก `DEVICE_CONFIG_API_KEYS` สำหรับ endpoint นี้ หาก deployment เดิมยังไม่ได้กำหนด scoped key ระบบ fallback ไปอ่าน `INTEGRATION_API_KEYS` ชั่วคราว ห้ามเก็บ key จริงใน source code หรือเอกสาร

> คำเตือน: endpoint นี้อาจคืน `dbPass` จริงสำหรับ Worker ที่ต้องเชื่อมฐานข้อมูล จึงต้องเรียกผ่าน HTTPS, จำกัด key เฉพาะระบบที่จำเป็น และห้ามบันทึก header หรือ response body ลง log

## `GET /api/v1/integrations/device-configs/:stationId`

คืน config แยกเป็น `deviceConfigs`, `parameterConfigs` และ `statusSchedules` โดยตอบ `200 OK`

### Authentication And Permission

- Authentication: required ผ่าน header `X-API-Key`
- Permission: device-config integration key
- Data scope: จุดตรวจวัด active ใน `cems_wpms_connected_measurement_points`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | string | Yes | key ใน `DEVICE_CONFIG_API_KEYS`; fallback เป็น `INTEGRATION_API_KEYS` เมื่อ scoped-key list ว่าง |
| `stationId` | path | string | Yes | legacy safe identifier หรือ annual monitoring-point code; ยาว 1-64 ตัวอักษร |

### Request Example

ไม่มี request body:

```text
GET /api/v1/integrations/device-configs/WEMS-0003%2F2571
X-API-Key: <DEVICE_CONFIG_API_KEY>
```

### Success Response Fields

#### Response Root

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data.stationId` | string | No | canonical station ID; ใช้ `pointCode` ก่อนและ fallback เป็น `pointName` |
| `data.deviceConfigs` | object[] | No | หนึ่งรายการต่อ active device config |
| `data.parameterConfigs` | object[] | No | หนึ่งรายการต่อ channel/parameter |
| `data.statusSchedules` | object[] | No | หนึ่งรายการต่อ parameter และช่วงสถานะ |

หากพบ connected point แต่ยังไม่มี active device config ระบบตอบ arrays ว่างและยังเป็น `200 OK`

#### `deviceConfigs[]`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `deviceCode` | string | No | รหัสอุปกรณ์; backend สร้าง display code จาก station และลำดับเมื่อ config ไม่มีค่า |
| `protocol` | `MODBUS_RTU` \| `MODBUS_TCP` \| `MSSQL` \| `MYSQL` | No | protocol ของอุปกรณ์ |
| `hostIp` | string | Yes | host สำหรับ TCP/database |
| `port` | number | Yes | port สำหรับ TCP/database |
| `slaveId` | number | Yes | Slave ID สำหรับ Modbus |
| `comPort` | number | Yes | COM port สำหรับ `MODBUS_RTU` |
| `baudRate` | number | Yes | baud rate สำหรับ `MODBUS_RTU` |
| `parity` | string | Yes | parity สำหรับ `MODBUS_RTU` |
| `stopBits` | number | Yes | stop bits สำหรับ `MODBUS_RTU` |
| `dataBits` | number | Yes | data bits สำหรับ `MODBUS_RTU` |
| `quantity` | number | Yes | quantity สำหรับ `MODBUS_RTU` |
| `dbUser` | string | Yes | database username สำหรับ `MSSQL`/`MYSQL` |
| `dbPass` | string | Yes | database password จริงสำหรับ Worker; เป็น `null` เมื่อไม่ได้ตั้ง ถือเป็นข้อมูลลับและห้าม log |
| `dbName` | string | Yes | ชื่อฐานข้อมูล |
| `minuteTableName` | string | Yes | ชื่อ Table ข้อมูลแบบรายนาที |
| `fiveMinuteTableName` | string | Yes | ชื่อ Table ข้อมูลแบบราย 5 นาที |
| `hourlyTableName` | string | Yes | ชื่อ Table ข้อมูลแบบรายชั่วโมง |
| `deviceValueRangeMin` | number | Yes | ค่าต่ำสุดจาก `settings.valueRange.min` |
| `deviceValueRangeMax` | number | Yes | ค่าสูงสุดจาก `settings.valueRange.max` |

#### `parameterConfigs[]`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `deviceCode` | string | No | รหัสอุปกรณ์ที่ channel ผูกอยู่ |
| `addressId` | number | Yes | register/address/field ID; storage รองรับ `null` |
| `parameter` | string | No | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `NOx (ppm)` |
| `parameterName` | string | Yes | ชื่อพารามิเตอร์ไม่รวมหน่วย เช่น `NOx` |
| `parameterUnit` | string | Yes | หน่วย เช่น `ppm` |
| `valueRange` | object | Yes | ช่วงข้อมูลของ channel |
| `valueRange.min` | number | Yes | ค่าต่ำสุด; เป็น `null` แยกจาก `max` ได้ |
| `valueRange.max` | number | Yes | ค่าสูงสุด; เป็น `null` แยกจาก `min` ได้ |
| `alertLow` | number | Yes | ค่า Alert(Low) |
| `alertHigh` | number | Yes | ค่า Alert(High) |
| `valueFormat` | string | Yes | รูปแบบค่าที่บันทึกใน channel |
| `offset` | number | Yes | offset; storage รองรับ `null` |
| `encoding` | string | Yes | encoding ของ channel |
| `standardCriteria` | number \| string | Yes | `standardValue` ตามประกาศ อก.; แปลงเป็น number เมื่อทำได้ |
| `eiaCriteria` | number \| string | Yes | `standardValue` ตาม EIA; แปลงเป็น number เมื่อทำได้ |
| `standardCondition` | boolean | Yes | การรายงานค่าที่สภาวะมาตรฐาน; `false` หมายถึงไม่ได้เลือก |
| `dryBasis` | boolean | Yes | การรายงานค่าแบบ Dry basis; `false` หมายถึงไม่ได้เลือก |
| `oxygenOrExcessAir` | boolean | Yes | การรายงานค่าแบบ O₂ @ 7% หรือ Excess Air 50%; `false` หมายถึงไม่ได้เลือก |
| `status` | string | No | สถานะ channel; fallback เป็น `Normal` เมื่อ config เก็บ `null` |

#### `statusSchedules[]`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `parameter` | string | No | พารามิเตอร์ที่ได้รับผล; อาจเป็น `ทั้งหมด` |
| `startAt` | string | Yes | วันเวลาเริ่มใช้สถานะ |
| `endAt` | string | Yes | วันเวลาสิ้นสุดสถานะ |
| `status` | string | No | สถานะที่ใช้ในช่วงเวลา |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "stationId": "S0002",
    "deviceConfigs": [
      {
        "deviceCode": "S0002/DB-01",
        "protocol": "MSSQL",
        "hostIp": null,
        "port": null,
        "slaveId": null,
        "comPort": null,
        "baudRate": null,
        "parity": null,
        "stopBits": null,
        "dataBits": null,
        "quantity": null,
        "dbUser": null,
        "dbPass": "<DATABASE_PASSWORD>",
        "dbName": null,
        "minuteTableName": "measurements_1m",
        "fiveMinuteTableName": "measurements_5m",
        "hourlyTableName": "measurements_1h",
        "deviceValueRangeMin": null,
        "deviceValueRangeMax": 500
      }
    ],
    "parameterConfigs": [
      {
        "deviceCode": "S0002/DB-01",
        "addressId": null,
        "parameter": "NOx (ppm)",
        "parameterName": "NOx",
        "parameterUnit": "ppm",
        "valueRange": {
          "min": null,
          "max": 500
        },
        "alertLow": null,
        "alertHigh": null,
        "valueFormat": null,
        "offset": null,
        "encoding": null,
        "standardCriteria": 120,
        "eiaCriteria": null,
        "standardCondition": true,
        "dryBasis": true,
        "oxygenOrExcessAir": false,
        "status": "Normal"
      }
    ],
    "statusSchedules": []
  }
}
```

### Validation And Business Rules

- `stationId` รับ legacy safe identifier ที่ประกอบด้วยตัวอักษร ตัวเลข `_` หรือ `-` และ annual code เช่น `WEMS-0003/2571`
- เมื่อ annual code อยู่ใน path client ต้อง encode `/` เป็น `%2F`; backend รองรับกรณี reverse proxy decode slash ก่อนส่งต่อด้วย
- API คืนเฉพาะจุดที่มี active row ใน `cems_wpms_connected_measurement_points`; ไม่พบจุดให้ตอบ `404`
- `deviceConfigs` อ่านเฉพาะ active config ของ canonical station ID
- settings ที่ไม่มีค่าแปลงเป็น `null`; `minuteTableName`, `fiveMinuteTableName` และ `hourlyTableName` มีค่ากับ `MSSQL`/`MYSQL` เมื่อบันทึกไว้
- `dbPass` คืนค่าจริงเฉพาะ endpoint integration นี้; device-config endpoint สำหรับ UI และระบบภายในอื่นยังคง mask เป็น `********`
- success response กำหนด `Cache-Control: no-store`; client ต้องไม่ cache response และห้ามบันทึก `X-API-Key` หรือ response body ลง log
- `parameterConfigs.addressId`, `offset`, `valueRange.min` และ `valueRange.max` รักษา `null` ตาม storage contract
- `parameterName` และ `parameterUnit` แยกจากวงเล็บท้าย `parameter`; client ควรใช้ `parameter` เป็น display label ที่มีชื่อพร้อมหน่วย
- `standardCriteria`, `eiaCriteria`, `standardCondition`, `dryBasis` และ `oxygenOrExcessAir` จับคู่กับเครื่องมือของ connected point ด้วยชื่อพารามิเตอร์พร้อมหน่วยก่อน หากต้อง fallback แบบไม่รวมหน่วยจะใช้เฉพาะกรณีที่ตรงเพียงรายการเดียว
- ค่าในกลุ่มการรายงานค่าเป็น `null` เมื่อข้อมูลต้นทางไม่ได้บันทึกค่า หรือไม่พบพารามิเตอร์ต้นทางที่จับคู่ได้; ค่า `false` จะคงเป็น `false` และไม่ถูกแปลงเป็น `null`
- `statusSchedules` ตัดรายการซ้ำที่มี `parameter`, `startAt`, `endAt` และ `status` เหมือนกัน

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `stationId` ว่าง ยาวเกิน หรือมีรูปแบบไม่ปลอดภัย | ตรวจและ encode station ID |
| `401` | `UNAUTHORIZED` | ไม่มี `X-API-Key` หรือ key ไม่ถูกต้อง | ตรวจ scoped integration key |
| `404` | `NOT_FOUND` | ไม่พบ connected measurement point ที่ active | หยุดอ่าน config และตรวจ station |

## Backend Maintainer Links

- Route: [`integrations.routes.ts`](../../../../../backend/src/modules/integrations/integrations.routes.ts)
- Authentication: [`integration-api-key.middleware.ts`](../../../../../backend/src/modules/integrations/integration-api-key.middleware.ts)
- Controller: [`integration-device-configs.controller.ts`](../../../../../backend/src/modules/integrations/integration-device-configs.controller.ts)
- Validator: [`integration-device-configs.validator.ts`](../../../../../backend/src/modules/integrations/integration-device-configs.validator.ts)
- Types: [`integration-device-configs.types.ts`](../../../../../backend/src/modules/integrations/integration-device-configs.types.ts)
- Service and repository: [`integration-device-configs.service.ts`](../../../../../backend/src/modules/integrations/integration-device-configs.service.ts), [`integration-device-configs.repository.ts`](../../../../../backend/src/modules/integrations/integration-device-configs.repository.ts)
- Device config storage: [`device-connections.repository.ts`](../../../../../backend/src/modules/device-connections/device-connections.repository.ts), [`0083_relax_device_config_form_constraints.ts`](../../../../../backend/src/db/migrations/0083_relax_device_config_form_constraints.ts)
- Tests: [`integration-device-configs.route.test.ts`](../../../../../backend/tests/unit/integration-device-configs.route.test.ts), [`integration-device-configs.service.test.ts`](../../../../../backend/tests/unit/integration-device-configs.service.test.ts)
- Evidence: [การรายงานค่าต่อพารามิเตอร์](../../../evidence/integrations/device-config-parameter-reporting.tdd.md)
