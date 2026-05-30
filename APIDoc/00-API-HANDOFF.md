# D-POMS API Handoff

อัปเดตล่าสุด: 2026-05-30

เอกสารนี้เป็นไฟล์รวม API ทั้งหมดของ backend สำหรับส่งต่อให้ frontend, tester, หรือ agent ตัวถัดไปใช้งานได้ทันที โดยรายละเอียดเชิงลึกแยกอยู่ในไฟล์ย่อยในโฟลเดอร์ `APIDoc/`

## กติกาการดูแลเอกสารเมื่อมี API ใหม่

ทุกครั้งที่เพิ่ม แก้ไข หรือลบ API ให้ทำพร้อมโค้ดใน PR/งานเดียวกันเสมอ:

1. เพิ่ม endpoint ในไฟล์รวมนี้ (`00-API-HANDOFF.md`)
2. เพิ่มหรือแก้ไฟล์แยกของ module นั้น เช่น `01-auth.md`, `02-users.md`
3. ระบุ method, path, auth, permission, request, response, validation, error สำคัญ และตัวอย่าง JSON
4. ถ้ามี permission key หรือ status ใหม่ ให้เพิ่มในตารางของไฟล์ที่เกี่ยวข้อง
5. ถ้ามี breaking change ให้เขียนชัดเจนว่า frontend ต้องแก้อะไร

## Base URL

ค่า prefix มาจาก `API_PREFIX` ใน backend env โดย default คือ:

```text
/api/v1
```

ตัวอย่าง local:

```text
http://localhost:3000/api/v1
```

ตัวอย่าง production ตามเอกสารเดิม:

```text
http://d-poms.diw.go.th/api/v1
```

## Headers มาตรฐาน

API ที่ต้อง login ใช้ header นี้:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Response Envelope

API ส่วนใหญ่ตอบกลับเป็น envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

ข้อยกเว้นหลักคือ `POST /auth/login` และ `GET /auth/me` ที่ตอบกลับ `accessToken`, `user`, `permissions` โดยตรงตามโครง auth เดิม

Error response มาตรฐาน:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {}
  }
}
```

## System Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | ตรวจสุขภาพ service |
| `GET` | `/api/v1` | No | ตรวจ API prefix และ version |

### `GET /health`

```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-05-30T00:00:00.000Z"
}
```

### `GET /api/v1`

```json
{
  "success": true,
  "message": "POMS API",
  "version": "0.1.0"
}
```

## API Index

| Module | Method | Path | Auth | Permission | รายละเอียด |
| --- | --- | --- | --- | --- | --- |
| Auth | `POST` | `/api/v1/auth/login` | No | - | Login และรับ access token |
| Auth | `GET` | `/api/v1/auth/me` | Yes | - | ดึง profile และ permission ของผู้ใช้ปัจจุบัน |
| Users | `GET` | `/api/v1/users` | Yes | `users:view` หรือ `permissions:manage` | รายการผู้ใช้งานระบบ |
| Users | `GET` | `/api/v1/users/:id` | Yes | `users:view` หรือ `permissions:manage` | รายละเอียดผู้ใช้รูปแบบ auth detail |
| Users | `POST` | `/api/v1/users` | Yes | `users:edit` หรือ `permissions:manage` | สร้าง managed user |
| Users | `POST` | `/api/v1/users/local-accounts` | Yes | `users:edit` หรือ `permissions:manage` | สร้างบัญชี local สำหรับ login ผ่าน POMS |
| Users | `PATCH` | `/api/v1/users/:id` | Yes | `users:edit` หรือ `permissions:manage` | แก้ไขผู้ใช้ |
| Users | `DELETE` | `/api/v1/users/:id` | Yes | `users:edit` หรือ `permissions:manage` | soft delete ผู้ใช้ |
| Users | `GET` | `/api/v1/users/:id/permissions` | Yes | `permissions:manage` | ดู permission ของผู้ใช้ |
| Users | `PUT` | `/api/v1/users/:id/permissions` | Yes | `permissions:manage` | แทนที่ permission override ของผู้ใช้ |
| Eligible Factories | `GET` | `/api/v1/eligible-factories/candidates` | Yes | `eligible_factories:manage` | รายชื่อโรงงาน candidate จาก source |
| Eligible Factories | `GET` | `/api/v1/eligible-factories` | Yes | `eligible_factories:manage` | รายชื่อโรงงานที่เลือกแล้ว |
| Eligible Factories | `POST` | `/api/v1/eligible-factories` | Yes | `eligible_factories:manage` | เลือก/บันทึกโรงงานเข้า eligible list |
| Eligible Factories | `DELETE` | `/api/v1/eligible-factories/:id` | Yes | `eligible_factories:manage` | ลบโรงงานออกจาก eligible list |
| CEMS/WPMS Requests | `GET` | `/api/v1/cems-wpms-requests` | Yes | `cems_wpms_requests:view` | รายการคำขอเชื่อมต่อ |
| CEMS/WPMS Requests | `GET` | `/api/v1/cems-wpms-requests/:id` | Yes | `cems_wpms_requests:view` | รายละเอียดคำขอเชื่อมต่อ |
| CEMS/WPMS Requests | `POST` | `/api/v1/cems-wpms-requests` | Yes | `cems_wpms_requests:edit` | สร้างคำขอเชื่อมต่อ |
| CEMS/WPMS Requests | `PUT` | `/api/v1/cems-wpms-requests/:id/form` | Yes | `cems_wpms_requests:edit` | ส่งแบบฟอร์มใหม่หลังถูกขอแก้ไข |
| CEMS/WPMS Requests | `POST` | `/api/v1/cems-wpms-requests/:id/review` | Yes | `cems_wpms_requests:approve` | เจ้าหน้าที่อนุมัติแบบหรือขอแก้ไข |
| CEMS/WPMS Requests | `POST` | `/api/v1/cems-wpms-requests/:id/confirm-connection` | Yes | `cems_wpms_requests:edit` | ผู้ประกอบการยืนยันเชื่อมต่อภายใน 30 วัน |
| CEMS/WPMS Requests | `POST` | `/api/v1/cems-wpms-requests/:id/verify-connection` | Yes | `cems_wpms_requests:approve` | เจ้าหน้าที่ตรวจยืนยันว่าเชื่อมต่อแล้ว |
| Device Connections | `GET` | `/api/v1/device-connections` | No | - | รายการ config การเชื่อมต่อ device ตาม station |
| Device Connections | `GET` | `/api/v1/device-connections/:id` | No | - | รายละเอียด config การเชื่อมต่อ device |
| Device Connections | `POST` | `/api/v1/device-connections` | Yes | `cems_wpms_requests:edit` | บันทึก config การเชื่อมต่อ device |
| Device Connections | `POST` | `/api/v1/device-connections/test-connection` | Yes | `cems_wpms_requests:edit` | ทดสอบ config การเชื่อมต่อแบบ mock |

## ไฟล์รายละเอียด

| File | ใช้เมื่อ |
| --- | --- |
| `01-auth.md` | Login, token, user profile, permission group |
| `02-users.md` | จัดการผู้ใช้และ permission override |
| `03-eligible-factories.md` | Candidate factory และ eligible factory list |
| `04-cems-wpms-requests.md` | Workflow คำขอเชื่อมต่อ CEMS/WPMS |
| `05-device-connections.md` | Device connection config, protocol, channel mapping |

## Permission Scope

| Value | ความหมาย |
| --- | --- |
| `ALL` | เห็นข้อมูลทั้งหมด |
| `IN_PROVINCE` | เห็นข้อมูลในจังหวัดที่เกี่ยวข้อง |
| `IN_ESTATE` | เห็นข้อมูลในนิคมอุตสาหกรรมที่เกี่ยวข้อง |
| `OWN_FACTORY` | เห็นเฉพาะโรงงานของตนเอง |
| `null` | ไม่มีขอบเขตข้อมูล หรือ permission ไม่กำหนด scope |

## Error Codes ที่พบได้บ่อย

| HTTP | Code | ความหมาย |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | request ไม่ผ่าน schema validation |
| `400` | `BAD_REQUEST` | business rule ไม่ผ่าน เช่น status ผิด |
| `401` | `UNAUTHORIZED` | token หาย, token ไม่ถูกต้อง, หรือ login ไม่ผ่าน |
| `403` | `FORBIDDEN` | ไม่มี permission หรือ scope ไม่พอ |
| `404` | `NOT_FOUND` | ไม่พบ resource |
| `409` | `CONFLICT` | ข้อมูลซ้ำ เช่น username หรือ externalId |
| `429` | `RATE_LIMITED` | login ถี่เกิน limit |
| `500` | `INTERNAL_ERROR` | error ที่ไม่ได้จัดประเภท |
