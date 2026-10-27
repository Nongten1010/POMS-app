# การเพิ่มตัวเลือกการตั้งค่าอุปกรณ์ใน Frontend

## ขอบเขต

เมนูขอเชื่อมต่อ > dialog ตั้งค่าอุปกรณ์ > section อุปกรณ์

เอกสารนี้สรุปการเปลี่ยนแปลงฝั่ง frontend เท่านั้น ไม่ใช่การยืนยันว่า backend รองรับค่าใหม่แล้ว และไม่กำหนดวิธีพัฒนา backend

อ้างอิง contract ปัจจุบัน: [การตั้งค่าอุปกรณ์](../../docs/backend/api/menus/connection-requests/device-configs.md)

## สิ่งที่เพิ่ม

### Serial ASCII

- เพิ่มตัวเลือก `Serial ASCII` ถัดจาก `DCON`
- ใช้ช่องตั้งค่าเหมือน DCON: COMPORT, device address, Baud Rate, Parity, Stop bits, Data bits, ช่วงข้อมูลตรวจวัด Min/Max และ Quantity
- ค่า protocol ที่ frontend ส่งใหม่คือ `SERIAL_ASCII` แยกจาก `DCON_ASCII`
- device address ใช้ชื่อฟิลด์ `settings.slaveId` เช่นเดียวกับ DCON เดิม
- การอ่านค่ากลับรองรับ `type: "Serial ASCII"` หรือ `protocol: "SERIAL_ASCII"`

### ฟังก์ชันการอ่านข้อมูลของ Modbus

- เพิ่ม dropdown `ฟังก์ชันการอ่านข้อมูล` เป็นช่องสุดท้ายเฉพาะ Modbus RTU และ Modbus TCP
- RTU วางหลัง Quantity; TCP วางหลัง Port โดยไม่ได้เพิ่มช่อง Quantity ให้ TCP
- ตัวเลือก `Read Input` ส่ง `settings.readFunction: "READ_INPUT"`
- ตัวเลือก `Read holding` ส่ง `settings.readFunction: "READ_HOLDING"`
- ไม่บังคับเลือกและไม่เลือกค่าเริ่มต้นอัตโนมัติ หากไม่เลือกจะไม่ส่ง property `readFunction`
- DCON, Serial ASCII, Microsoft SQL, MySQL และ POMS Box ไม่เพิ่มฟิลด์นี้

## API ที่เกี่ยวข้อง

Base URL: `https://d-poms.diw.go.th/api/v1`

| Method | Path | การใช้งานของ frontend |
| --- | --- | --- |
| GET | `/cems-wpms-requests/:id/device-configs?stationId=:stationId` | โหลดการตั้งค่าของคำขอและโหลดซ้ำหลังบันทึก |
| POST | `/cems-wpms-requests/:id/device-configs` | บันทึกการตั้งค่าในคำขอ |
| GET | `/connected-measurement-points/:stationId/device-configs` | โหลดการตั้งค่าจุดตรวจวัดที่เชื่อมต่อแล้ว |
| POST | `/connected-measurement-points/:stationId/device-configs` | บันทึกการตั้งค่าจุดตรวจวัดที่เชื่อมต่อแล้ว |

ยังใช้ Bearer token และ endpoint เดิม ไม่เพิ่ม API ใหม่ การทดสอบผ่าน `/parameter-values/connection-test?stationId=:stationId` และการยืนยันผ่าน `/cems-wpms-requests/:id/confirm-connection` ไม่เปลี่ยนรูปแบบ request; ปุ่มยืนยันยังบันทึกการตั้งค่าก่อนยืนยันตาม flow เดิม

## Payload ที่เกี่ยวข้อง

ตำแหน่ง field ใช้โครงสร้างเดิม:

- รูปแบบอุปกรณ์เดียว: `protocol` และ `settings` ที่ระดับบน
- รูปแบบหลายอุปกรณ์/จุดตรวจวัดที่เชื่อมต่อแล้ว: `config.device[].protocol` และ `config.device[].settings`
- `channels`, `statusManagement`, `stationId` และ `deviceCode` ไม่เปลี่ยนรูปแบบ

ตัวอย่างเฉพาะส่วนอุปกรณ์ Serial ASCII (ไม่ใช่ payload เต็ม):

```json
{
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
  }
}
```

ชนิดข้อมูล Serial ASCII ใช้การแปลงเดียวกับ DCON เดิม: comPort เป็น number/string/null, slaveId/baudRate/stopBits/dataBits/quantity เป็น number/null, parity เป็น string/null และ valueRange เป็น object/null

ตัวอย่างเฉพาะส่วนอุปกรณ์ Modbus TCP:

```json
{
  "deviceCode": "S2001/01",
  "protocol": "MODBUS_TCP",
  "settings": {
    "hostIp": "192.168.1.10",
    "slaveId": 1,
    "port": 502,
    "valueRange": null,
    "readFunction": "READ_INPUT"
  }
}
```

Modbus RTU คง serial settings เดิม และเพิ่ม `readFunction` ใน `settings` เมื่อเลือกฟังก์ชัน เช่น `"readFunction": "READ_HOLDING"`

## Response ที่ frontend อ่าน

- ใช้ `data.connectionForms[]` เป็นแหล่งหลัก โดยอ่าน settings จาก `values` (หรือ `settings` / `config` / `connectionConfig` ตามตัวอ่านเดิม)
- เมื่อไม่มี connectionForms จะใช้ข้อมูลอุปกรณ์ใน `data.rawConfigs.config.device[]`, `data.rawConfigs.device[]` หรือ `data.config.device[]` ตามตัวอ่านเดิม
- `readFunction` ถูกเติมกลับใน dropdown จาก settings ของอุปกรณ์นั้น ไม่ใช่ค่าระดับ channel
- Response เก่าที่ไม่มี readFunction จะแสดง `ไม่ระบุ` โดยไม่กำหนดค่าแทน
- หลัง POST สำเร็จ frontend ยังเรียก GET เพื่อแสดงค่าที่บันทึกแล้วตามเดิม

ตัวอย่างส่วน response ที่ frontend อ่านได้สำหรับค่าใหม่ (ตัวอย่างการจับคู่ข้อมูล ไม่ใช่ผลยืนยันจาก API จริง):

```json
{
  "success": true,
  "data": {
    "connectionForms": [
      {
        "deviceCode": "S2001/01",
        "type": "Modbus TCP",
        "values": {
          "hostIp": "192.168.1.10",
          "slaveId": "1",
          "port": "502",
          "readFunction": "READ_INPUT"
        }
      },
      {
        "deviceCode": "S2001/02",
        "protocol": "SERIAL_ASCII",
        "values": {
          "comPort": "COM1",
          "slaveId": "1",
          "baudRate": "9600",
          "parity": "NONE",
          "stopBits": "1",
          "dataBits": "8",
          "quantity": "2",
          "measureMin": "0",
          "measureMax": "100"
        }
      }
    ]
  }
}
```

ตัวอย่าง response ใช้สองอุปกรณ์เพื่ออธิบายรูปแบบข้อมูล ไม่ได้เปลี่ยนจำนวนจุดตรวจวัดต่อคำขอ

## สิ่งที่ไม่เปลี่ยน

- สิทธิ์ใช้งานและเงื่อนไขสถานะคำขอ
- ตารางการเชื่อมต่อพารามิเตอร์และข้อมูลทดสอบ
- ไม่มีการส่งคำขอทดสอบหรือบันทึกไปยัง production ระหว่างตรวจการแก้ไขนี้
- ไม่มีการแก้ backend, schema ฐานข้อมูล หรือ runtime OpenAPI ในงานนี้
