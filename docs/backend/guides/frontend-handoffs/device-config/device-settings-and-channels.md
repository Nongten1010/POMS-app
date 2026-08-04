# Frontend handoff: Device settings และ parameter channels

[กลับไปหน้า handoff](./README.md) · [Canonical API contract](../../../api/menus/connection-requests/device-configs.md#shared-request-contract)

## สิ่งที่ frontend ปัจจุบันมีแล้ว

โค้ดปัจจุบันมีพฤติกรรมต่อไปนี้แล้ว ให้รักษาไว้และเพิ่ม regression test แทนการเขียนซ้ำ:

- แสดง `minuteTableName`, `fiveMinuteTableName`, `hourlyTableName` สำหรับ Microsoft SQL/MySQL
- เปลี่ยนค่าว่างใน settings/channels เป็น `null`
- ส่ง `valueRange: null` เมื่อทั้ง min และ max ว่าง
- ส่ง `addressId: null` ได้ และไม่บังคับขั้นต่ำ `40001`
- map `valueFormat` และ `encoding` จาก label ใน UI เป็น machine value
- frontend validation ของ device form ตรวจเฉพาะ connection type ที่รู้จัก ไม่บังคับ host/port/address/channel ให้ครบ

Backend ยังตรวจ structural fields เช่น `stationId`, `protocol`, array limits และ `dataType` เมื่อมี channel row

## Database settings

ใช้กับ `MSSQL` และ `MYSQL`:

```json
{
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
```

Fields ภายใน settings เป็น optional/nullable แต่ `protocol` ของ config ยังเป็น required discriminator

## Channel payload

ถ้ามี channel row ต้องมี `dataType` ซึ่งเป็นชื่อพารามิเตอร์พร้อมหน่วย เช่น `NOx (ppm)` ส่วน field อื่นส่ง `null` ได้:

```json
{
  "deviceCode": "S0002/01",
  "addressId": null,
  "dataType": "NOx (ppm)",
  "valueRange": null,
  "alertLow": null,
  "alertHigh": null,
  "valueFormat": null,
  "offset": null,
  "encoding": null,
  "status": "Normal"
}
```

ข้อควรจำ:

- `dataType` คือพารามิเตอร์ ไม่ใช่รูปแบบค่าข้อมูล
- `valueFormat` คือ dropdown รูปแบบค่าข้อมูลตรวจวัด
- `encoding` คือ dropdown Encoding data
- `deviceCode` ต้องใช้จับคู่ channel กับ device เมื่อ form payload มีหลายอุปกรณ์
- backend รับ channels สูงสุด 200 รายการต่อ config
- channel status ใช้ enum เดียวกับ schedule status และรองรับ `No Discharge`

## Mapping ของ frontend

### Value format

| UI label | Payload value |
| --- | --- |
| ค่าข้อมูลตรวจวัด | `MEASUREMENT_VALUE` |
| ค่ากระแสไฟฟ้า | `CURRENT` |
| ค่าแรงดันไฟฟ้า | `VOLTAGE` |
| ไม่ระบุ | `null` |

### Encoding

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

Backend เก็บ `valueFormat`/`encoding` เป็น nullable string และไม่บังคับ business enum แต่ frontend ควรส่งค่าจาก mapping นี้เพื่อให้ worker อ่านได้สม่ำเสมอ

## POMS Box

`POMS Box` ใช้ `protocol: POMS_BOX` และไม่ต้องกรอก transport/database settings; frontend ส่ง `settings: null` ได้ และ backend normalize เป็น `{}` ก่อนบันทึก ส่วน `deviceCode` และ `channels` ยังใช้ contract เดียวกับอุปกรณ์ชนิดอื่น
