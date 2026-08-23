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
| `data.measurementPointType` | `CEMS` \| `WPMS` \| `MOBILE` \| `STATION` \| `UNKNOWN` | No | ประเภทสรุปสำหรับ client; ใช้ field นี้เมื่อต้องเลือก flow ตามประเภทจุดตรวจวัด |
| `data.systemType` | `CEMS` \| `WPMS` | No | ระบบหลักของจุดตรวจวัดจาก connected-point snapshot |
| `data.pointType` | `STACK` \| `WASTEWATER` \| `OTHER` | No | ประเภททางกายภาพของจุดตรวจวัด |
| `data.monitoringPointKind` | `CEMS` \| `WPMS` \| `MOBILE` \| `STATION` | Yes | ประเภทจุดที่ normalize เป็นตัวพิมพ์ใหญ่; เป็น `null` เมื่อข้อมูลต้นทางไม่มีหรือไม่อยู่ใน enum |
| `data.deviceConfigs` | object[] | No | หนึ่งรายการต่อ active device config |
| `data.parameterConfigs` | object[] | No | หนึ่งรายการต่อ channel/parameter |
| `data.statusSchedules` | object[] | No | หนึ่งรายการต่อ parameter และช่วงสถานะ |

หากพบ connected point แต่ยังไม่มี active device config ระบบตอบ arrays ว่างและยังเป็น `200 OK`

#### การแยกประเภทจุดตรวจวัด

| Source metadata | `measurementPointType` | หมายเหตุ |
| --- | --- | --- |
| `systemType=CEMS`, `pointType=STACK`, kind เป็น `CEMS` หรือไม่มีค่า | `CEMS` | รองรับข้อมูลเดิมที่ยังไม่มี `monitoringPointKind` |
| `systemType=WPMS`, `pointType=WASTEWATER`, kind เป็น `WPMS` หรือไม่มีค่า | `WPMS` | รองรับข้อมูลเดิมที่ยังไม่มี `monitoringPointKind` |
| `pointType=OTHER`, `monitoringPointKind=MOBILE` | `MOBILE` | `systemType` ยังคงเป็น `CEMS` หรือ `WPMS` ตามระบบหลัก |
| `pointType=OTHER`, `monitoringPointKind=STATION` | `STATION` | แยกจาก Mobile ด้วย `monitoringPointKind` |
| ข้อมูลไม่ครบ ขัดแย้ง หรือ kind ไม่อยู่ใน enum | `UNKNOWN` | ระบบไม่เดาประเภทจาก `OTHER` เพียงอย่างเดียว |

ตัวอย่าง metadata ทั้งสี่ประเภท:

```json
[
  {
    "measurementPointType": "CEMS",
    "systemType": "CEMS",
    "pointType": "STACK",
    "monitoringPointKind": "CEMS"
  },
  {
    "measurementPointType": "WPMS",
    "systemType": "WPMS",
    "pointType": "WASTEWATER",
    "monitoringPointKind": "WPMS"
  },
  {
    "measurementPointType": "MOBILE",
    "systemType": "CEMS",
    "pointType": "OTHER",
    "monitoringPointKind": "MOBILE"
  },
  {
    "measurementPointType": "STATION",
    "systemType": "WPMS",
    "pointType": "OTHER",
    "monitoringPointKind": "STATION"
  }
]
```

#### `deviceConfigs[]`

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `deviceCode` | string | No | รหัสอุปกรณ์; backend สร้าง display code จาก station และลำดับเมื่อ config ไม่มีค่า |
| `protocol` | `POMS_BOX` \| `MODBUS_RTU` \| `MODBUS_TCP` \| `MSSQL` \| `MYSQL` | No | protocol ของอุปกรณ์ |
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
| `testMode` | boolean | No | `true` เมื่อ channel ถูกตั้งเป็นโหมดทดสอบ; config เดิมหรือ request ที่ไม่ส่งค่าให้คืน `false` |
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
| `parameter` | string | No | display label พร้อมหน่วยของพารามิเตอร์ที่ได้รับผล; backend ขยาย `ทั้งหมด` เป็น parameter ที่ configure ไว้แล้ว |
| `startAt` | string | Yes | วันเวลาเริ่มใช้สถานะรูปแบบ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone; เป็น `null` ได้เฉพาะข้อมูล legacy |
| `endAt` | string | Yes | วันเวลาสิ้นสุดสถานะรูปแบบ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone; เป็น `null` ได้เฉพาะข้อมูล legacy |
| `status` | `Normal` \| `Calibration` \| `Defective` \| `Maintenance` \| `Start up` \| `Shut Down` \| `No Discharge` \| `Turnaround` \| `Etc.` | No | สถานะที่ใช้ในช่วงเวลา |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "stationId": "S0002",
    "measurementPointType": "CEMS",
    "systemType": "CEMS",
    "pointType": "STACK",
    "monitoringPointKind": "CEMS",
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
        "testMode": true,
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
    "statusSchedules": [
      {
        "parameter": "NOx (ppm)",
        "startAt": "2026-08-05 08:00:00",
        "endAt": "2026-08-05 10:00:00",
        "status": "Maintenance"
      },
      {
        "parameter": "NOx (ppm)",
        "startAt": "2026-08-05 10:00:00",
        "endAt": "2026-08-05 11:00:00",
        "status": "Calibration"
      }
    ]
  }
}
```

### Validation And Business Rules

- `stationId` รับ legacy safe identifier ที่ประกอบด้วยตัวอักษร ตัวเลข `_` หรือ `-` และ annual code เช่น `WEMS-0003/2571`
- เมื่อ annual code อยู่ใน path client ต้อง encode `/` เป็น `%2F`; backend รองรับกรณี reverse proxy decode slash ก่อนส่งต่อด้วย
- API คืนเฉพาะจุดที่มี active row ใน `cems_wpms_connected_measurement_points`; ไม่พบจุดให้ตอบ `404`
- `deviceConfigs` อ่านเฉพาะ active config ของ canonical station ID
- `systemType`, `pointType` และ `monitoringPointKind` อ่านจาก connected-point snapshot และไม่ถูกเก็บซ้ำใน device config แต่ละรายการ
- `monitoringPointKind` normalize แบบไม่สนตัวพิมพ์ใหญ่-เล็กและช่องว่างหัวท้าย โดยคืนเฉพาะ `CEMS`, `WPMS`, `MOBILE`, `STATION` หรือ `null`
- `measurementPointType` เป็น field สรุป; ระบบคืน `UNKNOWN` เมื่อข้อมูลขัดแย้งหรือไม่พอสำหรับจำแนกอย่างปลอดภัย
- `Mobile` และ `Station` ต้องใช้ `pointType=OTHER` ร่วมกับ `monitoringPointKind`; ระบบไม่แยกสองประเภทนี้จาก `systemType` เพียงอย่างเดียว
- การเพิ่ม response fields รอบนี้ไม่เปลี่ยน connection-request write validator; API จะคืน `MOBILE`/`STATION` เมื่อ connected-point snapshot มี kind ดังกล่าวอยู่แล้วเท่านั้น
- settings ที่ไม่มีค่าแปลงเป็น `null`; `minuteTableName`, `fiveMinuteTableName` และ `hourlyTableName` มีค่ากับ `MSSQL`/`MYSQL` เมื่อบันทึกไว้
- `dbPass` คืนค่าจริงเฉพาะ endpoint integration นี้; device-config endpoint สำหรับ UI และระบบภายในอื่นยังคง mask เป็น `********`
- success response กำหนด `Cache-Control: no-store`; client ต้องไม่ cache response และห้ามบันทึก `X-API-Key` หรือ response body ลง log
- `parameterConfigs.addressId`, `offset`, `valueRange.min` และ `valueRange.max` รักษา `null` ตาม storage contract
- `parameterConfigs.testMode` คืนเป็น boolean เสมอ เพื่อให้ Worker แยก channel ทดสอบออกจาก channel ปกติ; endpoint นี้ส่งต่อสถานะ แต่ไม่กำหนดนโยบายการเก็บค่าหรือสร้าง Alert ของ Worker
- `parameterName` และ `parameterUnit` แยกจากวงเล็บท้าย `parameter`; client ควรใช้ `parameter` เป็น display label ที่มีชื่อพร้อมหน่วย
- `standardCriteria`, `eiaCriteria`, `standardCondition`, `dryBasis` และ `oxygenOrExcessAir` จับคู่กับเครื่องมือของ connected point ด้วยชื่อพารามิเตอร์พร้อมหน่วยก่อน หากต้อง fallback แบบไม่รวมหน่วยจะใช้เฉพาะกรณีที่ตรงเพียงรายการเดียว
- ค่าในกลุ่มการรายงานค่าเป็น `null` เมื่อข้อมูลต้นทางไม่ได้บันทึกค่า หรือไม่พบพารามิเตอร์ต้นทางที่จับคู่ได้; ค่า `false` จะคงเป็น `false` และไม่ถูกแปลงเป็น `null`
- `statusSchedules` ตัดรายการซ้ำที่มี `parameter`, `startAt`, `endAt` และ `status` เหมือนกัน
- `statusSchedules` ขยาย schedule ที่เลือก `ทั้งหมด` เป็นหนึ่งรายการต่อ parameter ใน active device channels และไม่คืนคำว่า `ทั้งหมด` เป็น machine value
- `statusSchedules` เรียงตามเวลา `startAt`, parameter, `endAt` และ status อย่างแน่นอน; schedule legacy ที่ไม่มีเวลาเรียงไว้ท้ายรายการ
- จุดตรวจวัดหนึ่งจุดตั้งเวลาได้หลายช่วง และพารามิเตอร์เดียวกันมีช่วงต่อเนื่องกันได้ โดยช่วงเวลาที่ backend รับเข้าใช้ขอบเขตแบบ `[startAt, endAt)`
- ข้อมูลใหม่ใช้ `startAt` และ `endAt` รูปแบบ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone และ `endAt` ต้องมากกว่า `startAt`; ค่า `null` ใน response มีไว้รองรับข้อมูล legacy เท่านั้น

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
- Device config storage: [`device-connections.repository.ts`](../../../../../backend/src/modules/device-connections/device-connections.repository.ts), [`0083_relax_device_config_form_constraints.ts`](../../../../../backend/src/db/migrations/0083_relax_device_config_form_constraints.ts), [`0086_validate_device_status_management_json.ts`](../../../../../backend/src/db/migrations/0086_validate_device_status_management_json.ts), [`0087_allow_poms_box_device_protocol.ts`](../../../../../backend/src/db/migrations/0087_allow_poms_box_device_protocol.ts)
- Tests: [`integration-device-configs.route.test.ts`](../../../../../backend/tests/unit/integration-device-configs.route.test.ts), [`integration-device-configs.service.test.ts`](../../../../../backend/tests/unit/integration-device-configs.service.test.ts)
- Evidence: [การรายงานค่าต่อพารามิเตอร์](../../../evidence/integrations/device-config-parameter-reporting.tdd.md), [ประเภทจุดตรวจวัด](../../../evidence/integrations/device-config-point-types.tdd.md)
