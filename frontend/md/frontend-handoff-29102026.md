# การปรับหน้าตั้งค่าอุปกรณ์: รูปแบบ 16bit, Scale, Gain และ Quantity

เอกสารสรุปการเปลี่ยนแปลง frontend ในเมนูขอเชื่อมต่อ > ตั้งค่าอุปกรณ์ ไม่ใช่การยืนยันว่า backend รองรับฟิลด์ใหม่แล้ว

สัญญา API หลัก: [การตั้งค่าอุปกรณ์](../../docs/backend/api/menus/connection-requests/device-configs.md)

## การเปลี่ยนแปลงหน้าจอ

- รูปแบบค่าข้อมูลตรวจวัดเพิ่ม `16 bit Resolution` โดยส่ง `valueFormat: "16bit"`
- เพิ่มคอลัมน์ Scale min, Scale max, ค่า Gain ตามลำดับ ต่อจากรูปแบบค่าข้อมูลตรวจวัด และก่อนค่า Offset
- ช่องใหม่ใช้ numeric input รับทศนิยมและค่าติดลบ ไม่บังคับกรอก ช่องว่างส่ง `null` และรักษาค่า `0`
- ช่องใหม่แสดงสำหรับทุกรูปแบบค่าข้อมูลตรวจวัด ไม่ได้จำกัดเฉพาะ 16bit
- อุปกรณ์ Modbus TCP เพิ่ม Quantity ท้ายสุด หลังฟังก์ชันการอ่านข้อมูล ใช้รูปแบบช่องเดียวกับ Quantity ของ Modbus RTU

## API ที่เกี่ยวข้อง

| งาน | Method | Path |
| --- | --- | --- |
| โหลดค่าของคำขอ | GET | `/api/v1/cems-wpms-requests/:id/device-configs?stationId=:stationId` |
| บันทึกค่าของคำขอ | POST | `/api/v1/cems-wpms-requests/:id/device-configs` |
| โหลดค่าของจุดที่เชื่อมต่อแล้ว | GET | `/api/v1/connected-measurement-points/:stationId/device-configs` |
| บันทึกค่าของจุดที่เชื่อมต่อแล้ว | POST | `/api/v1/connected-measurement-points/:stationId/device-configs` |

## Payload ที่เพิ่ม

| ตำแหน่งใน config | ชนิด | การเปลี่ยนแปลง |
| --- | --- | --- |
| `channels[].valueFormat` | string/null | เพิ่มค่า `16bit`; ตัวเลือกเดิมคงเดิม |
| `channels[].scaleMin` | number/null | Scale min |
| `channels[].scaleMax` | number/null | Scale max |
| `channels[].gain` | number/null | ค่า Gain |
| `settings.quantity` | number/null | เพิ่มให้ `MODBUS_TCP`; ว่างส่ง `null` |

รูปแบบ payload เดิมไม่เปลี่ยน: คำขอที่มีอุปกรณ์เดียวส่ง `settings` และ `channels` ที่ root ส่วนหลายอุปกรณ์หรือจุดที่เชื่อมต่อแล้วใช้ `config.device[].settings` และ `config.channels[]`

ตัวอย่างเฉพาะส่วนของ config อุปกรณ์เดียว (ตัด field อื่นออกเพื่อแสดงการเปลี่ยนแปลง):

```json
{
  "stationId": "P0002",
  "deviceCode": "P0002/01",
  "protocol": "MODBUS_TCP",
  "settings": { "quantity": 4 },
  "channels": [
    {
      "deviceCode": "P0002/01",
      "dataType": "COD (mg/l)",
      "valueFormat": "16bit",
      "scaleMin": -1.5,
      "scaleMax": 100,
      "gain": 0.25
    }
  ]
}
```

## Response ที่ frontend อ่าน

- `data.parameterMappings[].valueFormat`: แปลง `16bit` เป็นข้อความ `16 bit Resolution`
- `data.parameterMappings[].scaleMin`, `scaleMax`, `gain`: เติมช่องใหม่; ไม่มีค่า/`null` แสดงช่องว่าง
- ถ้าไม่มี `parameterMappings` ใช้ `data.rawConfigs.channels[]` ตามรูปแบบสำรองเดิม โดยอ่านชื่อฟิลด์เดียวกัน
- Modbus TCP อ่าน `data.connectionForms[].values.quantity` ทั้ง string/number และอ่าน `settings.quantity` จาก raw config ตามรูปแบบสำรองเดิม
- หลังบันทึกยังเรียก GET เพื่อโหลดค่าจากระบบตามเดิม

การแก้ไขนี้ไม่มีการคำนวณ Scale/Gain ที่ frontend ไม่เปลี่ยนตารางผลทดสอบ สิทธิ์ สถานะคำขอ หรือ endpoint
