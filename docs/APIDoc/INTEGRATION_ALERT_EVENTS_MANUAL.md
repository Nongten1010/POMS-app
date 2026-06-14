# คู่มือการเชื่อมโยง API Alert Event สำหรับระบบภายนอก

ของระบบ POMS กรมโรงงานอุตสาหกรรม

Service Name : IntegrationAlertEvents

## 1. การ Authentication

Client ทำการ Authentication โดยใช้ `X-API-Key` ที่ผู้ดูแลระบบ POMS เป็นผู้กำหนดให้

### 1.1 บริการ API

| รายการ | รายละเอียด |
| --- | --- |
| Method | POST |
| Endpoint | `http://d-poms.diw.go.th/api/v1/integrations/alert-events` |
| Security Authentication | `X-API-Key` |
| Content-Type | `application/json;charset=UTF-8` |
| Description | ส่งรายการแจ้งเตือนผลตรวจวัดเกินค่ามาตรฐานหรือเกินค่า EIA เข้าระบบ POMS |
| Limit | ส่งได้ 1 ถึง 500 รายการต่อ 1 request |

หมายเหตุ: ปัจจุบันทดสอบผ่าน HTTP port 80 ได้แล้ว หากใช้งานจริงควรเปลี่ยนเป็น HTTPS port 443 เมื่อมี SSL certificate พร้อม

## 2. ชุดข้อมูลส่งไป API

### 2.1 Header

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `X-API-Key` | Integration API Key ที่ผู้ดูแลระบบ POMS กำหนดให้ |
| 2 | `Content-Type` | `application/json;charset=UTF-8` |

### 2.2 Request Body

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `events` | Array ของรายการแจ้งเตือน ส่งได้ 1 ถึง 500 รายการ |

### 2.3 ข้อมูลใน `events`

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `systemType` | `CEMS` หรือ `WPMS`; BOD/COD Online ให้ใช้ `WPMS` |
| 2 | `stationId` | รหัสจุดตรวจวัด ต้องตรงกับจุดตรวจวัดที่เชื่อมต่อแล้วใน POMS |
| 3 | `pointCode` | รหัสจุดตรวจวัด ถ้าไม่มีสามารถไม่ส่งได้ |
| 4 | `parameterCode` | รหัสพารามิเตอร์ เช่น `so2`, `nox`, `cod`, `bod` |
| 5 | `unit` | หน่วยของผลตรวจวัด เช่น `ppm`, `mg/l` |
| 6 | `eventDate` | วันที่เกิดเหตุการณ์ รูปแบบ `YYYY-MM-DD` |
| 7 | `startTime` | เวลาเริ่มต้น รูปแบบ `HH:mm` |
| 8 | `endTime` | เวลาสิ้นสุด รูปแบบ `HH:mm` |
| 9 | `measuredValue` | ค่าที่ตรวจวัดได้ |
| 10 | `thresholdValue` | ค่าเกณฑ์ที่ใช้เปรียบเทียบ |
| 11 | `thresholdType` | `STANDARD` หรือ `EIA` |

## 3. ชุดข้อมูลตอบกลับ

| No. | Parameter | Description |
| --- | --- | --- |
| 1 | `success` | `true` = สำเร็จ, `false` = ไม่สำเร็จ |
| 2 | `data.total` | จำนวนรายการทั้งหมดที่ส่งมา |
| 3 | `data.created` | จำนวนรายการที่สร้างใหม่ |
| 4 | `data.duplicate` | จำนวนรายการที่ซ้ำและไม่สร้างใหม่ |
| 5 | `data.failed` | จำนวนรายการที่ไม่ผ่าน |
| 6 | `data.results` | ผลลัพธ์แยกตามรายการ โดยอ้างอิง `index` ของ `events` |

## 4. ตัวอย่างการเรียกใช้ API

```bash
curl -X POST "http://d-poms.diw.go.th/api/v1/integrations/alert-events" \
  -H "X-API-Key: <integration-key>" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "events": [
      {
        "systemType": "CEMS",
        "stationId": "S0001",
        "pointCode": "S0001",
        "parameterCode": "so2",
        "unit": "ppm",
        "eventDate": "2026-03-02",
        "startTime": "20:00",
        "endTime": "20:59",
        "measuredValue": 150,
        "thresholdValue": 60,
        "thresholdType": "STANDARD"
      }
    ]
  }'
```

## 5. ตัวอย่างการตอบกลับ

```json
{
  "success": true,
  "data": {
    "total": 1,
    "created": 1,
    "duplicate": 0,
    "failed": 0,
    "results": [
      {
        "index": 0,
        "success": true,
        "created": true,
        "duplicate": false,
        "event": {
          "id": 2,
          "alertType": "STANDARD_EXCEEDED",
          "systemType": "CEMS",
          "factoryName": "บริษัท ปูนซิเมนต์นครหลวง จำกัด (มหาชน) โรงงาน 2",
          "stationId": "S0001",
          "pointName": "ปล่องระบาย A",
          "parameterLabel": "SO2 (ppm)",
          "eventDate": "2026-03-02",
          "timeRange": "20.00 - 20.59",
          "measuredValue": 150,
          "thresholdValue": 60,
          "thresholdType": "STANDARD",
          "notificationStatus": "AUTO"
        }
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
  "success": true,
  "data": {
    "total": 1,
    "created": 0,
    "duplicate": 0,
    "failed": 1,
    "results": [
      {
        "index": 0,
        "success": false,
        "error": {
          "code": "BAD_REQUEST",
          "message": "Alert event stationId must match a connected measurement point"
        }
      }
    ]
  }
}
```

## 7. หมายเหตุการใช้งาน

- ต้องส่ง body เป็น `{ "events": [...] }` เสมอ แม้มีเพียง 1 รายการ
- ระบบ POMS จะ lookup ข้อมูลโรงงานและชื่อจุดตรวจวัดจาก `stationId`/`pointCode`
- ระบบ POMS จะสร้าง `alertType`, `idempotencyKey`, `notificationStatus` เอง
- หากส่งข้อมูลเดิมซ้ำ ระบบจะไม่ insert ซ้ำ และตอบ `duplicate: true`
- หากใช้งานจริงควรเรียกผ่าน HTTPS เพื่อป้องกัน `X-API-Key` รั่วระหว่างทาง
