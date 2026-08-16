# การเชื่อมต่ออุปกรณ์

> Owner: Backend

## Overview

กลุ่มนี้ครอบ API สำหรับจัดการ connection configuration ที่ใช้ทั้งในงานขอเชื่อมต่อและใน flow ทดสอบการเชื่อมต่ออุปกรณ์

## Endpoints

| งาน                          | Method | Path                                         | Auth   | Permission                |
| ---------------------------- | ------ | -------------------------------------------- | ------ | ------------------------- |
| รายการ connection configs    | `GET`  | `/api/v1/device-connections`                 | Bearer | `cems_wpms_requests:view` |
| รายละเอียด connection config | `GET`  | `/api/v1/device-connections/:id`             | Bearer | `cems_wpms_requests:view` |
| สร้าง connection config      | `POST` | `/api/v1/device-connections`                 | Bearer | `cems_wpms_requests:edit` |
| ทดสอบ connection             | `POST` | `/api/v1/device-connections/test-connection` | Bearer | `cems_wpms_requests:edit` |

## Request Contract

`POST /device-connections` รับได้ทั้ง config เดี่ยวหรือ batch ผ่าน `createDeviceConnectionConfigRequestSchema` ส่วน `POST /device-connections/test-connection` รับ config เดี่ยวผ่าน `testDeviceConnectionSchema`

ตัวอย่าง payload:

```json
{
  "stationId": "CEMS-0001/2569",
  "protocol": "MODBUS_TCP",
  "deviceCode": "PLC-01",
  "settings": {
    "hostIp": "10.0.0.10",
    "port": 502,
    "slaveId": 1
  },
  "channels": [
    {
      "dataType": "co2",
      "addressId": 1
    }
  ]
}
```

Validation หลัก:

- endpoint สร้างรับได้ทั้ง object เดี่ยว หรือ `{ "configs": [...] }`; endpoint ทดสอบรับเฉพาะ object เดี่ยว
- `stationId`: required string 1-64
- `protocol`: required enum `POMS_BOX | MODBUS_RTU | MODBUS_TCP | MSSQL | MYSQL`
- `channels`: optional array ไม่เกิน 200
- `configs`: ถ้าใช้แบบ batch ต้องมีอย่างน้อย 1 และไม่เกิน 50
- `statusManagement` รองรับ schedule หลายช่วง แต่ช่วงเวลาซ้อนกันของพารามิเตอร์เดียวกันจะถูก reject

## Maintainer Links

- Routes: `backend/src/modules/device-connections/device-connections.routes.ts`
- Controller: `backend/src/modules/device-connections/device-connections.controller.ts`
- Validator: `backend/src/modules/device-connections/device-connections.validator.ts`
- OpenAPI: `backend/src/modules/api-docs/poms.openapi.ts`
