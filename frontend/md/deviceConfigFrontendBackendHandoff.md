# Device Config Frontend Backend Handoff

เอกสารนี้สรุปการแก้ไขฝั่ง frontend ใน dialog **ตั้งค่าอุปกรณ์** ของหน้าขอเชื่อมต่อ เพื่อให้ backend ใช้อ้างอิงตอนปรับ API/validation/payload ต่อ

## พื้นที่ที่แก้ไข

- หน้า: `src/pages/ConnectionRequestPage.jsx`
- Dialog: **ตั้งค่าอุปกรณ์**
- ใช้ร่วมกัน 2 ทางเข้า:
  - ปุ่ม **ตั้งค่า** ในตารางรายการคำขอ
  - ปุ่ม **ตั้งค่า** ใน dialog **รายการจุดตรวจวัด** ที่เปิดจากตารางรายชื่อโรงงาน

## Endpoint ที่เกี่ยวข้อง

dialog เดียวกันใช้ endpoint ตาม context:

- กรณีมาจากรายการคำขอ:
  - `GET /api/v1/cems-wpms-requests/:requestId/device-configs?stationId=:stationId`
  - `POST /api/v1/cems-wpms-requests/:requestId/device-configs`
- กรณีมาจากจุดตรวจวัดที่เชื่อมต่อแล้ว:
  - `GET /api/v1/connected-measurement-points/:stationId/device-configs`
  - `POST /api/v1/connected-measurement-points/:stationId/device-configs`

## การแก้ไข UI

### Microsoft SQL และ MySQL

เพิ่มช่องหลัง `dbName` สำหรับ connection type:

- `Microsoft SQL`
- `MySQL`

ช่องที่เพิ่ม:

- `ชื่อ Table ข้อมูลแบบรายนาที`
- `ชื่อ Table ข้อมูลแบบราย 5 นาที`
- `ชื่อ Table ข้อมูลแบบรายชั่วโมง`

ชื่อ field ที่ frontend เตรียมไว้ใน payload:

```json
{
  "minuteTableName": "string|null",
  "fiveMinuteTableName": "string|null",
  "hourlyTableName": "string|null"
}
```

ถ้าไม่กรอก frontend จะส่งเป็น `null`

## การเปลี่ยน validation ฝั่ง frontend

frontend ปรับให้ field ใน dialog ตั้งค่าอุปกรณ์เป็น optional มากขึ้น เพื่อให้ backend เป็นผู้ validate ตาม contract จริง

### Address ID

เดิม:

- ช่อง `Address ID` กำหนดขั้นต่ำใน frontend เป็น `40001`
- frontend บังคับว่าต้องกรอกครบก่อนส่ง

ใหม่:

- ช่อง `Address ID` กำหนดขั้นต่ำใน frontend เป็น `1`
- ถ้าไม่กรอก frontend ส่ง `addressId: null`
- frontend ไม่ block การ submit เพราะ `Address ID` ว่างแล้ว

### Field อื่นใน device config

เดิม frontend มี validation เช่น:

- ต้องเลือก `อุปกรณ์ (Connection)`
- `Modbus RTU` ต้องกรอก `COMPORT`
- `Modbus TCP` ต้องกรอก `Host IP`, `Port`
- `Microsoft SQL`, `MySQL` ต้องกรอก `Host IP`, `Port`
- ถ้ามีหลายอุปกรณ์ ต้องเลือกรหัสอุปกรณ์ในตารางการเชื่อมต่อพารามิเตอร์ให้ครบ
- ต้องมี mapping อย่างน้อย 1 รายการ
- `Address ID` ต้องกรอกครบ

ใหม่:

- frontend ไม่ validate required เหล่านี้แล้ว
- frontend ยังตรวจเฉพาะข้อมูลที่จำเป็นต่อการยิง API เช่น `stationId`, `requestId` ตาม context และ `accessToken`
- หากเลือก connection type ที่ frontend ไม่รู้จัก จะยังแจ้งว่าเลือกอุปกรณ์ไม่ถูกต้อง

## Payload ที่ frontend ส่ง

### settings

ค่าว่างจะส่งเป็น `null` แทนการตัด field ออกจาก object

ตัวอย่าง `Microsoft SQL` / `MySQL`:

```json
{
  "hostIp": "string|null",
  "port": "number|null",
  "dbUser": "string|null",
  "dbPass": "string|null",
  "dbName": "string|null",
  "minuteTableName": "string|null",
  "fiveMinuteTableName": "string|null",
  "hourlyTableName": "string|null",
  "valueRange": {
    "min": "number|null",
    "max": "number|null"
  }
}
```

ถ้า `valueRange.min` และ `valueRange.max` ว่างทั้งคู่ frontend จะส่ง:

```json
{
  "valueRange": null
}
```

### channels

ค่าว่างในตาราง **การเชื่อมต่อพารามิเตอร์** จะส่งเป็น `null`

ตัวอย่าง:

```json
{
  "deviceCode": "string|null",
  "addressId": "number|null",
  "dataType": "string",
  "valueRange": {
    "min": "number|null",
    "max": "number|null"
  },
  "alertLow": "number|null",
  "alertHigh": "number|null",
  "valueFormat": "MEASUREMENT_VALUE|CURRENT|VOLTAGE|null",
  "offset": "number|null",
  "encoding": "SIGNED16_BIG_ENDIAN|SIGNED16_LITTLE_ENDIAN|UNSIGNED16_BIG_ENDIAN|UNSIGNED16_LITTLE_ENDIAN|SIGNED32_BIG_ENDIAN|SIGNED32_LITTLE_ENDIAN|UNSIGNED32_BIG_ENDIAN|UNSIGNED32_LITTLE_ENDIAN|FLOAT32_BIG_ENDIAN|FLOAT32_LITTLE_ENDIAN|FLOAT64_BIG_ENDIAN|FLOAT64_LITTLE_ENDIAN|null",
  "status": "string|null"
}
```

หมายเหตุ:

- `dataType` คือพารามิเตอร์ เช่น `NOx (ppm)` ไม่ใช่ช่อง `รูปแบบค่าข้อมูลตรวจวัด`
- ช่อง `รูปแบบค่าข้อมูลตรวจวัด` ส่งใน field `valueFormat`
- ช่อง `Encoding data` ส่งใน field `encoding`

## Mapping ค่าจาก dropdown

### รูปแบบค่าข้อมูลตรวจวัด

| UI label | Payload value |
| --- | --- |
| ค่าข้อมูลตรวจวัด | `MEASUREMENT_VALUE` |
| ค่ากระแสไฟฟ้า | `CURRENT` |
| ค่าแรงดันไฟฟ้า | `VOLTAGE` |
| ไม่ระบุ | `null` |

### Encoding data

| UI label | Payload value |
| --- | --- |
| Signed16 - Big Endian | `SIGNED16_BIG_ENDIAN` |
| Signed16 - Little Endian | `SIGNED16_LITTLE_ENDIAN` |
| Unsigned16 - Big Endian | `UNSIGNED16_BIG_ENDIAN` |
| Unsigned16 - Little Endian | `UNSIGNED16_LITTLE_ENDIAN` |
| Signed32 - Big Endian | `SIGNED32_BIG_ENDIAN` |
| Signed32 - Little Endian | `SIGNED32_LITTLE_ENDIAN` |
| Unsigned32 - Big Endian | `UNSIGNED32_BIG_ENDIAN` |
| Unsigned32 - Little Endian | `UNSIGNED32_LITTLE_ENDIAN` |
| Float32 - Big Endian | `FLOAT32_BIG_ENDIAN` |
| Float32 - Little Endian | `FLOAT32_LITTLE_ENDIAN` |
| Float64 - Big Endian | `FLOAT64_BIG_ENDIAN` |
| Float64 - Little Endian | `FLOAT64_LITTLE_ENDIAN` |
| ไม่ระบุ | `null` |

## สิ่งที่ backend ควรพิจารณา

- รองรับ table name ใหม่ใน `settings` ของ `MSSQL` และ `MYSQL`
- พิจารณา validation/DB nullability ของ field ที่ frontend อาจส่งเป็น `null`
- โดยเฉพาะ:
  - `addressId`
  - `valueFormat`
  - `encoding`
  - `status`
  - `valueRange`
  - settings ของแต่ละ protocol
- หาก backend ยังต้องการ required field ใด ให้ validate และส่ง error กลับมาให้ frontend แสดงจาก response ของ API
