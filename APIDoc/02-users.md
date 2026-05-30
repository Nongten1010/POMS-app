# Users API

API สำหรับจัดการผู้ใช้ในระบบ, local account, role และ permission override

ทุก endpoint ในไฟล์นี้ต้องส่ง:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Endpoints

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/users` | `users:view` หรือ `permissions:manage` | รายการผู้ใช้ |
| `GET` | `/api/v1/users/:id` | `users:view` หรือ `permissions:manage` | รายละเอียดผู้ใช้แบบ auth detail |
| `POST` | `/api/v1/users` | `users:edit` หรือ `permissions:manage` | สร้าง managed user |
| `POST` | `/api/v1/users/local-accounts` | `users:edit` หรือ `permissions:manage` | สร้าง local login account |
| `PATCH` | `/api/v1/users/:id` | `users:edit` หรือ `permissions:manage` | แก้ไขผู้ใช้ |
| `DELETE` | `/api/v1/users/:id` | `users:edit` หรือ `permissions:manage` | soft delete ผู้ใช้ |
| `GET` | `/api/v1/users/:id/permissions` | `permissions:manage` | ดู permission ที่มีผลจริง |
| `PUT` | `/api/v1/users/:id/permissions` | `permissions:manage` | แทนที่ permission override |

## `GET /api/v1/users`

### Query

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `page` | number | No | integer >= 1 | ถ้าส่ง `page` หรือ `perPage` จะเปิด pagination |
| `perPage` | number | No | 1-100 | default 25 เมื่อเปิด pagination |
| `search` | string | No | 1-128 chars | ค้นจากข้อมูลผู้ใช้ |
| `roleCode` | string | No | 1-32 chars | filter ตาม role |
| `status` | string | No | `active`, `suspended`, `all` | default `all` |

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "admin",
      "fullName": "ผู้ดูแล ระบบ",
      "department": "กรมโรงงานอุตสาหกรรม",
      "lineNameTh": "เทคโนโลยีสารสนเทศ",
      "levelNameTh": "ชำนาญการ",
      "roles": "admin",
      "isActive": true
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "perPage": 25,
    "totalPages": 1
  }
}
```

## `GET /api/v1/users/:id`

คืนข้อมูลในรูปแบบเดียวกับหน้าแก้ไขผู้ใช้และ auth permission

```json
{
  "user": {
    "userType": "officer",
    "username": "admin",
    "fullName": "ผู้ดูแล ระบบ",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "เทคโนโลยีสารสนเทศ",
    "levelNameTh": "ชำนาญการ",
    "roles": "admin",
    "isActive": true,
    "source": "created"
  },
  "permissions": {
    "permissions": {
      "data": "ALL",
      "view": true
    }
  }
}
```

## `POST /api/v1/users`

สร้าง managed user ที่อิง schema ปัจจุบันของ backend

### Request Body

```json
{
  "username": "officer01",
  "externalId": "1234567890123",
  "userType": "officer",
  "prenameTh": "นาย",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "email": "officer01@example.com",
  "phone": "0812345678",
  "isActive": true,
  "roleCodes": ["diw_central"],
  "profile": {
    "departmentNameTh": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการ",
    "levelNameTh": "ชำนาญการ"
  }
}
```

### Validation สำคัญ

| Field | Rule |
| --- | --- |
| `username` | required, trim, 3-64 chars |
| `externalId` | optional, 1-32 chars |
| `userType` | `officer` หรือ `admin`, default `officer` |
| `roleCodes` | required, 1-20 items, role ต้องมีจริง |
| `email` | email format หรือ `null` |
| `profile.*` | string หรือ `null` ตาม field |

### Success Response

```json
{
  "success": true,
  "data": {
    "id": 10,
    "userType": "officer",
    "externalId": "1234567890123",
    "identityProvider": "local",
    "username": "officer01",
    "prenameTh": "นาย",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "email": "officer01@example.com",
    "phone": "0812345678",
    "isActive": true,
    "profile": {}
  }
}
```

## `POST /api/v1/users/local-accounts`

สร้าง account ที่ login ด้วย `provider: "local"` ได้ เหมาะกับ user ที่สร้างในระบบ POMS เอง

### Request Body

```json
{
  "fullName": "สมชาย ใจดี",
  "username": "officer01",
  "password": "password123",
  "department": "กรมโรงงานอุตสาหกรรม",
  "lineNameTh": "นักวิชาการ",
  "levelNameTh": "ชำนาญการ",
  "roles": "diw_central",
  "userType": "officer",
  "isActive": true,
  "permissionOverrides": [
    {
      "code": "permissions:manage",
      "effect": "allow",
      "scope": "ALL"
    }
  ]
}
```

### Validation สำคัญ

| Field | Rule |
| --- | --- |
| `fullName` | required, 1-255 chars |
| `username` | required, 3-64 chars, ต้องไม่ซ้ำ |
| `password` | required, 8-128 chars |
| `roles` | role code เดี่ยว ใช้แปลงเป็น `roleCodes` |
| `permissionOverrides` | optional, max 200, `code` ห้ามซ้ำ |

## `PATCH /api/v1/users/:id`

รองรับ 2 รูปแบบ request:

### Legacy Payload

```json
{
  "username": "officer01",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "isActive": true,
  "roleCodes": ["diw_central"],
  "password": "new-password123"
}
```

### Edit Form Payload

```json
{
  "user": {
    "fullName": "สมชาย ใจดี",
    "username": "officer01",
    "password": "new-password123",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการ",
    "levelNameTh": "ชำนาญการ",
    "roles": "diw_central",
    "isActive": true,
    "source": "created"
  },
  "permissions": {
    "permissions": {
      "data": "ALL",
      "view": true
    }
  }
}
```

ถ้าส่ง `password` เป็น string ว่าง ระบบจะถือว่าไม่เปลี่ยน password

## `DELETE /api/v1/users/:id`

เป็น soft delete และห้ามผู้ใช้ลบตัวเอง

Success response:

```text
204 No Content
```

## `GET /api/v1/users/:id/permissions`

```json
{
  "success": true,
  "data": {
    "userId": 10,
    "rolePermissions": [
      {
        "code": "users:view",
        "resource": "users",
        "action": "view",
        "description": "View users",
        "scope": "ALL"
      }
    ],
    "overrides": [],
    "effectiveScopes": {
      "users:view": "ALL"
    },
    "permissions": {
      "users": {
        "data": "ALL",
        "view": true
      }
    }
  }
}
```

## `PUT /api/v1/users/:id/permissions`

แทนที่ override ทั้งชุดของ user นั้น

### Request Body

```json
{
  "permissions": [
    {
      "code": "users:view",
      "effect": "allow",
      "scope": "ALL"
    },
    {
      "code": "users:edit",
      "effect": "deny",
      "scope": null
    }
  ]
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `permissions[].code` | string | Yes | permission code ต้องมีจริง |
| `permissions[].effect` | string | Yes | `allow` หรือ `deny` |
| `permissions[].scope` | string/null | No | `ALL`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, `null` |

## Business Rules

| Rule | Behavior |
| --- | --- |
| username/externalId ซ้ำ | `409 CONFLICT` |
| role code ไม่มีจริง | `400 BAD_REQUEST` |
| permission code ไม่มีจริง | `400 BAD_REQUEST` |
| ลบตัวเอง | `403 FORBIDDEN` |
| ไม่พบ user | `404 NOT_FOUND` |
