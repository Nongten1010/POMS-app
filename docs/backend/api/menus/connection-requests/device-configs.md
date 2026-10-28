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

## เลิกใช้ Test mode

คงฟิลด์ `testMode` ใน payload และตำแหน่ง response เดิมทั้งหมด โดย response คืน `false` เสมอทั้ง `channels[]`, `parameterMappings[]`, `rawConfigs.channels[]` และ config ที่ฝังในรายละเอียดคำขอ/รายการจุด แม้ข้อมูลเก่าเก็บ `true`. Payload เดิมที่ส่ง `true` ยังผ่าน validation แต่บันทึกและใช้งานเป็น `false`; `status` เช่น `Normal` หรือ `Maintenance` เป็นอีก field และยังทำงานตามเดิม

ข้อกำหนดนี้ใช้กับ generic `/device-connections`, device-configs ระหว่างคำขอ, device-configs ของจุดปัจจุบัน รวม annual path และ [Integration API สำหรับ Worker](../../integrations/device-configs/README.md). การกดตรวจข้อมูลใช้ [ค่าตรวจวัดตาม protocol](./parameter-values.md#get-apiv1parameter-valuesconnection-test) โดยไม่อ่าน `_data_test`. ดู [การเปลี่ยนผ่านสำหรับ client/Worker](../../CHANGELOG.md#test-mode-retired)

## Shared Request Contract

POST ทั้งสอง endpoint รับ body ได้สามรูปแบบ:

1. config เดี่ยวแบบ normalized;
2. batch แบบ `{ "configs": [...] }` จำนวน 1-50 configs;
3. form payload แบบ `{ "config": { "stationId", "device", "channels", "statusManagement" } }` ซึ่ง frontend ใช้เมื่อมีหลายอุปกรณ์หรือแก้จุดที่เชื่อมต่อแล้ว

`stationId` และ `protocol` ยังเป็นข้อมูลโครงสร้างที่จำเป็นสำหรับระบุตัวจุดและชนิดการเชื่อมต่อ ส่วนค่าที่ผู้ใช้กรอกใน `settings`, `channels` และ `statusManagement` เป็น optional/nullable ตามตารางด้านล่าง ยกเว้น `settings.readFunction` ของ Modbus ซึ่งเป็น optional แต่ไม่รับ `null` หรือสตริงว่าง

แต่ละ config รับได้ไม่เกิน 200 channels ขีดจำกัดจำนวน config/channel เป็น structural payload limit ไม่ใช่ business validation ของค่าในแบบ

### Config Fields

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `stationId` | string | Yes | No | รหัสหรือชื่อจุดตรวจวัด ต้องตรงกับจุดใน request หรือ `:stationId` ใน path |
| `deviceCode` | string | No | Yes | รหัสอุปกรณ์; ใช้จับคู่ `device` กับ `channels` เมื่อส่ง form payload |
| `protocol` | `POMS_BOX` \| `MODBUS_RTU` \| `DCON_ASCII` \| `SERIAL_ASCII` \| `MODBUS_TCP` \| `MSSQL` \| `MYSQL` | Yes | No | discriminator ของ config แต่ละอุปกรณ์ |
| `settings` | object | No | Yes | ถ้าไม่ส่งหรือส่ง `null` backend normalize เป็น `{}`; field ภายในเป็น optional และส่ง `null` ได้ ยกเว้น `readFunction` |
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

### Modbus, DCON และ Serial ASCII Settings

| Protocol | Optional nullable fields in `settings` |
| --- | --- |
| `MODBUS_RTU` | `comPort`, `slaveId`, `baudRate`, `parity`, `stopBits`, `dataBits`, `quantity`, `valueRange` |
| `DCON_ASCII` | `comPort`, `slaveId`, `baudRate`, `parity`, `stopBits`, `dataBits`, `quantity`, `valueRange` |
| `SERIAL_ASCII` | `comPort`, `slaveId`, `baudRate`, `parity`, `stopBits`, `dataBits`, `quantity`, `valueRange` |
| `MODBUS_TCP` | `hostIp`, `slaveId`, `port`, `valueRange` |

Modbus RTU/TCP ยังรับ `readFunction` แบบ optional และ non-nullable ตามตารางถัดไป; TCP ไม่เพิ่ม `quantity` เป็น field ของ contract

### ฟังก์ชันการอ่านข้อมูลของ Modbus

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `settings.readFunction` | enum string | No | No | `READ_INPUT` สำหรับ Read Input หรือ `READ_HOLDING` สำหรับ Read holding; ใช้เฉพาะ `MODBUS_RTU` / `MODBUS_TCP` |

ไม่เลือกให้ละ property `readFunction` โดยไม่มีค่าเริ่มต้นอัตโนมัติ ไม่ส่ง `null`, `""` หรือค่าที่ไม่อยู่ใน enum; Modbus ที่ส่งค่าเหล่านี้ตอบ `400 VALIDATION_ERROR` และไม่แทนที่ config เดิม ถ้าบันทึกโดยละ field หลังเคยเลือกไว้ ค่าใหม่จะไม่มี `readFunction` ไม่รักษาค่าเก่าให้อัตโนมัติ

ฟิลด์นี้อยู่ระดับอุปกรณ์ ไม่ใช่ `channels[]`: config เดี่ยวใช้ `settings.readFunction`, batch ใช้ `configs[].settings.readFunction` และ form wrapper ใช้ `config.device[].settings.readFunction`. ไม่เพิ่มช่องนี้ให้ DCON, Serial ASCII, MSSQL, MYSQL หรือ POMS Box

ตัวอย่าง Modbus TCP สำหรับ POST ทั้งสอง endpoint:

```json
{
  "stationId": "S2001",
  "deviceCode": "S2001/01",
  "protocol": "MODBUS_TCP",
  "settings": {
    "hostIp": "192.0.2.1",
    "slaveId": 1,
    "port": 502,
    "readFunction": "READ_INPUT"
  },
  "channels": []
}
```

Modbus RTU ใช้ serial settings เดิม และเพิ่ม `"readFunction": "READ_HOLDING"` หรือ `"READ_INPUT"` ใน `settings` เมื่อเลือกฟังก์ชัน

### Serial ASCII

เพิ่ม `protocol: "SERIAL_ASCII"` แยกจาก `DCON_ASCII` ใช้ชนิดข้อมูลและ field serial ตาม [ตาราง DCON](#dcon-device-address) เดียวกัน รวม `settings.slaveId` สำหรับ device address; `comPort` รับ number/string/null และค่า serial ตัวเลขรวม `quantity` รับ number/null ไม่เพิ่มชื่อ field ใหม่

ตัวอย่าง POST แบบอุปกรณ์เดียว:

```json
{
  "stationId": "S2001",
  "deviceCode": "S2001/01",
  "protocol": "SERIAL_ASCII",
  "settings": {
    "comPort": "COM1",
    "slaveId": 1,
    "baudRate": 9600,
    "parity": "NONE",
    "stopBits": 1,
    "dataBits": 8,
    "quantity": 2,
    "valueRange": { "min": 0, "max": 100 }
  },
  "channels": []
}
```

รองรับ config เดี่ยว, `configs[]` และ `config.device[]` รวมชุดที่มีหลาย protocol โดย `stationId`, `deviceCode`, channels และ status-management ใช้กติกาเดิม หลัง POST สำเร็จให้เรียก GET ตามบริบทเดิมเพื่อโหลดค่าที่บันทึก

GET ทั้งสอง endpoint คืน `connectionForms[].type: "Serial ASCII"`, `protocol: "SERIAL_ASCII"` และ serial fields ใน `values` เช่น `comport`, `slaveId`, `quantity`, `measureMin`, `measureMax` เป็น string; `null` เป็น `""` ส่วน `rawConfigs.device[].settings` รักษา number, `0` และ `null` จริง

สำหรับ Modbus คืน `connectionForms[].values.readFunction` ตามค่าที่บันทึก และรักษาค่าเดียวกันใน `rawConfigs.device[].settings.readFunction`. ข้อมูลเก่าหรือ config ใหม่ที่ไม่ส่ง field นี้จะไม่มี `readFunction` ทั้งสองตำแหน่ง ให้ frontend แสดง `ไม่ระบุ` โดยไม่กำหนดค่าแทน ตัวอย่าง response เฉพาะส่วนที่เกี่ยวข้อง:

```json
{
  "success": true,
  "data": {
    "connectionForms": [
      {
        "type": "Modbus TCP",
        "protocol": "MODBUS_TCP",
        "deviceCode": "S2001/01",
        "values": { "hostIp": "192.0.2.1", "slaveId": "1", "port": "502", "readFunction": "READ_INPUT", "measureMin": "", "measureMax": "" }
      }
    ],
    "rawConfigs": {
      "stationId": "S2001",
      "device": [
        { "deviceCode": "S2001/01", "protocol": "MODBUS_TCP", "settings": { "hostIp": "192.0.2.1", "slaveId": 1, "port": 502, "readFunction": "READ_INPUT" } }
      ]
    }
  }
}
```

ต้องรัน migration [`0147_allow_serial_ascii_device_protocol`](../../../../../backend/src/db/migrations/0147_allow_serial_ascii_device_protocol.ts) ก่อนใช้งาน เพื่อขยาย protocol constraint ของ `device_connection_configs`. Settings เก็บใน JSON เดิม จึงไม่เพิ่ม column สำหรับ `readFunction`. Rollback จะปฏิเสธเมื่อยังมีแถว `SERIAL_ASCII` รวมแถว soft-deleted เพื่อรักษาประวัติ; ห้ามลบประวัติเพื่อฝืน rollback

การเปลี่ยนนี้รองรับการบันทึก/อ่าน config ไม่เพิ่ม driver สื่อสารกับอุปกรณ์จริงหรือเปลี่ยนสิทธิ์และสถานะคำขอ การทดสอบ transport แบบ mock ยังคงเป็น `MOCK`; [connection-test](./parameter-values.md#get-apiv1parameter-valuesconnection-test) คงกติกาเลือกตารางเดิม (`SERIAL_ASCII` อยู่กลุ่ม fallback `1m`). Integration Worker ใช้ [สัญญาของตนเอง](../../integrations/device-configs/README.md); การเพิ่ม `readFunction` ในฟอร์มไม่ได้เพิ่ม field นี้ใน flattened Worker response

### DCON: device address

ตัวเลือกในหน้าจอคือ `DCON` แต่ request/response ใช้ `protocol: "DCON_ASCII"` เท่านั้น ไม่รับ `"DCON"` เป็น protocol ใช้ settings และกติกาเดียวกับ Modbus RTU โดยเปลี่ยนเฉพาะ label `Slave ID` เป็น `device address` ส่วน key ยังคงเป็น `settings.slaveId` (ตัว I ใหญ่) ไม่เพิ่ม `deviceAddress` และไม่เปลี่ยน `channels[].addressId`

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `settings.comPort` | number หรือ string | No | Yes | เช่น `3` หรือ `"COM3"` |
| `settings.slaveId` | number | No | Yes | device address ของ DCON |
| `settings.baudRate` | number | No | Yes | Baud rate |
| `settings.parity` | string | No | Yes | frontend ส่ง `EVEN`, `ODD`, `NONE`; backend รับ string เช่นเดียวกับ Modbus RTU |
| `settings.stopBits` | number | No | Yes | Stop bits |
| `settings.dataBits` | number | No | Yes | Data bits |
| `settings.quantity` | number | No | Yes | Quantity |
| `settings.valueRange` | object | No | Yes | ช่วงค่าระดับอุปกรณ์; ว่างทั้งคู่ส่ง `null` ได้ |
| `settings.valueRange.min` / `settings.valueRange.max` | number | No | Yes | คงค่า `0` และ `null` ตามที่ส่ง |

ตัวอย่าง POST แบบอุปกรณ์เดียวใช้ได้กับทั้งสอง endpoint ด้านบน:

```json
{
  "stationId": "S2001",
  "deviceCode": "DCON001",
  "protocol": "DCON_ASCII",
  "settings": {
    "comPort": "COM3",
    "slaveId": 7,
    "baudRate": 9600,
    "parity": "NONE",
    "stopBits": 1,
    "dataBits": 8,
    "quantity": 2,
    "valueRange": { "min": 0, "max": null }
  },
  "channels": [],
  "statusManagement": { "schedules": [] }
}
```

batch `configs[]` และ wrapper `config.device[]` รองรับ DCON ร่วมกับ protocol อื่นในชุดเดียวกัน ใช้การจับคู่ channels และ schedules เดิม ตัวอย่างว่างข้างต้นใช้แสดงเฉพาะ settings; การแก้ config ปัจจุบันต้องส่งอุปกรณ์/channels/schedules ที่ต้องการรักษาไว้ครบตามกติกาแทนที่ชุดข้อมูล

GET ทั้งสอง endpoint คืน `connectionForms[].type: "DCON"`, `connectionForms[].protocol: "DCON_ASCII"` และ `values.slaveId` เป็น string สำหรับเติมช่อง device address โดย serial fields ใช้ชื่อเดิม เช่น `comport`, `baudRate`, `measureMin`, `measureMax`; ค่า `null` เป็น `""` ในฟอร์ม ส่วน `rawConfigs.device[].settings` คง `null` และ `0` จริงไว้ ตัวอย่างบางส่วนของ response:

```json
{
  "connectionForms": [
    {
      "type": "DCON",
      "protocol": "DCON_ASCII",
      "values": { "comport": "COM3", "slaveId": "7", "measureMin": "0", "measureMax": "" }
    }
  ],
  "rawConfigs": {
    "device": [
      {
        "deviceCode": "DCON001",
        "protocol": "DCON_ASCII",
        "settings": { "comPort": "COM3", "slaveId": 7, "valueRange": { "min": 0, "max": null } }
      }
    ]
  }
}
```

ต้องรัน migration `0122_allow_dcon_ascii_device_protocol` ก่อนใช้งานเพื่อให้ฐานข้อมูลรับ protocol ใหม่ การ rollback จะปฏิเสธเมื่อยังมี config `DCON_ASCII` อยู่ การรองรับนี้ครอบคลุมการเก็บ/คืน config ไม่ได้เพิ่ม driver อ่านอุปกรณ์จริง; connection test แบบ mock ยังคงเป็น `MOCK` ส่วนปุ่มทดสอบข้อมูลและการยืนยันเชื่อมต่อใช้ flow เดิม

### POMS Box Settings

`POMS_BOX` เป็นการเชื่อมต่อแบบ logical connection ที่อ้างอิง `deviceCode` ของ POMS Box จึงไม่ต้องมีค่า transport/database ใน `settings`; หากไม่ส่งหรือส่ง `null` backend จะ normalize เป็น `{}` และยังบันทึก `channels`/`statusManagement` ได้ตามปกติ

### Channel Fields

`channels` ว่างได้ หากส่งสมาชิกใน array สมาชิกนั้นต้องมี `dataType` เพื่อเป็น structural identifier ของพารามิเตอร์

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `deviceCode` | string | Conditional | Yes | ใช้ใน form payload เพื่อจับคู่ channel กับอุปกรณ์; ละได้เมื่อมีอุปกรณ์เดียว |
| `addressId` | number | No | Yes | Address ID; backend ไม่บังคับค่าต่ำสุดและไม่ตรวจค่าซ้ำใน config เดียวกัน |
| `dataType` | string | Yes, when row exists | No | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `CO (ppm)`; ห้ามซ้ำในอุปกรณ์เดียวกันหลัง normalize หน่วยและเปรียบเทียบแบบ Unicode NFKC/trim/ยุบช่องว่างต่อเนื่อง/ไม่แยกตัวพิมพ์ |
| `unit` | string | No | Yes | รองรับ legacy payload; backend ต่อหน่วยท้าย `dataType` เมื่อชื่อยังไม่มีหน่วย |
| `valueRange` | object | No | Yes | ช่วงค่าของ channel |
| `valueRange.min` | number | No | Yes | ค่าต่ำสุด |
| `valueRange.max` | number | No | Yes | ค่าสูงสุด |
| `alertLow` | number | No | Yes | ค่าแจ้งเตือนต่ำ |
| `alertHigh` | number | No | Yes | ค่าแจ้งเตือนสูง |
| `testMode` | boolean | No | Yes | คง field เพื่อรองรับ client เดิม; รับ `true`/`false`/`null` หรือไม่ส่งตามเดิม แต่ backend normalize ค่าที่ใช้งานและบันทึกใหม่เป็น `false` เสมอ เพราะเลิกใช้ Test mode |
| `valueFormat` | string | No | Yes | รูปแบบค่า เช่น `MEASUREMENT_VALUE`, `CURRENT`, `VOLTAGE`; backend ไม่ตรวจ enum เชิง business |
| `offset` | number | No | Yes | offset ของค่าที่อ่าน |
| `encoding` | string | No | Yes | รูปแบบ encoding; backend ไม่ตรวจ enum เชิง business |
| `status` | enum string | No | Yes | `Normal`, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `No Discharge`, `Turnaround` หรือ `Etc.` |

### Status-management Fields

| Field | Type | Required | Nullable | Description |
| --- | --- | --- | --- | --- |
| `schedules` | object[] | No | Yes | source of truth ของหน้าจอใหม่ สูงสุด 100 ช่วง; ส่ง `[]` โดยไม่ส่ง legacy fields เพื่อล้างรายการทั้งหมด |
| `schedules[].selectedParameters` | string[] | Yes | No | 1-200 ค่าจาก `parameterOptions` หรือ `ทั้งหมด`; ใช้ display label พร้อมหน่วย |
| `schedules[].startAt` | local datetime string | Yes | No | เวลาเริ่มรูปแบบ `YYYY-MM-DD HH:mm:ss` เช่น `2026-08-05 08:00:00`; ไม่ส่ง timezone |
| `schedules[].endAt` | local datetime string | Yes | No | เวลาสิ้นสุดรูปแบบ `YYYY-MM-DD HH:mm:ss`; ไม่ส่ง timezone และต้องอยู่หลัง `startAt` |
| `schedules[].status` | enum string | Yes | No | `Normal`, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `No Discharge`, `Turnaround` หรือ `Etc.` |
| `selectedParameters` | string[] | Legacy | Yes | compatibility field ของช่วงเดี่ยว; เมื่อ `schedules` มีรายการ backend ใช้รายการแรกเติม field นี้ใน response |
| `startAt` | local datetime string | Legacy | Yes | compatibility field ของช่วงเดี่ยว ต้องส่งพร้อม `endAt`; response ใช้ `YYYY-MM-DD HH:mm:ss` |
| `endAt` | local datetime string | Legacy | Yes | compatibility field ของช่วงเดี่ยวและต้องอยู่หลัง `startAt`; response ใช้ `YYYY-MM-DD HH:mm:ss` |
| `status` | enum string | Legacy | Yes | compatibility field ของช่วงเดี่ยว |

ช่วงเวลาใช้ขอบเขตแบบ `[startAt, endAt)` จึงวางช่วงถัดไปให้เริ่มตรง `endAt` ของช่วงก่อนหน้าได้ แต่ช่วงของพารามิเตอร์เดียวกันห้ามทับกัน หากรายการใดเลือก `ทั้งหมด` ช่วงนั้นถือว่าทับกับทุกพารามิเตอร์

Frontend ใหม่ต้องส่งรายการที่กดเพิ่มแล้วทั้งหมดใน `schedules` ไม่แยกรายการแรกไว้ที่ legacy fields เมื่อ `schedules` มีรายการ backend จะไม่พิจารณา legacy top-level fields และใช้ schedule แรกเติม compatibility fields ใน response ค่าเวลา request/response มาตรฐานคือ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone เพื่อให้ตรงกับ local datetime ที่ผู้ใช้เลือก Backend ยังรับค่าเดิม เช่น `2026-08-05T08:00` หรือ `2026-08-05T08:00:00+07:00` เพื่อ compatibility แต่จะ normalize เป็น `2026-08-05 08:00:00` ก่อนบันทึกและตอบกลับ

### Server-managed Identity And Relations

Client ไม่ส่ง primary key/foreign key ของตารางโดยตรง:

| Persistence field | Role | Client behavior |
| --- | --- | --- |
| config `id` | primary key | backend สร้าง |
| config `requestId` | nullable foreign key ไปยัง request | backend กำหนดจาก `:id` ใน request-bound endpoint; current connected config อาจไม่มีค่า |
| channel `id` | primary key | backend สร้าง |
| channel `configId` | foreign key ไปยัง config | backend กำหนดหลังสร้าง config |

เมื่อมี `deviceCode` ใช้ `(stationId, deviceCode)` เป็น identity ของอุปกรณ์ภายในคำขอหรือชุดปัจจุบันเดียวกัน โดย `protocol` เป็นค่าที่เปลี่ยนได้ การบันทึกอุปกรณ์เดิมด้วย protocol ใหม่จะแทนที่ config และ channels เก่าของอุปกรณ์นั้นด้วย soft delete ไม่สร้างอุปกรณ์ซ้อนอีกชุด เมื่อ `deviceCode` เป็น `null` ยังคงใช้ `(stationId, protocol, null)` เพื่อรักษาอุปกรณ์ legacy ที่แยกตาม protocol

ใน batch เดียวกันห้ามส่ง identity ซ้ำ แม้เลือกคนละ protocol สำหรับ `deviceCode` เดียวกัน หากเป็นอุปกรณ์คนละตัว ให้ใช้ `deviceCode` ต่างกัน ส่วน `addressId` ไม่ใช่ primary key/foreign key และยังเป็น `null` หรือซ้ำกันได้

### การป้องกันพารามิเตอร์ซ้ำ

แต่ละอุปกรณ์ส่ง channel ได้เพียงหนึ่งแถวต่อ `dataType` พร้อมหน่วย โดย backend ต่อ legacy `unit` ให้ชื่อก่อน แล้วเปรียบเทียบหลัง Unicode NFKC, trim, ยุบช่องว่างต่อเนื่อง และไม่แยกตัวพิมพ์ใหญ่เล็ก เช่น `CO (ppm)` กับ ` co (PPM) ` ถือว่าซ้ำและตอบ `400 VALIDATION_ERROR` ส่วน `CO (ppm)` กับ `CO (%)` หรือ `CO (ppm)` จากคนละอุปกรณ์ยังเป็นคนละ mapping กติกานี้ใช้กับ config เดี่ยว, `configs[]` และ form wrapper หลังจับคู่ channel กับอุปกรณ์แล้ว

สำหรับข้อมูลเก่าที่ซ้ำ ฟอร์ม GET ของคำขอและจุดปัจจุบันใช้กติกาเดียวกันก่อนสร้าง `connectionForms`, `deviceCodeOptions`, `parameterMappings` และ `rawConfigs`:

- สำหรับคำขอที่มี `measurementInstruments.parameters` ให้กรอง channel ด้วยชื่อพารามิเตอร์พร้อมหน่วยในรายชื่อนั้น โดยเปรียบเทียบหลัง Unicode NFKC, trim, ยุบช่องว่างต่อเนื่อง และไม่แยกตัวพิมพ์ใหญ่เล็ก แล้วคืน label ตามรายชื่อก่อนตัดข้อมูลซ้ำ จึงรักษา Address เดิมที่ต่างกันเพียงตัวพิมพ์หรือช่องว่างขอบข้อความได้; ชื่อที่ระบุคนละหน่วยยังเป็นคนละพารามิเตอร์
- เลือก config ที่ `updatedAt` ล่าสุดต่อ identity ภายใน station และ request เดียวกัน หากเวลาเท่ากันใช้ `id` มากที่สุด; `deviceCode: null` ยังคงแยก protocol
- ใน config ที่เลือก หากชื่อพารามิเตอร์พร้อมหน่วยซ้ำ ให้เลือกแถวที่มี `addressId` ก่อน ตามด้วยแถวที่มีค่าตั้งค่ามากกว่า แล้วใช้แถวแรกที่บันทึกเมื่อเท่ากัน โดยเก็บค่าทั้งแถว ไม่ผสมค่าจากหลายแถว
- การอ่านไม่แก้ฐานข้อมูลและไม่ลบประวัติ การอ่าน config เดียวด้วย `:configId` ยังคงใช้ ID ที่ระบุและตัดเฉพาะ channel ซ้ำใน config นั้น

การปรับข้อมูลซ้ำนี้ใช้กับ response ของฟอร์ม ส่วน integration ที่อ่าน raw config ยังคงอ่านข้อมูลที่เก็บจริงจนกว่าจะบันทึกชุดใหม่ ไม่ต้องรัน migration สำหรับการแก้นี้ Client ควรโหลดฟอร์มใหม่และส่งกลับหนึ่ง config ต่ออุปกรณ์และหนึ่ง channel ต่อพารามิเตอร์พร้อมหน่วย เพื่อไม่ส่ง payload ซ้ำที่ค้างอยู่ในหน้าจอ

## `GET /api/v1/cems-wpms-requests/:id/device-configs`

อ่านข้อมูลสำหรับ prefill dialog จาก config ของ request ที่ผู้เรียกมีสิทธิ์อ่าน และตอบ `200 OK`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: scope ของ permission และพื้นที่ที่ผูกกับ request; สำหรับ `OWN_FACTORY` ผู้เรียกอ่านได้เมื่อเป็นผู้สร้างคำขอหรือได้รับมอบหมายโรงงานผ่าน `user_juristics` หรือ `user_factory_access`
- กฎเดียวกันใช้กับ `GET /api/v1/cems-wpms-requests/:id/device-configs/:configId`

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
| `data.parameterMappings[].testMode` | boolean | No | คืน `false` เสมอ รวม config เก่าที่เคยเก็บ `true` |
| `data.statusManagement` | object | No | ค่า prefill สถานะ; ใช้ default `Normal` เมื่อไม่มีค่าที่บันทึก |
| `data.rawConfigs` | object | No | config รูปแบบ machine-readable ซึ่งรักษา `null` ไว้ |
| `data.rawConfigs.channels[].testMode` | boolean | No | คืน `false` เสมอใน machine-readable config |
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
- ข้อมูลเก่าที่ซ้ำใช้ [กติกาป้องกันพารามิเตอร์ซ้ำ](#การป้องกันพารามิเตอร์ซ้ำ) กับทุกส่วนของฟอร์มรวมถึง `rawConfigs`

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `id` หรือ `stationId` ผิดชนิด/โครงสร้าง | ตรวจ identifier |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้องหรือหมดอายุ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ request/config หรือ request อยู่นอก data scope | refresh รายการ |

## `POST /api/v1/cems-wpms-requests/:id/device-configs`

บันทึกอุปกรณ์แบบแทนที่ทั้งชุดของแต่ละ `stationId` ที่ส่งมา ระหว่างสถานะ `WAITING_CONNECTION` และตอบ `201 Created`

<a id="request-station-replacement"></a>

### การแทนที่รายการอุปกรณ์

ส่งอุปกรณ์ทั้งหมดที่ต้องการเก็บไว้ของแต่ละ station ในครั้งเดียว กติกานี้ใช้เหมือนกันทั้ง config เดี่ยว, `{ "configs": [...] }` และ `{ "config": { "stationId", "device", "channels", "statusManagement" } }` แม้ส่งเหลือเพียงหนึ่งอุปกรณ์

| ข้อมูลเดิมของ `P0002` | อุปกรณ์ที่ส่งมา | ผลหลังบันทึกและอ่านกลับ |
| --- | --- | --- |
| `P0002/01`, `P0002/02` | `P0002/01` | เหลือเฉพาะ `P0002/01` |
| `P0002/01`, `P0002/02` | ทั้งสองอุปกรณ์ | เก็บทั้งสองอุปกรณ์ตามค่าชุดใหม่ |

- Backend soft-delete configs เดิมและ channels ทั้งชุดเฉพาะ `requestId + stationId` ของคำขอนี้ พร้อมแทนที่ current settings ของ station เดียวกันใน transaction เดียว ไม่ลบประวัติจริงและไม่แก้ snapshot ของคำขออื่น
- Batch หลาย station แทนที่แยกตาม `stationId` ที่ส่งมาเท่านั้น; station ที่ไม่ได้ส่งมายังคงข้อมูลเดิม
- ต้องส่ง channels และ status schedules ที่ต้องการรักษาไว้ให้ครบด้วย; อุปกรณ์ที่มี `deviceCode: null` ยังอยู่ภายใต้กติกาการแทนที่เดียวกัน
- หลังบันทึกสำเร็จ [Integration API สำหรับ Worker](../../integrations/device-configs/README.md) ไม่คืน current device, channels หรือ schedules ที่ถูกลบ และไม่ย้อนนำ snapshot เก่าของอุปกรณ์ที่ลบกลับมาใช้
- `configs: []` และ `config.device: []` ไม่ใช่คำสั่งลบทั้งหมด; ตอบ `400 VALIDATION_ERROR` และคงข้อมูลเดิม
- Validation และสิทธิ์ต้องผ่านก่อนเขียนข้อมูล; หากบันทึก snapshot/current/channels ไม่สำเร็จ rollback ทั้งชุด

Client ที่เคยส่งทีละอุปกรณ์เพื่อเพิ่ม/แก้โดยเก็บอุปกรณ์อื่นอัตโนมัติ ต้องโหลดฟอร์มล่าสุดแล้วส่งรายการที่ต้องการเก็บให้ครบใน request เดียว ดู [การเปลี่ยนผ่าน](../../CHANGELOG.md#request-device-station-replacement)

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: ผู้เรียกต้องผ่าน `cems_wpms_requests:edit` ตาม scope/assignment ของโรงงานและ `regionalAccess`

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
  "channels": [],
  "statusManagement": {
    "schedules": [
      {
        "selectedParameters": ["CO (ppm)", "NOx (ppm)"],
        "startAt": "2026-08-05 08:00:00",
        "endAt": "2026-08-05 10:00:00",
        "status": "Maintenance"
      },
      {
        "selectedParameters": ["CO (ppm)"],
        "startAt": "2026-08-05 13:00:00",
        "endAt": "2026-08-05 15:00:00",
        "status": "Calibration"
      }
    ]
  }
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
- ผู้เรียกต้องผ่าน `cems_wpms_requests:edit` ตาม scope/assignment ของโรงงานและ `regionalAccess` และ request ต้องอยู่สถานะ `WAITING_CONNECTION`
- เมื่อ `settings.dbPass` เป็น `********` backend จะใช้รหัสจริงของ active config ที่มี `stationId + protocol + deviceCode` เดียวกัน; หากไม่มีรหัสจริงให้รักษา ต้องตอบ `400 BAD_REQUEST` และ client ต้องให้ผู้ใช้กรอกรหัสใหม่
- เมื่อเปลี่ยน protocol รหัสผ่านเดิมจะใช้ต่อได้เฉพาะเมื่อมี active config ของ protocol ใหม่นั้นตรงกันอยู่แล้ว มิฉะนั้นต้องกรอกรหัสจริงใหม่
- ห้ามส่ง identity อุปกรณ์ซ้ำใน batch และห้ามส่งพารามิเตอร์พร้อมหน่วยซ้ำในอุปกรณ์เดียวกันตาม [กติกาด้านบน](#การป้องกันพารามิเตอร์ซ้ำ)
- backend ไม่ตรวจ required, format, IP, port range, Address ID range, min/max order, alert order, encoding/value-format enum หรือ Address ID ซ้ำของ connection/channel fields
- status-management ตรวจ enum, local datetime รูปแบบ `YYYY-MM-DD HH:mm:ss`, ลำดับเวลา, จำนวนรายการ, parameter ของจุดตรวจวัด และช่วงทับกันที่ backend
- backend ยังตรวจโครงสร้าง JSON, `stationId`, `protocol`, ความสัมพันธ์ request-station และขนาด batch/channel เพื่อป้องกัน payload ผิดรูปแบบหรือใหญ่เกินกำหนด

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | body ไม่มี `stationId`/`protocol`, status/time ผิดรูปแบบ, เกิน 100 ช่วง หรือช่วงทับกัน | แก้ payload ตาม field issues |
| `400` | `VALIDATION_ERROR` | `channels[].dataType` พร้อมหน่วยซ้ำในอุปกรณ์เดียวกันหลัง normalize | โหลดฟอร์มใหม่และส่งเพียงหนึ่งแถวต่อพารามิเตอร์/อุปกรณ์ |
| `400` | `VALIDATION_ERROR` | `settings.readFunction` ของ Modbus ไม่ใช่ `READ_INPUT` / `READ_HOLDING` รวม `null` และสตริงว่าง | เลือกค่าจาก enum หรือละ property เมื่อไม่เลือก |
| `400` | `BAD_REQUEST` | identity อุปกรณ์ซ้ำใน batch แม้เลือกต่าง protocol | ส่งหนึ่ง config ต่ออุปกรณ์; ใช้ `deviceCode` ต่างกันสำหรับคนละอุปกรณ์ |
| `400` | `BAD_REQUEST` | station ไม่อยู่ใน request, parameter ไม่อยู่ในจุด หรือ request ไม่ได้อยู่สถานะ `WAITING_CONNECTION` | refresh request และเลือก station/parameter ใหม่ |
| `400` | `BAD_REQUEST` | ส่ง `settings.dbPass = "********"` แต่ไม่มีรหัสจริงเดิมให้รักษา | ให้ผู้ใช้กรอกรหัสฐานข้อมูลจริงใหม่ |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้องหรือหมดอายุ | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี edit permission หรืออยู่นอก scope/assignment | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404` | `NOT_FOUND` | ไม่พบ request | refresh รายการ |

## `GET /api/v1/connected-measurement-points/:stationId/device-configs`

อ่าน config ปัจจุบันและ form prefill ของจุดที่เชื่อมต่อแล้ว และตอบ `200 OK`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: scope ของ permission และ พื้นที่และ factory assignment ของ connected request ล่าสุด
- สำหรับ `OWN_FACTORY` ระบบตรวจ factory assignment ของ connected point ไม่ตรวจ `createdBy` ของ request จึงอ่าน config ที่เจ้าหน้าที่สร้างให้โรงงานที่ผู้ประกอบการได้รับมอบหมายได้

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
- ข้อมูลเก่าที่ซ้ำใช้ [กติกาป้องกันพารามิเตอร์ซ้ำ](#การป้องกันพารามิเตอร์ซ้ำ) ก่อนสร้างทุกส่วนของฟอร์ม

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
- Data scope: scope ของ permission และ พื้นที่และ factory assignment ของ connected request ล่าสุด
- Backend ตรวจ connected request ของ `stationId` ภายใน edit scope ก่อนแทนที่ config
- สำหรับ `OWN_FACTORY` ผู้ใช้ที่ได้รับมอบหมายโรงงานผ่าน `user_juristics` หรือ `user_factory_access` และมี edit permission แทนที่ config ได้แม้ไม่ใช่ผู้สร้างคำขอ; ใช้ทั้ง path ปกติและ annual path โดยเก็บผู้สร้างเดิมและบันทึกผู้แก้จริง

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
        "testMode": true,
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
        "testMode": false,
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
- เมื่อ `settings.dbPass` เป็น `********` backend จะรักษารหัสจริงของ config เดิมที่มี `stationId + protocol + deviceCode` เดียวกัน; หากข้อมูลเดิมเป็น placeholder หรือไม่มีรหัสจริง รวมถึงเมื่อเปลี่ยน protocol แล้วไม่มี config ที่ตรงกัน ต้องกรอกรหัสใหม่
- ห้ามส่ง identity อุปกรณ์ซ้ำใน batch และห้ามส่งพารามิเตอร์พร้อมหน่วยซ้ำในอุปกรณ์เดียวกันตาม [กติกาด้านบน](#การป้องกันพารามิเตอร์ซ้ำ)
- connection/channel fields ใช้ validation แบบเดียวกับ POST ของ request ส่วน status-management ตรวจทั้ง enum, เวลา, parameter และช่วงทับกันที่ backend
- primary key และ foreign key เช่น config ID, channel ID, request/config relation เป็น server-managed และ client ไม่ต้องส่ง

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | body ไม่มี `stationId`/`protocol`, status/time ผิดรูปแบบ, เกิน 100 ช่วง หรือช่วงทับกัน | แก้ payload ตาม field issues |
| `400` | `VALIDATION_ERROR` | `channels[].dataType` พร้อมหน่วยซ้ำในอุปกรณ์เดียวกันหลัง normalize | โหลดฟอร์มใหม่และส่งเพียงหนึ่งแถวต่อพารามิเตอร์/อุปกรณ์ |
| `400` | `VALIDATION_ERROR` | `settings.readFunction` ของ Modbus ไม่ใช่ `READ_INPUT` / `READ_HOLDING` รวม `null` และสตริงว่าง | เลือกค่าจาก enum หรือละ property เมื่อไม่เลือก |
| `400` | `BAD_REQUEST` | identity อุปกรณ์ซ้ำใน batch แม้เลือกต่าง protocol | ส่งหนึ่ง config ต่ออุปกรณ์; ใช้ `deviceCode` ต่างกันสำหรับคนละอุปกรณ์ |
| `400` | `BAD_REQUEST` | `stationId` ใน body ไม่ตรงกับ path หรือ parameter ไม่อยู่ในจุด | ใช้ station และ parameter ของจุดที่เลือก |
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
- Device identity and form normalization: [`device-connection-identity.ts`](../../../../../backend/src/modules/device-connections/device-connection-identity.ts), [`normalize-device-config-form.ts`](../../../../../backend/src/modules/device-connections/normalize-device-config-form.ts)
- Migrations: [`0083_relax_device_config_form_constraints.ts`](../../../../../backend/src/db/migrations/0083_relax_device_config_form_constraints.ts), [`0086_validate_device_status_management_json.ts`](../../../../../backend/src/db/migrations/0086_validate_device_status_management_json.ts), [`0087_allow_poms_box_device_protocol.ts`](../../../../../backend/src/db/migrations/0087_allow_poms_box_device_protocol.ts)
- Validator/service tests: [`device-connections.validator.test.ts`](../../../../../backend/tests/unit/device-connections.validator.test.ts), [`device-connections.service.test.ts`](../../../../../backend/tests/unit/device-connections.service.test.ts), [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts)
- Duplicate-parameter regression tests: [`device-config-s2014-roundtrip.test.ts`](../../../../../backend/tests/unit/device-config-s2014-roundtrip.test.ts), [`device-config-form-duplicates.test.ts`](../../../../../backend/tests/unit/device-config-form-duplicates.test.ts), [`device-config-duplicate-parameters.validator.test.ts`](../../../../../backend/tests/unit/device-config-duplicate-parameters.validator.test.ts), [`device-config-duplicates.openapi.test.ts`](../../../../../backend/tests/unit/device-config-duplicates.openapi.test.ts)
- Migration test: [`device-connection-protocol-migration.test.ts`](../../../../../backend/tests/unit/device-connection-protocol-migration.test.ts)
- Route tests: [`connected-measurement-points.route.test.ts`](../../../../../backend/tests/unit/connected-measurement-points.route.test.ts), [`connection-requests.create.route.test.ts`](../../../../../backend/tests/unit/connection-requests.create.route.test.ts)

- DCON migration: [`0122_allow_dcon_ascii_device_protocol.ts`](../../../../../backend/src/db/migrations/0122_allow_dcon_ascii_device_protocol.ts)
- DCON OpenAPI tests: [`dcon-device-config.openapi.test.ts`](../../../../../backend/tests/unit/dcon-device-config.openapi.test.ts)
- Serial ASCII migration: [`0147_allow_serial_ascii_device_protocol.ts`](../../../../../backend/src/db/migrations/0147_allow_serial_ascii_device_protocol.ts)
- Serial ASCII / Modbus API และ OpenAPI: [`device-config-protocols.api.test.ts`](../../../../../backend/tests/unit/device-config-protocols.api.test.ts), [`device-config-protocols.openapi.api.test.ts`](../../../../../backend/tests/unit/device-config-protocols.openapi.api.test.ts)
- การลบอุปกรณ์ระหว่างคำขอ, Worker, scope และ rollback: [`device-config-request-replacement.api.test.ts`](../../../../../backend/tests/unit/device-config-request-replacement.api.test.ts), [`device-config-request-replacement.openapi.test.ts`](../../../../../backend/tests/unit/device-config-request-replacement.openapi.test.ts)
- Migration checks: [`serial-ascii-protocol.migration.test.ts`](../../../../../backend/tests/unit/serial-ascii-protocol.migration.test.ts), [`serial-ascii-protocol.sql-server.test.ts`](../../../../../backend/tests/integration/serial-ascii-protocol.sql-server.test.ts)
- [หลักฐาน TDD และข้อจำกัดการตรวจ SQL Server](../../../evidence/connection-requests/serial-ascii-modbus-read-function.md)

## พารามิเตอร์หลังอนุมัติคำขอแก้ไขจุดตรวจวัด

`GET /api/v1/connected-measurement-points/:stationId/device-configs` รวมถึงเส้นทาง annual code อ่าน parameter list จาก active connected point หลังตรวจสิทธิ์ แล้วรวมกับ active device configs ส่วน API ที่ขึ้นต้นด้วย `/cems-wpms-requests/:id/` ยังคงอ่าน snapshot ของคำขอนั้น

| Field | พฤติกรรม |
| --- | --- |
| `parameterOptions` | รายการพารามิเตอร์ที่อนุมัติล่าสุด |
| `parameterMappings` | คง mapping ของพารามิเตอร์เดิมที่ยังอยู่ และเพิ่มแถวว่างสำหรับพารามิเตอร์ใหม่ |
| `parameterMappings[].addressId` | `""` เมื่อยังไม่ตั้งค่าจริง; ไม่ใช้ address ของพารามิเตอร์ที่ถูกถอดออกแทน |
| `parameterMappings[].configId` | `number` สำหรับ config ที่ระบุได้; `null` เมื่อยังไม่เลือกอุปกรณ์ |
| `rawConfigs` | ค่าที่บันทึกจริงเท่านั้น ไม่มี channel ใหม่ที่สร้างจากการคาดเดา |

ตัวอย่าง: เปลี่ยน BOD/COD/Watt เป็น BOD/Watt/Flow แล้ว BOD คง address 1, Watt คง address 3 และ Flow แสดง address ว่าง ผู้ใช้ต้องเลือกอุปกรณ์/Address ID ที่ถูกต้องก่อนบันทึก Integration ไม่รายงาน Flow จนมีการบันทึก channel จริง

`POST` ของ endpoint ปัจจุบันรับเฉพาะ channel ที่อยู่ในพารามิเตอร์ที่อนุมัติแล้ว ส่ง COD ที่ถอดออกตอบ `400 BAD_REQUEST`; หากพารามิเตอร์เปลี่ยนระหว่าง validation กับการบันทึก ตอบ `409 CONFLICT` และไม่มีการแทนที่ config ทั้งสองกรณีให้ refresh ฟอร์มก่อนส่งใหม่ สิทธิ์ผู้ใช้/data scope ยังคงเดิม การเพิ่ม Flow ไม่ได้ให้สิทธิ์แก้คำขอของผู้อื่น
