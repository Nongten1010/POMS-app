# Frontend Test Handoff

เอกสารนี้คือข้อมูลขั้นต่ำที่ frontend ต้องใช้เพื่อทดสอบกับ POMS backend ในเครื่อง local

## 1. เปิด backend

จากโฟลเดอร์ `backend`:

```bash
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

หรือใช้คำสั่งเดียวสำหรับ setup + smoke test:

```bash
npm run test:api:local
```

คำสั่งนี้จะเตรียม MSSQL, migrate, seed, เปิด/เช็ค backend และยิง smoke test ให้ครบ

ถ้าต้องการเปิด backend ค้างไว้ให้ frontend เรียก:

```bash
npm run dev
```

Backend จะอยู่ที่:

```text
http://localhost:3000
```

API prefix:

```text
/api/v1
```

Frontend env ที่แนะนำ:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## 2. Health check

```http
GET http://localhost:3000/health
```

Expected:

```json
{
  "success": true,
  "status": "ok"
}
```

## 3. Login endpoint

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

### Admin officer

```json
{
  "userType": "officer",
  "username": "weekit",
  "departmentID": "2",
  "password": "demo1234"
}
```

### KPM officer

```json
{
  "userType": "officer",
  "username": "officer_kpm",
  "departmentID": "2",
  "password": "demo1234"
}
```

### Provincial officer

```json
{
  "userType": "officer",
  "username": "officer_sng",
  "departmentID": "2",
  "password": "demo1234"
}
```

### Operator

```json
{
  "userType": "operator",
  "username": "operator_demo",
  "password": "demo1234"
}
```

### Citizen

```json
{
  "userType": "citizen",
  "username": "citizen_demo",
  "password": "demo1234"
}
```

## 4. Login response shape

Frontend ใช้ `data.accessToken` สำหรับเรียก endpoint ที่ต้อง login

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "userType": "admin",
      "username": "weekit",
      "firstName": "วีกิจ",
      "lastName": "ชมญาติ"
    },
    "profile": {},
    "roles": ["admin"],
    "scopes": {
      "factories:view": "ALL"
    },
    "permissions": {
      "dashboard": {
        "view": true
      },
      "factories": {
        "view": true
      }
    }
  }
}
```

หมายเหตุ: `permissions` และ `scopes` จะต่างกันตาม role

## 5. Get current user

```http
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer <accessToken>
```

Expected:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userType": "admin",
    "roles": ["admin"],
    "scopes": {},
    "permissions": {}
  }
}
```

## 6. User permission management

API ชุดนี้ใช้กับหน้ารายชื่อเจ้าหน้าที่/จัดการสิทธิ์ในระบบ

ทุก endpoint ต้องส่ง token จาก login:

```http
Authorization: Bearer <accessToken>
```

Frontend เปิดหน้านี้ได้เมื่อ user มีอย่างน้อยหนึ่ง permission:

```js
const canOpenPermissionPage =
  permissions?.users?.view === true ||
  permissions?.permissions?.manage === true
```

Frontend เปิดปุ่มเพิ่ม/แก้ไข/ลบได้เมื่อ user มีอย่างน้อยหนึ่ง permission:

```js
const canEditUserPermission =
  permissions?.users?.edit === true ||
  permissions?.permissions?.manage === true
```

Backend ตรวจ permission ซ้ำเสมอ:

| Endpoint | Required permission |
| --- | --- |
| `GET /users` | `users:view` หรือ `permissions:manage` |
| `GET /users/:id` | `users:view` หรือ `permissions:manage` |
| `POST /users` | `users:edit` หรือ `permissions:manage` |
| `PATCH /users/:id` | `users:edit` หรือ `permissions:manage` |
| `DELETE /users/:id` | `users:edit` หรือ `permissions:manage` |
| `GET /users/:id/permissions` | `permissions:manage` |
| `PUT /users/:id/permissions` | `permissions:manage` |

### 6.1 List users table

ใช้กับหน้าตารางรายชื่อเจ้าหน้าที่

```http
GET http://localhost:3000/api/v1/users?search=officer&status=all
Authorization: Bearer <accessToken>
```

Query params:

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | number | no | ถ้าไม่ส่ง `page/perPage` จะดึงทั้งหมด; ถ้าส่งจะ paginate หน้าเริ่มที่ `1` |
| `perPage` | number | no | ถ้าไม่ส่ง `page/perPage` จะดึงทั้งหมด; ถ้าส่ง max `100` |
| `search` | string | no | ค้นจาก username / ชื่อ / นามสกุล |
| `roleCode` | string | no | filter role เช่น `admin`, `diw_central`, `provincial_office` |
| `status` | string | no | `active`, `suspended`, `all`; default `all` |

Expected response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "weekit",
      "fullName": "วีกิจ ชมญาติ",
      "affiliation": "กรมโรงงานอุตสาหกรรม",
      "position": "นักวิชาการสิ่งแวดล้อม",
      "level": "ปฏิบัติการ",
      "roles": [
        {
          "code": "admin",
          "nameTh": "Admin",
          "nameEn": "Administrator"
        }
      ],
      "primaryRole": {
        "code": "admin",
        "nameTh": "Admin",
        "nameEn": "Administrator"
      },
      "status": "active",
      "statusLabel": "ใช้งาน"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

ถ้าต้องการใช้ pagination แบบเดิม ยังเรียกได้:

```http
GET http://localhost:3000/api/v1/users?page=1&perPage=25&status=all
Authorization: Bearer <accessToken>
```

response จะมี `meta.page`, `meta.perPage`, `meta.totalPages` เพิ่มเข้ามา

ตาราง frontend map field แบบนี้:

| UI column | API field |
| --- | --- |
| Username | `username` |
| ชื่อ-นามสกุล | `fullName` |
| สังกัด | `affiliation` |
| ตำแหน่ง | `position` |
| ระดับ | `level` |
| สิทธิ์ในระบบ | `primaryRole.nameTh` หรือ `roles` |
| สถานะ | `statusLabel` |
| Option edit/delete | `id` |

### 6.2 Get user detail for edit

ใช้ตอนกดแก้ไขสิทธิ์รายคน

```http
GET http://localhost:3000/api/v1/users/1
Authorization: Bearer <accessToken>
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "weekit",
    "userType": "admin",
    "externalId": "1102001567054",
    "identityProvider": "mock",
    "prenameTh": "นาย",
    "firstName": "วีกิจ",
    "lastName": "ชมญาติ",
    "email": "weekit@example.local",
    "phone": null,
    "isActive": true,
    "status": "active",
    "statusLabel": "ใช้งาน",
    "roles": [
      {
        "code": "admin",
        "nameTh": "Admin",
        "nameEn": "Administrator"
      }
    ],
    "profile": {
      "departmentId": "3010000",
      "lineNameTh": "นักวิชาการสิ่งแวดล้อม",
      "levelNameTh": "ปฏิบัติการ"
    }
  }
}
```

### 6.3 Create user

```http
POST http://localhost:3000/api/v1/users
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body:

```json
{
  "username": "officer_api_demo",
  "externalId": "officer_api_demo",
  "userType": "officer",
  "prenameTh": "นาย",
  "firstName": "ทดสอบ",
  "lastName": "สิทธิ์ระบบ",
  "email": "officer_api_demo@example.local",
  "phone": "0800000000",
  "isActive": true,
  "roleCodes": ["diw_central"],
  "profile": {
    "departmentId": "3010000",
    "lineNameTh": "นักวิชาการสิ่งแวดล้อม",
    "levelNameTh": "ปฏิบัติการ"
  }
}
```

Expected status: `201 Created`

หมายเหตุ: API นี้เพิ่มข้อมูล user/role สำหรับจัดการสิทธิ์ใน POMS แต่ยังไม่ได้สร้าง password flow สำหรับ local login ถ้า user ใหม่นี้ต้อง login ได้เอง ต้องมี identity provider หรือ password setup flow เพิ่ม

### 6.4 Update user

ใช้แก้ข้อมูล สิทธิ์ และสถานะรายคน

```http
PATCH http://localhost:3000/api/v1/users/25
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body ส่งเฉพาะ field ที่ต้องแก้ได้:

```json
{
  "isActive": false,
  "roleCodes": ["provincial_office"],
  "profile": {
    "departmentId": "4019000",
    "lineNameTh": "เจ้าหน้าที่ตรวจสอบ",
    "levelNameTh": "ชำนาญการ"
  }
}
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": 25,
    "username": "officer_api_demo",
    "status": "suspended",
    "statusLabel": "ระงับใช้งาน",
    "roles": [
      {
        "code": "provincial_office",
        "nameTh": "สอจ.",
        "nameEn": "Provincial Industrial Office"
      }
    ]
  }
}
```

หลัง update สำเร็จ frontend ควร refetch `GET /users` เพื่อ refresh ตาราง

### 6.5 Delete user

```http
DELETE http://localhost:3000/api/v1/users/25
Authorization: Bearer <accessToken>
```

Expected status: `204 No Content`

เป็น soft delete ฝั่ง backend

### 6.6 Get per-user permission overrides

ใช้ตอนเปิดหน้าจัดสิทธิ์รายตัว เพื่อดูสิทธิ์จาก role, override ราย user, และ effective permissions หลังรวมแล้ว

```http
GET http://localhost:3000/api/v1/users/25/permissions
Authorization: Bearer <accessToken>
```

Expected response:

```json
{
  "success": true,
  "data": {
    "userId": 25,
    "rolePermissions": [
      {
        "code": "dashboard:view",
        "resource": "dashboard",
        "action": "view",
        "description": "ดู dashboard หน้าหลัก",
        "scope": "ALL"
      }
    ],
    "overrides": [
      {
        "code": "factories:edit",
        "resource": "factories",
        "action": "edit",
        "description": "แก้ไขข้อมูลพื้นฐานโรงงาน",
        "scope": null,
        "effect": "deny"
      }
    ],
    "effectiveScopes": {
      "dashboard:view": "ALL"
    },
    "permissions": {
      "dashboard": {
        "view": true
      }
    }
  }
}
```

ความหมาย:

| Field | Description |
| --- | --- |
| `rolePermissions` | สิทธิ์ที่ได้จาก role ปัจจุบันของ user |
| `overrides` | สิทธิ์ราย user ที่ตั้งเพิ่ม/ตัดทับ role |
| `effectiveScopes` | permission สุดท้ายหลังรวม role + override |
| `permissions` | object สำหรับ frontend ใช้เช็คเปิด/ปิด UI เหมือน login response |

### 6.7 Replace per-user permission overrides

ใช้บันทึกสิทธิ์ราย user ทั้งชุด โดยเป็น replace ทั้งหมดของ override รายคนนั้น

```http
PUT http://localhost:3000/api/v1/users/25/permissions
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body:

```json
{
  "permissions": [
    {
      "code": "dashboard:view",
      "effect": "allow",
      "scope": "ALL"
    },
    {
      "code": "factories:edit",
      "effect": "deny"
    }
  ]
}
```

Allowed values:

| Field | Values |
| --- | --- |
| `effect` | `allow`, `deny` |
| `scope` | `ALL`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, `null` |

Rules:

- `deny` จะตัด permission นั้นออกจาก effective permissions แม้ role จะมีสิทธิ์
- `allow` จะเพิ่ม/override permission นั้นให้ user โดยตรง
- payload นี้เป็น replace ทั้งชุด ถ้าส่ง `permissions: []` คือ clear override ราย user ทั้งหมด
- หลังบันทึกสำเร็จ ถ้าแก้สิทธิ์ของ user ที่กำลัง login อยู่ ควรให้ user login ใหม่ หรือ refresh session เพราะ JWT เดิมยังถือ permissions เก่า

Expected response เป็น shape เดียวกับ `GET /users/:id/permissions`

### 6.8 Validation/error cases for user management

| Case | Status | `error.code` |
| --- | --- | --- |
| ไม่มี token หรือ token ผิด | 401 | `UNAUTHORIZED` |
| ไม่มี permission | 403 | `FORBIDDEN` |
| payload ไม่ถูกต้อง | 400 | `VALIDATION_ERROR` |
| username หรือ externalId ซ้ำ | 409 | `CONFLICT` |
| user id ไม่มีอยู่ | 404 | `NOT_FOUND` |
| permission code ไม่มีอยู่ | 400 | `BAD_REQUEST` |

## 7. Error cases ที่ frontend ควรรองรับ

Frontend ควรดู `error.code` เป็นหลัก ไม่ควร hardcode จาก `error.message`

Wrong password / account not provisioned / inactive account:

```http
POST /api/v1/auth/login
```

Expected status/body:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  }
}
```

Missing required fields:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "password": ["Invalid input: expected string, received undefined"]
    }
  }
}
```

Too many login attempts:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many login attempts. Please try again later."
  }
}
```

No token / invalid token:

```text
401
```

Unknown route:

```text
404
```

## 8. Quick manual test

```bash
curl http://localhost:3000/health
```

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}'
```

ทดสอบ rate limit เฉพาะ login:

```bash
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"wrong"}'
done
```

หลังยิงถี่เกิน limit ควรได้ `429`

## 9. Backend smoke test

ถ้า frontend บอกว่าเรียก backend ไม่ได้ ให้เช็คฝั่ง backend ด้วย:

```bash
npm run test:api:local
```

ถ้าผ่าน `All 15 tests passed` แปลว่า backend พร้อมใช้งาน
