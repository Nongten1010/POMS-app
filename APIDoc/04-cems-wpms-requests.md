# CEMS/WPMS Connection Requests API

API สำหรับ workflow คำขอเชื่อมต่อระบบ CEMS/WPMS ระหว่างผู้ประกอบการและเจ้าหน้าที่

ทุก endpoint ในไฟล์นี้ต้องส่ง:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Endpoints

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/cems-wpms-requests` | `cems_wpms_requests:view` | รายการคำขอ |
| `GET` | `/api/v1/cems-wpms-requests/:id` | `cems_wpms_requests:view` | รายละเอียดคำขอ |
| `POST` | `/api/v1/cems-wpms-requests` | `cems_wpms_requests:edit` | สร้างคำขอ |
| `PUT` | `/api/v1/cems-wpms-requests/:id/form` | `cems_wpms_requests:edit` | ส่งแบบฟอร์มใหม่หลังถูกขอแก้ไข |
| `POST` | `/api/v1/cems-wpms-requests/:id/review` | `cems_wpms_requests:approve` | เจ้าหน้าที่อนุมัติแบบหรือขอแก้ไข |
| `POST` | `/api/v1/cems-wpms-requests/:id/confirm-connection` | `cems_wpms_requests:edit` | ผู้ประกอบการยืนยันเชื่อมต่อ |
| `POST` | `/api/v1/cems-wpms-requests/:id/verify-connection` | `cems_wpms_requests:approve` | เจ้าหน้าที่ตรวจยืนยันเชื่อมต่อ |

## Status Workflow

| Status | Label | เกิดเมื่อ |
| --- | --- | --- |
| `PENDING_DESIGN_REVIEW` | รอพิจารณาแบบ | สร้างคำขอใหม่ |
| `WAITING_CONNECTION` | รอเชื่อมต่อ | เจ้าหน้าที่อนุมัติแบบ |
| `WAITING_FACTORY_REVISION` | รอโรงงานแก้ไข | เจ้าหน้าที่ขอแก้ไข |
| `REVISED_PENDING_DESIGN_REVIEW` | แก้ไขแล้ว/รอพิจารณาแบบ | ผู้ประกอบการส่งแบบฟอร์มใหม่ |
| `CONNECTION_CONFIRMED` | ยืนยันการเชื่อมต่อ | ผู้ประกอบการยืนยันเชื่อมต่อภายในกำหนด |
| `CONNECTED` | เชื่อมต่อแล้ว | เจ้าหน้าที่ verify สำเร็จ |

## Ownership และ Scope

ถ้า permission scope ของ `cems_wpms_requests:view` เป็น `ALL` จะดูได้ทุกคำขอ ถ้าไม่ใช่ `ALL` backend อนุญาตให้อ่านเฉพาะคำขอที่ `createdBy` เป็นผู้ใช้ปัจจุบันเท่านั้น

action ที่เป็นของผู้ประกอบการ เช่น resubmit และ confirm ต้องเป็นเจ้าของคำขอ (`createdBy`) เท่านั้น

## Shared DTO

```json
{
  "id": 1,
  "requestNo": "REQ-20260530-0001",
  "factoryId": "FAC001",
  "factoryName": "โรงงานตัวอย่าง",
  "factoryRegistrationNo": "3-100-1/60",
  "systemType": "CEMS",
  "status": "PENDING_DESIGN_REVIEW",
  "statusLabel": "รอพิจารณาแบบ",
  "contactName": "สมชาย ใจดี",
  "contactPhone": "0812345678",
  "contactEmail": "operator@example.com",
  "remarks": null,
  "revisionReason": null,
  "officerNote": null,
  "connectionDueAt": null,
  "confirmedAt": null,
  "verifiedAt": null,
  "measurementPoints": [
    {
      "id": 1,
      "pointName": "Stack 1",
      "pointCode": "ST-01",
      "pointType": "STACK",
      "latitude": 12.123,
      "longitude": 101.123,
      "parameters": ["NOx", "SO2"],
      "description": "ปล่องหลัก"
    }
  ],
  "statusHistory": [
    {
      "id": 1,
      "status": "PENDING_DESIGN_REVIEW",
      "statusLabel": "รอพิจารณาแบบ",
      "note": null,
      "changedBy": 1,
      "changedAt": "2026-05-30T00:00:00.000Z"
    }
  ],
  "createdBy": 1,
  "createdAt": "2026-05-30T00:00:00.000Z",
  "updatedAt": "2026-05-30T00:00:00.000Z"
}
```

## `GET /api/v1/cems-wpms-requests`

### Query

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | filter ด้วย status ใน workflow |

### Success Response

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0
  }
}
```

## `GET /api/v1/cems-wpms-requests/:id`

คืน `ConnectionRequestDTO` ใน `data`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "requestNo": "REQ-20260530-0001",
    "status": "PENDING_DESIGN_REVIEW",
    "statusLabel": "รอพิจารณาแบบ",
    "measurementPoints": [],
    "statusHistory": []
  }
}
```

## `POST /api/v1/cems-wpms-requests`

สร้างคำขอใหม่ โดย status เริ่มต้นเป็น `PENDING_DESIGN_REVIEW`

### Request Body

```json
{
  "factoryId": "FAC001",
  "factoryName": "โรงงานตัวอย่าง",
  "factoryRegistrationNo": "3-100-1/60",
  "systemType": "CEMS",
  "contactName": "สมชาย ใจดี",
  "contactPhone": "0812345678",
  "contactEmail": "operator@example.com",
  "measurementPoints": [
    {
      "pointName": "Stack 1",
      "pointCode": "ST-01",
      "pointType": "STACK",
      "latitude": 12.123,
      "longitude": 101.123,
      "parameters": ["NOx", "SO2"],
      "description": "ปล่องหลัก"
    }
  ],
  "remarks": "ต้องการเชื่อมต่อ CEMS"
}
```

### Validation

| Field | Rule |
| --- | --- |
| `factoryId` | required, 1-64 chars |
| `factoryName` | required, 1-500 chars |
| `factoryRegistrationNo` | required, 1-64 chars |
| `systemType` | `CEMS` หรือ `WPMS` |
| `contactName` | required, 1-255 chars |
| `contactPhone` | required, 1-64 chars |
| `contactEmail` | email หรือ `null` |
| `measurementPoints` | required, 1-100 items |
| `remarks` | optional, 1-1000 chars หรือ `null` |

### Measurement Point Validation

| Field | Rule |
| --- | --- |
| `pointName` | required, 1-255 chars |
| `pointCode` | optional, 1-64 chars หรือ `null` |
| `pointType` | `STACK`, `WASTEWATER`, `OTHER` |
| `latitude` | optional, -90 ถึง 90 หรือ `null` |
| `longitude` | optional, -180 ถึง 180 หรือ `null` |
| `parameters` | required, 1-50 items, แต่ละ item 1-64 chars |
| `description` | optional, 1-1000 chars หรือ `null` |

## `PUT /api/v1/cems-wpms-requests/:id/form`

ส่งแบบฟอร์มใหม่ได้เฉพาะ status `WAITING_FACTORY_REVISION` และต้องเป็นเจ้าของคำขอ

Request body เหมือน `POST /api/v1/cems-wpms-requests`

ผลลัพธ์จะเปลี่ยน status เป็น:

```text
REVISED_PENDING_DESIGN_REVIEW
```

## `POST /api/v1/cems-wpms-requests/:id/review`

เจ้าหน้าที่ review ได้เมื่อ status เป็น `PENDING_DESIGN_REVIEW` หรือ `REVISED_PENDING_DESIGN_REVIEW`

### Approve Design

```json
{
  "decision": "APPROVE_DESIGN",
  "officerNote": "แบบถูกต้อง"
}
```

ผลลัพธ์:

```text
WAITING_CONNECTION
```

backend จะตั้ง `connectionDueAt` เป็นวันที่ปัจจุบัน + 30 วัน

### Request Revision

```json
{
  "decision": "REQUEST_REVISION",
  "revisionReason": "กรุณาแก้ไขจุดตรวจวัด",
  "officerNote": "ข้อมูลตำแหน่งไม่ครบ"
}
```

ผลลัพธ์:

```text
WAITING_FACTORY_REVISION
```

## `POST /api/v1/cems-wpms-requests/:id/confirm-connection`

ผู้ประกอบการยืนยันการเชื่อมต่อได้เฉพาะ status `WAITING_CONNECTION`, ต้องเป็นเจ้าของคำขอ และต้องยืนยันไม่เกิน `connectionDueAt`

### Request Body

```json
{
  "confirmedAt": "2026-06-15T03:00:00.000Z",
  "note": "เชื่อมต่อเรียบร้อย"
}
```

| Field | Required | Description |
| --- | --- | --- |
| `confirmedAt` | No | ISO datetime; ถ้าไม่ส่ง backend ใช้เวลาปัจจุบัน |
| `note` | No | note 1-1000 chars หรือ `null` |

ผลลัพธ์:

```text
CONNECTION_CONFIRMED
```

## `POST /api/v1/cems-wpms-requests/:id/verify-connection`

เจ้าหน้าที่ verify ได้เฉพาะ status `CONNECTION_CONFIRMED`

### Request Body

```json
{
  "verifiedAt": "2026-06-16T03:00:00.000Z",
  "note": "ตรวจสอบแล้วเชื่อมต่อสำเร็จ"
}
```

ผลลัพธ์:

```text
CONNECTED
```

## Business Errors

| HTTP | Case |
| --- | --- |
| `400` | action ไม่ตรง status ปัจจุบัน |
| `400` | confirm เกิน 30 วันหลังอนุมัติแบบ |
| `403` | อ่าน/แก้คำขอของคนอื่นโดยไม่มี scope หรือไม่ใช่ owner |
| `404` | ไม่พบ request id |
