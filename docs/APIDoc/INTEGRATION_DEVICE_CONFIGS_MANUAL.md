# คู่มือการเชื่อมโยง API Device Config สำหรับระบบภายนอก

ของระบบ POMS กรมโรงงานอุตสาหกรรม

Service Name : IntegrationDeviceConfigs

## 1. การ Authentication

Client ทำการ Authentication โดยใช้ `X-API-Key` ที่ผู้ดูแลระบบ POMS เป็นผู้กำหนดให้

### 1.1 บริการ API

| รายการ | รายละเอียด |
| --- | --- |
| Method | GET |
| Endpoint | `http://d-poms.diw.go.th/api/v1/integrations/device-configs/{stationId}` |
| ทดสอบ | `http://d-poms.diw.go.th/api/v1/integrations/device-configs/S0002` |
| Security Authentication | `X-API-Key` |
| Content-Type | `application/json;charset=UTF-8` |
| Description | ดึงข้อมูล active device config, parameter config และตารางตั้งเวลาสถานะของจุดตรวจวัดที่เชื่อมต่อแล้ว |

หมายเหตุ: ปัจจุบันทดสอบผ่าน HTTP port 80 ได้แล้ว หากใช้งานจริงควรเปลี่ยนเป็น HTTPS port 443 เมื่อมี SSL certificate พร้อม

## 2. ชุดข้อมูลส่งไป API

### 2.1 Header

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `X-API-Key` | Integration API Key ที่ผู้ดูแลระบบ POMS กำหนดให้ |

### 2.2 Path Parameter

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `stationId` | รหัสจุดตรวจวัด เช่น `S0002`, `P0001` โดยต้องเป็นจุดตรวจวัดที่เชื่อมต่อแล้ว |

## 3. ชุดข้อมูลตอบกลับ

### 3.1 Response หลัก

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `success` | `true` = สำเร็จ, `false` = ไม่สำเร็จ |
| 2 | `data.stationId` | รหัสจุดตรวจวัด |
| 3 | `data.deviceConfigs` | ข้อมูลการเชื่อมต่ออุปกรณ์ แยก 1 รายการต่อ 1 อุปกรณ์ |
| 4 | `data.parameterConfigs` | ข้อมูลพารามิเตอร์/register/standard แยก 1 รายการต่อ 1 พารามิเตอร์ |
| 5 | `data.statusSchedules` | ตารางตั้งเวลาเปลี่ยนสถานะ แยก 1 รายการต่อ 1 พารามิเตอร์ |

### 3.2 deviceConfigs

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `deviceCode` | รหัสอุปกรณ์ เช่น `S0002/01` |
| 2 | `protocol` | Protocol การเชื่อมต่อ เช่น `MODBUS_TCP`, `MODBUS_RTU`, `MSSQL`, `MYSQL` |
| 3 | `hostIp` | IP ของอุปกรณ์หรือฐานข้อมูล |
| 4 | `port` | Port การเชื่อมต่อ |
| 5 | `slaveId` | Slave ID สำหรับ Modbus |
| 6 | `comPort` | COM port สำหรับ `MODBUS_RTU` |
| 7 | `baudRate` | Baud rate สำหรับ `MODBUS_RTU` |
| 8 | `parity` | Parity สำหรับ `MODBUS_RTU` |
| 9 | `stopBits` | Stop bits สำหรับ `MODBUS_RTU` |
| 10 | `dataBits` | Data bits สำหรับ `MODBUS_RTU` |
| 11 | `quantity` | Quantity สำหรับ `MODBUS_RTU` |
| 12 | `dbUser` | Database user สำหรับ `MSSQL` หรือ `MYSQL` |
| 13 | `dbPass` | Database password แบบ masked หรือ `null` |
| 14 | `dbName` | Database name |
| 15 | `deviceValueRangeMin` | ช่วงข้อมูลตรวจวัด Min จาก device config |
| 16 | `deviceValueRangeMax` | ช่วงข้อมูลตรวจวัด Max จาก device config |

### 3.3 parameterConfigs

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `deviceCode` | รหัสอุปกรณ์ที่พารามิเตอร์นี้ผูกอยู่ |
| 2 | `addressId` | Register/address/field id |
| 3 | `parameter` | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `NOx (ppm)` |
| 4 | `parameterName` | ชื่อพารามิเตอร์ไม่รวมหน่วย เช่น `NOx` |
| 5 | `parameterUnit` | หน่วยพารามิเตอร์ เช่น `ppm`; ถ้าไม่มีหน่วยส่ง `null` |
| 6 | `valueRange.min` | ค่าต่ำสุดของช่วงข้อมูล |
| 7 | `valueRange.max` | ค่าสูงสุดของช่วงข้อมูล |
| 8 | `valueFormat` | รูปแบบค่า เช่น `MEASUREMENT_VALUE`, `CURRENT`, `VOLTAGE` |
| 9 | `offset` | Offset |
| 10 | `encoding` | Encoding สำหรับ Modbus |
| 11 | `standardCriteria` | ค่ามาตรฐานตามประกาศ อก. หรือ `null` |
| 12 | `eiaCriteria` | ค่ามาตรฐานตาม EIA หรือ `null` |
| 13 | `status` | สถานะพารามิเตอร์ เช่น `Normal`, `Calibration`, `Maintenance` |

### 3.4 statusSchedules

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `parameter` | พารามิเตอร์ที่ได้รับผล หากเลือกทั้งหมดจะเป็น `ทั้งหมด` |
| 2 | `startAt` | วันเวลาเริ่มใช้สถานะ หรือ `null` |
| 3 | `endAt` | วันเวลาสิ้นสุดสถานะ หรือ `null` |
| 4 | `status` | สถานะที่จะใช้ในช่วงเวลานั้น |

## 4. ตัวอย่างการเรียกใช้ API

```bash
curl "http://d-poms.diw.go.th/api/v1/integrations/device-configs/S0002" \
  -H "X-API-Key: <integration-key>"
```

## 5. ตัวอย่างการตอบกลับ

```json
{
  "success": true,
  "data": {
    "stationId": "S0002",
    "deviceConfigs": [
      {
        "deviceCode": "S0002/01",
        "protocol": "MODBUS_TCP",
        "hostIp": "127.0.0.1",
        "port": 1,
        "slaveId": 1,
        "comPort": null,
        "baudRate": null,
        "parity": null,
        "stopBits": null,
        "dataBits": null,
        "quantity": null,
        "dbUser": null,
        "dbPass": null,
        "dbName": null,
        "deviceValueRangeMin": null,
        "deviceValueRangeMax": null
      }
    ],
    "parameterConfigs": [
      {
        "deviceCode": "S0002/01",
        "addressId": 40001,
        "parameter": "NOx (ppm)",
        "parameterName": "NOx",
        "parameterUnit": "ppm",
        "valueRange": {
          "min": 0,
          "max": 200
        },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 1,
        "encoding": "UNSIGNED16_BIG_ENDIAN",
        "standardCriteria": 120,
        "eiaCriteria": null,
        "status": "Normal"
      }
    ],
    "statusSchedules": [
      {
        "parameter": "ทั้งหมด",
        "startAt": null,
        "endAt": null,
        "status": "Normal"
      }
    ]
  }
}
```

## 6. ตัวอย่าง Error Response

### 6.1 API Key ไม่ถูกต้อง

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid integration API key"
  }
}
```

### 6.2 ไม่พบจุดตรวจวัดที่เชื่อมต่อแล้ว

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Connected measurement point not found"
  }
}
```

## 7. หมายเหตุการใช้งาน

- API นี้ใช้สำหรับระบบภายนอก/worker ดึงข้อมูลแบบ read-only
- `stationId` ต้องเป็นจุดตรวจวัดที่เชื่อมต่อแล้ว
- `parameter` ต้องมีหน่วยกำกับ เช่น `NOx (ppm)` เพื่อป้องกันความสับสนของพารามิเตอร์ที่ชื่อคล้ายกัน
- หากใช้งานจริงควรเรียกผ่าน HTTPS เพื่อป้องกัน `X-API-Key` รั่วระหว่างทาง
