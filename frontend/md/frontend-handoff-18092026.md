# Frontend Handoff: ตัวเลือก DCON ใน dialog ตั้งค่าอุปกรณ์

เอกสารนี้บันทึกการเปลี่ยนแปลง frontend และสิ่งที่ต้องการให้ backend รองรับ ไม่ใช่ API contract ที่ยืนยันว่ารองรับแล้ว งานนี้ไม่ได้แก้ backend และยังไม่ได้ส่งการตั้งค่า DCON เข้า production

เอกสาร API ที่ backend ดูแล: [การตั้งค่าอุปกรณ์](../../docs/backend/api/menus/connection-requests/device-configs.md) และ [จุดตรวจวัดที่เชื่อมต่อแล้ว](../../docs/backend/api/shared/connected-measurement-points/README.md) ให้ปรับ canonical docs และ runtime OpenAPI เมื่อ backend รองรับ โดยไม่ใช้ handoff นี้แทนเอกสารสัญญา API

## สิ่งที่เปลี่ยนใน Frontend

- Dropdown อุปกรณ์เรียงเป็น `Modbus RTU`, `Modbus TCP`, `DCON`, `Microsoft SQL`, `MySQL`, `POMS Box`
- เลือก `DCON` แล้วส่ง `protocol: "DCON_ASCII"` ไม่ส่ง `"DCON"` เป็น protocol
- ช่องรายละเอียดของ DCON เหมือน Modbus RTU แต่เปลี่ยน label `Slave ID` เป็น `device address` เฉพาะ DCON
- ค่าของช่อง `device address` ยังใช้ `settings.slaveId` ไม่มี field ใหม่ชื่อ `deviceAddress`
- โหลด protocol `DCON_ASCII` กลับมาแล้วแสดงตัวเลือก `DCON` พร้อมเติมค่าที่บันทึกไว้ รองรับทั้ง `connectionForms` และ raw config ตามรูปแบบเดิม
- แปลง parity `EVEN`, `ODD`, `NONE` กลับเป็นตัวเลือก `Even`, `Odd`, `None` สำหรับฟอร์ม serial และแปลงกลับเป็น code เดิมเมื่อบันทึก
- ไม่เปลี่ยนสิทธิ์ สถานะคำขอ ตารางพารามิเตอร์ รูปแบบ channels หรือ status-management schedules ไม่เพิ่ม endpoint ใหม่ และไม่เปลี่ยน PDF ในงานนี้

## API ที่ได้รับผลกระทบโดยตรง

| Method / Endpoint | สิ่งที่ frontend ต้องใช้ |
| --- | --- |
| `GET /api/v1/cems-wpms-requests/:id/device-configs?stationId=:stationId` | โหลด DCON ของคำขอ พร้อม protocol และ settings ครบถ้วน เพื่อเปิดแก้ไขและ refresh หลังบันทึก |
| `POST /api/v1/cems-wpms-requests/:id/device-configs` | รับ `DCON_ASCII` ทั้ง payload อุปกรณ์เดียว และ `config.device[]` เมื่อมีหลายอุปกรณ์ |
| `GET /api/v1/connected-measurement-points/:stationId/device-configs` | โหลด DCON ของจุดที่เชื่อมต่อแล้ว โดยไม่เปลี่ยนเป็น protocol อื่นหรือทำ settings หาย |
| `POST /api/v1/connected-measurement-points/:stationId/device-configs` | รองรับ `DCON_ASCII` ใน `config.device[]` สำหรับแทนที่การตั้งค่าปัจจุบัน รวมถึงกรณีมีหลาย protocol ในชุดเดียวกัน |

หาก endpoint รายละเอียดอื่นคืน config ชุดเดียวกัน ให้รักษา `DCON_ASCII` และ settings เช่นเดียวกัน ไม่ต้องเปลี่ยน URL หรือเพิ่ม query parameter เพื่อเลือก DCON

## Field Mapping ที่ Frontend ส่ง

ชื่อ field และรูปแบบค่าคงเหมือน Modbus RTU:

| Label | Field ใน settings | ค่าที่ frontend ส่ง |
| --- | --- | --- |
| COMPORT | `comPort` | number หรือ string เช่น `3` / `"COM3"`; ว่างเป็น `null` |
| device address | `slaveId` | number; ว่างเป็น `null` |
| Baud Rate | `baudRate` | number; ว่างเป็น `null` |
| Parity | `parity` | `EVEN`, `ODD`, `NONE`; ว่างเป็น `null` |
| Stop bits | `stopBits` | number; ว่างเป็น `null` |
| Data bits | `dataBits` | number; ว่างเป็น `null` |
| ช่วงข้อมูลตรวจวัด Min | `valueRange.min` | number หรือ `null`; ต้องรักษาค่า `0` |
| ช่วงข้อมูลตรวจวัด Max | `valueRange.max` | number หรือ `null` |
| Quantity | `quantity` | number; ว่างเป็น `null` |

หาก Min และ Max ว่างทั้งคู่ frontend ส่ง `valueRange: null` ช่องรายละเอียดไม่ได้เพิ่มกติกาบังคับกรอกใหม่ ส่วน `channels[].addressId` เป็นคนละ field กับ `settings.slaveId` และไม่เปลี่ยนชื่อหรือกติกาในงานนี้

## ตัวอย่าง Payload จาก Frontend

ตัวอย่างเป็นข้อมูลสมมติสำหรับอธิบายรูปแบบ ไม่ใช่ค่าที่แนะนำให้ใช้กับอุปกรณ์จริง

อุปกรณ์เดียวในคำขอ ผ่าน `POST /api/v1/cems-wpms-requests/:id/device-configs`:

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
    "valueRange": { "min": 0, "max": 200 }
  },
  "channels": [],
  "statusManagement": { "schedules": [] }
}
```

จุดที่เชื่อมต่อแล้ว หรือคำขอที่มีหลายอุปกรณ์ ใช้ wrapper เดิมดังนี้ โดย `config.device` ใส่ได้หลายรายการ รวมถึง protocol อื่นร่วมกับ DCON:

```json
{
  "config": {
    "stationId": "S2001",
    "device": [
      {
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
          "valueRange": { "min": 0, "max": 200 }
        }
      }
    ],
    "channels": [],
    "statusManagement": { "schedules": [] }
  }
}
```

`channels` และ schedules ในตัวอย่างว่างเพื่อแสดงส่วนที่เกี่ยวข้องกับ DCON เท่านั้น การใช้งานจริงส่งค่าจากตารางตามรูปแบบเดิม ไม่ได้ล้างข้อมูลสองส่วนนี้โดยอัตโนมัติ

## สิ่งที่ Backend ต้องรองรับ

1. เพิ่ม `DCON_ASCII` ใน protocol ที่รับ บันทึก และคืนได้ รวมถึง validator, serializer, schema/ข้อจำกัดฐานข้อมูล และตัวแปลง config ที่เกี่ยวข้องตามโครงสร้างจริงของ backend
2. รองรับ settings ตามตารางข้างต้น โดย `slaveId` หมายถึง device address สำหรับ DCON ไม่เปลี่ยน key และไม่แปลง DCON เป็น Modbus RTU เพียงเพราะใช้ช่องกรอกเหมือนกัน
3. คืน protocol และค่าที่บันทึกให้ frontend เปิดแก้ไขได้โดยไม่สูญหาย รวมถึง `null`, ช่วงค่าที่มี `0`, channels, schedules และอุปกรณ์อื่นในชุดเดียวกัน
4. หากใช้ `connectionForms` สำหรับเติมฟอร์ม ให้คืนชนิดที่ frontend แปลงกลับได้ (`DCON_ASCII` หรือ label `DCON`) ส่วน protocol ใน config ใช้ `DCON_ASCII`
5. อัปเดต canonical docs, runtime OpenAPI และ tests สำหรับทั้งสองกลุ่ม endpoint ก่อนแจ้งว่า API รองรับแล้ว

## Flow ที่เกี่ยวข้อง แต่ Payload ไม่เปลี่ยน

- `GET /api/v1/parameter-values/connection-test?stationId=:stationId`: ปุ่มทดสอบยังส่งเพียงรหัสจุด ไม่ส่ง protocol หรือ settings โดยตรง ทีม backend/ระบบรับข้อมูลต้องตรวจเส้นทางอ่านข้อมูลของ DCON หากต้องการให้มีค่าทดสอบจริง การเพิ่ม dropdown ฝั่ง frontend ไม่ใช่การเพิ่ม driver DCON
- `POST /api/v1/cems-wpms-requests/:id/confirm-connection`: ยังใช้ `{ "action": "CONFIRM", "note": "ตั้งค่าอุปกรณ์และทดสอบแล้ว" }` เดิม โดย frontend บันทึก config และโหลดกลับให้สำเร็จก่อนเรียกยืนยัน จึงต้องไม่ติด validation ของ protocol ใหม่

## การตรวจรับ

- DCON อยู่ต่อจาก Modbus TCP และแสดงช่องเหมือน RTU โดยไม่มี Host IP หรือช่องฐานข้อมูล
- เปลี่ยนค่า `device address` แล้ว payload เปลี่ยนเฉพาะ `settings.slaveId` ไม่มี `deviceAddress`
- บันทึกและโหลดกลับทั้งแบบอุปกรณ์เดียว หลายอุปกรณ์ และจุดที่เชื่อมต่อแล้ว ได้ `DCON_ASCII` และค่าเดิมครบ
- Modbus RTU/TCP ยังคง label `Slave ID` และ protocol เดิม; Microsoft SQL, MySQL และ POMS Box ไม่เปลี่ยน
- Frontend มี automated tests ตรวจ dropdown, label/state, mapping, payload และ response prefill ด้วยข้อมูลจำลอง ยังไม่ได้ยืนยันการบันทึก DCON ผ่าน API จริงหรือการรับค่าจากอุปกรณ์จริง
