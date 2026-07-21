# ขอเชื่อมต่อ

> Owner: Backend

## Frontend Quick Start

เมนูนี้รองรับคำขอเชื่อมต่อ CEMS/WPMS ของผู้ประกอบการ หลังเจ้าหน้าที่อนุมัติแบบ backend จะออกรหัสให้ทุกจุดตรวจวัดที่ยังไม่มีรหัสโดยอัตโนมัติ และคืนรหัสผ่าน `measurementPoints[].pointCode`.

### Main Flow

1. ผู้ประกอบการสร้างคำขอปกติ; client ไม่กำหนด `pointCode` สำหรับจุดใหม่.
2. เจ้าหน้าที่อนุมัติแบบด้วย `APPROVE_DESIGN`.
3. Backend เปลี่ยนสถานะเป็น `WAITING_CONNECTION` และออกรหัสเรียงตามลำดับจุดในคำขอ.
4. Client ใช้ `measurementPoints[].pointCode` จาก response สำหรับตั้งค่าอุปกรณ์และเรียก API ที่ใช้ `stationId` ต่อไป.

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/101/review' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"decision":"APPROVE_DESIGN","officerNote":null}'
```

ผู้ประกอบการยกเลิกคำขอของตนเอง:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/101/cancel' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"reason":"ยุติโครงการติดตั้งระบบตรวจวัด"}'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| อนุมัติแบบและออกรหัสจุดตรวจวัด | `POST` | `/api/v1/cems-wpms-requests/:id/review` | Bearer | `cems_wpms_requests:approve` | [Approve design](#approve-design) |
| อ่านรายละเอียดคำขอและรหัสจุด | `GET` | `/api/v1/cems-wpms-requests/:id` | Bearer | `cems_wpms_requests:view` | [Read request](#read-request) |
| อ่านจุดตรวจวัดที่เชื่อมต่อแล้ว | `GET` | `/api/v1/connected-measurement-points` | Bearer | `cems_wpms_requests:view` | [Connected points](#connected-points) |
| ผู้ประกอบการยกเลิกคำขอ | `POST` | `/api/v1/cems-wpms-requests/:id/cancel` | Bearer | `cems_wpms_requests:edit` + owner | [Cancel request](./operator-cancel-request.md) |

## Point-code Contract

กติกานี้ใช้เฉพาะ flow ปกติของผู้ประกอบการ:

| `systemType` | รูปแบบรหัสใหม่ | รหัสแรกขั้นต่ำ | ตัวอย่างลำดับ |
| --- | --- | --- | --- |
| `CEMS` | `S` + ตัวเลขอย่างน้อย 4 หลัก | `S2001` | `S2001`, `S2002`, ... |
| `WPMS` | `W` + ตัวเลขอย่างน้อย 4 หลัก | `W2001` | `W2001`, `W2002`, ... |

- CEMS และ WPMS ใช้ลำดับแยกกัน.
- ถ้ามีรหัส prefix เดียวกันซึ่งมีเลขสูงกว่า `2000` อยู่แล้ว ระบบออกเลขต่อจากค่าสูงสุด.
- รหัส `Sxxxx` และ `Pxxxx` เดิมไม่ถูก migrate; client ต้องยังอ่านและส่งรหัสเดิมเหล่านั้นเป็น opaque identifier ได้.
- รหัส `Pxxxx` เดิมไม่ถูกนำมาคำนวณลำดับ `Wxxxx`.
- คำขอ `ADD_PARAMETER` ใช้รหัสจุดเดิมและไม่ออกรหัสใหม่.
- `POST /api/v1/cems-wpms-requests/direct-connections` ไม่ใช้ลำดับนี้ และเก็บรหัสที่เจ้าหน้าที่ส่งใน `measurementPoints[0].pointCode`.
- การจองเลขและการเปลี่ยนสถานะทำใน transaction เดียวกันเพื่อไม่ให้คำขอพร้อมกันได้รหัสซ้ำ.

## Contracts

### Approve design

Request fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `decision` | string | yes | ต้องเป็น `APPROVE_DESIGN` สำหรับ flow นี้ |
| `officerNote` | string \| null | no | ข้อความที่ trim แล้ว สูงสุด 1000 ตัวอักษร |

Minimal request:

```json
{
  "decision": "APPROVE_DESIGN",
  "officerNote": null
}
```

Relevant response fields (`200 OK`):

| Field | Type | Meaning |
| --- | --- | --- |
| `success` | boolean | สำเร็จเป็น `true` |
| `data.status` | string | เป็น `WAITING_CONNECTION` หลังอนุมัติแบบ |
| `data.systemType` | string | `CEMS` หรือ `WPMS` |
| `data.measurementPoints[].pointCode` | string | รหัสที่ backend ออกตาม Point-code Contract |

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "systemType": "WPMS",
    "status": "WAITING_CONNECTION",
    "measurementPoints": [
      {
        "id": 201,
        "pointName": "จุดระบายน้ำทิ้ง 1",
        "pointCode": "W2001"
      }
    ]
  }
}
```

### Read request

Path fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | integer | yes | รหัสคำขอที่ผู้ใช้มีสิทธิ์อ่าน |

Minimal request: ไม่มี request body.

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "systemType": "CEMS",
    "measurementPoints": [
      {
        "id": 201,
        "pointCode": "S2001"
      }
    ]
  }
}
```

### Connected points

Query fields ที่เกี่ยวกับรหัสจุด:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `stationId` | string | no | กรองด้วยรหัสจุดตรวจวัดแบบ exact identifier |

Minimal request: ไม่มี request body.

Minimal response:

```json
{
  "success": true,
  "data": [
    {
      "type": "WPMS",
      "point": {
        "pointCode": "W2001"
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## Errors

ใช้ error envelope กลางของระบบ:

- `401 Unauthorized` เมื่อไม่มี bearer token ที่ถูกต้อง.
- `403 Forbidden` เมื่อไม่มี permission หรืออ่านคำขอนอก scope.
- `404 Not Found` เมื่อไม่พบคำขอหรือจุดตรวจวัดใน scope.
- `400 Bad Request` เมื่อ payload หรือสถานะปัจจุบันไม่อนุญาตให้ทำ action.

## Business Flow And Explanations

- Workflow spec: [`workflows/operator-normal-connection-point-code.md`](../../../../../workflows/operator-normal-connection-point-code.md)
- [Contract ผู้ประกอบการยกเลิกคำขอ](./operator-cancel-request.md) และ [workflow spec](../../../../../workflows/operator-cancel-connection-request.md)
- การเชื่อมต่อโดยเจ้าหน้าที่โดยตรงเป็น flow แยกและไม่ใช้ลำดับอัตโนมัตินี้.

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`connection-requests.routes.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts), [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts) |
| Validators | [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts) |
| Public types | [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Sequence implementation | [`connection-requests.repository.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts) |
| Migration | [`0075_start_operator_point_codes_at_2001.ts`](../../../../../backend/src/db/migrations/0075_start_operator_point_codes_at_2001.ts) |
| Tests | [`connection-requests.point-code-sequence.repository.test.ts`](../../../../../backend/tests/unit/connection-requests.point-code-sequence.repository.test.ts), [`connection-point-code-sequence-migration.test.ts`](../../../../../backend/tests/unit/connection-point-code-sequence-migration.test.ts) |
