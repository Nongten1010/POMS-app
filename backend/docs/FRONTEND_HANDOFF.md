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

Frontend ใช้ `accessToken` สำหรับเรียก endpoint ที่ต้อง login

> หมายเหตุ: response ของ `auth/login` ไม่ห่อด้วย `{ success, data }` แล้ว ให้ frontend อ่านค่าจาก top-level โดยตรง

```json
{
  "accessToken": "eyJ...",
  "user": {
    "username": "1102001567054",
    "fullName": "นายวีกิจ ชมญาติ",
    "department": "2",
    "lineNameTh": "นักวิชาการคอมพิวเตอร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "admin",
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true,
      "export": true
    },
    "factories": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
    },
    "conditional_search": {
      "data": "ALL",
      "view": true
    }
  }
}
```

หมายเหตุ: `permissions` จะต่างกันตาม role และทุก module มี `data` scope (`ALL`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, หรือ `null`)

## 5. Get current user

```http
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer <accessToken>
```

Expected:

```json
{
  "user": {
    "username": "1102001567054",
    "fullName": "นายวีกิจ ชมญาติ",
    "department": "2",
    "lineNameTh": "นักวิชาการคอมพิวเตอร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "admin",
    "isActive": true
  },
  "permissions": {}
}
```

## 6. User permission management

API ชุดนี้ใช้กับหน้ารายชื่อเจ้าหน้าที่/จัดการสิทธิ์ในระบบ

ทุก endpoint ต้องส่ง token จาก login:

```http
Authorization: Bearer <accessToken>
```

User response ทุก endpoint ในชุดนี้ใช้ชื่อ field หลักให้เหมือน auth API:

| Meaning | API field |
| --- | --- |
| สังกัด | `department` |
| ตำแหน่ง | `lineNameTh` |
| ระดับ | `levelNameTh` |
| สถานะการใช้งาน | `isActive` |

Frontend เปิดหน้านี้ได้เมื่อ user มีอย่างน้อยหนึ่ง permission:

```js
const canOpenPermissionPage =
  permissions?.users?.view === true ||
  permissions?.permissions?.view === true
```

Frontend เปิดปุ่มเพิ่ม/แก้ไข/ลบได้เมื่อ user มีอย่างน้อยหนึ่ง permission:

```js
const canEditUserPermission =
  permissions?.users?.edit === true ||
  permissions?.permissions?.view === true
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

### Role catalog สำหรับ frontend

ใช้ list นี้ทำ dropdown / filter / badge label ของ `roleCodes` ได้เลย ค่า `code` คือค่าที่ส่งให้ API:

| code | nameTh | nameEn | ใช้กับ UI |
| --- | --- | --- | --- |
| `public_anonymous` | ประชาชน ไม่ login | Public Anonymous | public/no auth เท่านั้น ปกติไม่ต้องใช้ในฟอร์มเจ้าหน้าที่ |
| `public_user` | ประชาชน login | Public Logged-in | citizen login |
| `factory_operator` | โรงงาน (ผู้ประกอบการ) | Factory Operator | ผู้ประกอบการ/โรงงาน |
| `diw_central` | กรอ. | DIW Central | เจ้าหน้าที่ กรอ. ส่วนกลาง |
| `provincial_office` | สอจ. | Provincial Industrial Office | สำนักงานอุตสาหกรรมจังหวัด |
| `industrial_estate` | กนอ. | Industrial Estate Authority | การนิคมฯ |
| `monitoring_kpm` | เจ้าหน้าที่ศูนย์เฝ้า (กฝม.) | Pollution Monitoring (KPM) | เจ้าหน้าที่ กฝม. |
| `monitoring_5_centers` | เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์) | Regional Centers (5) | เจ้าหน้าที่ 5 ศูนย์ภูมิภาค |
| `center_director` | ผอ.ศูนย์ | Center Director | ผู้อำนวยการศูนย์ |
| `kpm_director` | ผอ.กฝม. | KPM Director | ผู้อำนวยการ กฝม. |
| `kwp_director` | ผอ.กวภ. | KWP Director | ผู้อำนวยการ กวภ. |
| `admin` | Admin | Administrator | ผู้ดูแลระบบ |

ตัวอย่าง object สำหรับ frontend:

```js
export const ROLE_OPTIONS = [
  { code: 'diw_central', nameTh: 'กรอ.', nameEn: 'DIW Central' },
  { code: 'provincial_office', nameTh: 'สอจ.', nameEn: 'Provincial Industrial Office' },
  { code: 'industrial_estate', nameTh: 'กนอ.', nameEn: 'Industrial Estate Authority' },
  { code: 'monitoring_kpm', nameTh: 'เจ้าหน้าที่ศูนย์เฝ้า (กฝม.)', nameEn: 'Pollution Monitoring (KPM)' },
  { code: 'monitoring_5_centers', nameTh: 'เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์)', nameEn: 'Regional Centers (5)' },
  { code: 'center_director', nameTh: 'ผอ.ศูนย์', nameEn: 'Center Director' },
  { code: 'kpm_director', nameTh: 'ผอ.กฝม.', nameEn: 'KPM Director' },
  { code: 'kwp_director', nameTh: 'ผอ.กวภ.', nameEn: 'KWP Director' },
  { code: 'admin', nameTh: 'Admin', nameEn: 'Administrator' },
];
```

สำหรับหน้าสร้างเจ้าหน้าที่ใน POMS แนะนำให้ใช้เฉพาะ role เจ้าหน้าที่ใน `ROLE_OPTIONS` ตัวอย่างด้านบน ไม่ต้องโชว์ `public_*` และ `factory_operator` เว้นแต่จะทำฟอร์มจัดการ citizen/operator แยกต่างหาก

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
      "department": "กรมโรงงานอุตสาหกรรม",
      "lineNameTh": "นักวิชาการสิ่งแวดล้อม",
      "levelNameTh": "ปฏิบัติการ",
      "roles": "admin",
      "isActive": true
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
| สังกัด | `department` |
| ตำแหน่ง | `lineNameTh` |
| ระดับ | `levelNameTh` |
| สิทธิ์ในระบบ | `roles` |
| สถานะ | `isActive` |
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
  "user": {
    "username": "1102001567054",
    "fullName": "นายวีกิจ ชมญาติ",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการสิ่งแวดล้อม",
    "levelNameTh": "ปฏิบัติการ",
    "roles": "admin",
    "isActive": true,
    "source": "api"
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true,
      "export": true
    },
    "factories": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    }
  }
}
```

หมายเหตุ: response นี้เป็น shape เดียวกับ `auth/login` แต่ไม่มี `accessToken` และไม่ห่อด้วย `{ success, data }`

`user.source` ใช้บอกที่มาของ user:

| value | ความหมาย |
| --- | --- |
| `api` | user มาจาก API/identity provider ภายนอก |
| `created` | user ถูกสร้างขึ้นใน POMS |

### 6.3 Create user with local username/password

ใช้ endpoint นี้สำหรับ requirement ปัจจุบัน: ชื่อ-สกุลรวมช่องเดียว, ไม่มี email, ไม่มีเบอร์โทร, มี username/password และเลือก `roles`

```http
POST http://localhost:3000/api/v1/users/local-accounts
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body:

```json
{
  "fullName": "สมชาย ทดสอบ",
  "username": "local_officer",
  "password": "StrongerPass123",
  "department": "กรมโรงงานอุตสาหกรรม",
  "lineNameTh": "นักวิทยาศาสตร์",
  "levelNameTh": "ชำนาญการ",
  "roles": "diw_central",
  "isActive": true
}
```

Expected status: `201 Created`

Expected response:

```json
{
  "success": true,
  "data": {
    "id": 25,
    "username": "local_officer",
    "fullName": "สมชาย ทดสอบ",
    "userType": "officer",
    "email": null,
    "phone": null,
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "diw_central",
    "isActive": true
  }
}
```

Rules:

- `fullName` คือชื่อ-สกุลรวมกันในช่องเดียว
- ห้ามส่ง `email` หรือ `phone`; backend ใช้ schema strict และจะตอบ `400 VALIDATION_ERROR`
- `password` ต้องยาวอย่างน้อย 8 ตัวอักษร สูงสุด 128 ตัวอักษร
- `department`, `lineNameTh`, `levelNameTh` ใส่หรือไม่ใส่ก็ได้
- `roles` ต้องตรงกับ role catalog ด้านบน เช่น `diw_central`

Login ด้วย user ที่สร้างจาก endpoint นี้:

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

```json
{
  "userType": "officer",
  "username": "local_officer",
  "password": "StrongerPass123"
}
```

หมายเหตุ: backend จะเช็กบัญชี local จาก `username/password` ก่อน ถ้าไม่เจอจึง fallback ไป API/mock เดิม ดังนั้น frontend ไม่ต้องส่ง `provider: "local"` แล้ว

### 6.4 Create provisioned/mock-style user

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

หมายเหตุ: API นี้ยังเหมาะกับ user ที่ผูก identity provider/mock profile และมี first/last name แยกช่อง ถ้าต้องสร้าง user ที่ login ด้วย username/password ใน POMS ให้ใช้ `POST /users/local-accounts`

### 6.5 Update user

ใช้แก้ข้อมูล สิทธิ์ และสถานะรายคน

```http
PATCH http://localhost:3000/api/v1/users/25
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body ใช้ shape เดียวกับ `GET /users/:id` ได้ โดยส่ง `user` และ `permissions` กลับมา:

```json
{
  "user": {
    "fullName": "สมชาย ทดสอบ",
    "username": "local_officer",
    "password": "StrongerPass123",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "diw_central",
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true
    },
    "conditional_search": {
      "data": null,
      "view": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
    },
    "factories": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    }
  }
}
```

หมายเหตุ:

- `user.password` ไม่บังคับ; ถ้าไม่ส่งหรือส่งค่าว่าง backend จะไม่เปลี่ยนรหัสผ่านเดิม
- `user.department`, `user.lineNameTh`, `user.levelNameTh` ไม่บังคับ; ถ้าไม่ส่งหรือส่งค่าว่าง backend จะไม่เปลี่ยนค่าเดิม
- `permissions` ไม่บังคับ; ถ้าส่งมา backend จะแปลง object นี้เป็น per-user permission overrides
- payload flat แบบเก่า (`isActive`, `roleCodes`, `profile`) ยังใช้ได้อยู่

Expected response:

```json
{
  "success": true,
  "data": {
    "id": 25,
    "username": "officer_api_demo",
    "department": "สำนักงานอุตสาหกรรมจังหวัดสระบุรี",
    "lineNameTh": "เจ้าหน้าที่ตรวจสอบ",
    "levelNameTh": "ชำนาญการ",
    "isActive": false,
    "roles": "provincial_office"
  }
}
```

หลัง update สำเร็จ frontend ควร refetch `GET /users` เพื่อ refresh ตาราง

### 6.6 Delete user

```http
DELETE http://localhost:3000/api/v1/users/25
Authorization: Bearer <accessToken>
```

Expected status: `204 No Content`

เป็น soft delete ฝั่ง backend

### 6.7 Get per-user permission overrides

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

### 6.8 Replace per-user permission overrides

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

### 6.9 Validation/error cases for user management

| Case | Status | `error.code` |
| --- | --- | --- |
| ไม่มี token หรือ token ผิด | 401 | `UNAUTHORIZED` |
| ไม่มี permission | 403 | `FORBIDDEN` |
| payload ไม่ถูกต้อง | 400 | `VALIDATION_ERROR` |
| username หรือ externalId ซ้ำ | 409 | `CONFLICT` |
| user id ไม่มีอยู่ | 404 | `NOT_FOUND` |
| permission code ไม่มีอยู่ | 400 | `BAD_REQUEST` |
| roleCode ไม่มีอยู่ | 400 | `BAD_REQUEST` |

## 7. Eligible factories

API ชุดนี้ใช้กับฟังก์ชัน “เลือกโรงงานที่เข้าข่าย”

ทุก endpoint ต้องส่ง token:

```http
Authorization: Bearer <accessToken>
```

ผู้ใช้ต้องมี permission:

```text
eligible_factories:manage
```

### 7.1 Candidate factories จากฐานข้อมูล DIW

backend รองรับ 2 mode:

```text
FACTORY_SOURCE_MODE=mock      # ใช้ mock 60,000 records
FACTORY_SOURCE_MODE=external  # อ่านจาก diw.dbo.fac_import
```

บน server จริงให้ใช้ `external` เพื่อดึงข้อมูลจาก DB `diw` ตาราง `fac_import`

```http
GET http://localhost:3000/api/v1/eligible-factories/candidates
```

Endpoint นี้ไม่รับ query filter/pagination และจะคืนรายการโรงงานจาก Fac60k source
โดยตัดโรงงานที่ถูกเลือกเป็น eligible แล้วออกจากผลลัพธ์

ตัวอย่าง: ถ้า source มี 60,000 โรงงาน และเลือกเข้าข่ายแล้ว 1,000 โรงงาน
endpoint นี้จะคืน 59,000 โรงงาน

Example:

```bash
curl "http://localhost:3000/api/v1/eligible-factories/candidates" \
  -H "Authorization: Bearer <accessToken>"
```

Candidate response มี 20 fields ตาม `backend/docs/DataDict_Fac60k.xlsx`:

```json
{
  "success": true,
  "data": [
    {
      "factoryName": "ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง",
      "factoryId": "10100302325234",
      "factoryRegistrationNo": "3-64(6)-45/17",
      "factoryClass": "1",
      "factorySubclass": "3",
      "address": "50/10-11-12 ซอยบรมบรรพต ถนนบริพัตร",
      "provinceName": "กรุงเทพมหานคร",
      "industrialEstateName": null,
      "longitude": null,
      "latitude": null,
      "businessActivity": "ทำผลิตภัณฑ์โลหะต่าง ๆ",
      "operationStatus": "แจ้งประกอบแล้ว",
      "capitalAmount": 1825000,
      "machineryHorsepower": 75,
      "productionCapacity": null,
      "wastewaterDischargeInfo": null,
      "boilerCount": null,
      "boilerSizeEach": null,
      "fuelUsed": null,
      "hasEia": null
    }
  ],
  "meta": {
    "total": 59000,
    "source": "external"
  }
}
```

### 7.2 Save selected eligible factory

เมื่อผู้ใช้เลือก candidate แล้ว ให้ส่งข้อมูลโรงงานนั้นเข้า endpoint นี้ เพื่อบันทึก snapshot ลง DB เรา

```http
POST http://localhost:3000/api/v1/eligible-factories
Content-Type: application/json
Authorization: Bearer <accessToken>
```

Payload ที่ frontend ส่งให้ใช้ shape เดียวกับ candidate response และต้องส่ง key ให้ครบ 20 fields
field ที่ยังไม่รู้ค่าให้ส่ง `null`

```json
{
  "factoryName": "ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง",
  "factoryId": "10100302325234",
  "factoryRegistrationNo": "3-64(6)-45/17",
  "factoryClass": "1",
  "factorySubclass": "3",
  "address": "50/10-11-12 ซอยบรมบรรพต ถนนบริพัตร",
  "provinceName": "กรุงเทพมหานคร",
  "industrialEstateName": null,
  "longitude": null,
  "latitude": null,
  "businessActivity": "ทำผลิตภัณฑ์โลหะต่าง ๆ",
  "operationStatus": "แจ้งประกอบแล้ว",
  "capitalAmount": 1825000,
  "machineryHorsepower": 75,
  "productionCapacity": null,
  "wastewaterDischargeInfo": null,
  "boilerCount": null,
  "boilerSizeEach": null,
  "fuelUsed": null,
  "hasEia": null
}
```

Created response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "sourceSystem": "mock_external_factory_db",
    "sourceFactoryId": "mock-factory-0005",
    "factoryRegistrationNoNew": "3-106-33/50รย",
    "factoryName": "บริษัท ระยองพาวเวอร์บอยเลอร์ จำกัด",
    "provinceName": "ระยอง",
    "selectedBy": 1,
    "selectedAt": "2026-05-24T15:00:00.000Z"
  }
}
```

ถ้าเลือกเลขทะเบียนโรงงานใหม่ซ้ำ จะได้:

```text
409 CONFLICT
```

### 7.3 Remove selected eligible factory

ใช้เอาโรงงานออกจากรายการที่เลือกเข้าข่ายแล้ว เป็น soft delete และโรงงานนั้นจะกลับไปอยู่ใน
`GET /eligible-factories/candidates`

```http
DELETE http://localhost:3000/api/v1/eligible-factories/:id
Authorization: Bearer <accessToken>
```

Success response:

```text
204 No Content
```

ถ้าไม่พบรายการหรือถูกลบไปแล้ว จะได้:

```text
404 NOT_FOUND
```

### 7.4 List selected eligible factories

ใช้แสดงรายการที่เลือกเข้าข่ายแล้วจาก DB ของ POMS

```http
GET http://localhost:3000/api/v1/eligible-factories
```

Endpoint นี้ไม่รับ query params และจะ list รายการที่ยังไม่ถูกลบทั้งหมด
item ใน `data` ใช้ field เหมือน candidate response และเพิ่ม `id` สำหรับใช้ลบรายการออกจาก list

## 8. CEMS/WPMS connection request API

API ชุดนี้ใช้กับเมนู “ขอเชื่อมต่อ” ส่วน “แบบฟอร์มคำขอ เพิ่มจุดตรวจวัด”

Base URL:

```text
http://localhost:3000/api/v1/cems-wpms-requests
```

Permission ที่ใช้:

```text
cems_wpms_requests:view
cems_wpms_requests:edit
cems_wpms_requests:approve
```

### 8.1 Status flow

Case 1:

| Step | Actor | Endpoint | Status |
| --- | --- | --- | --- |
| 1 | ผู้ประกอบการ | `POST /cems-wpms-requests` | `PENDING_DESIGN_REVIEW` / รอพิจารณาแบบ |
| 2 | เจ้าหน้าที่ | `POST /cems-wpms-requests/:id/review` decision=`APPROVE_DESIGN` | `WAITING_CONNECTION` / รอเชื่อมต่อ |
| 3 | ผู้ประกอบการ | `POST /cems-wpms-requests/:id/confirm-connection` ภายใน 30 วัน | `CONNECTION_CONFIRMED` / ยืนยันการเชื่อมต่อ |
| 4 | เจ้าหน้าที่ | `POST /cems-wpms-requests/:id/verify-connection` | `CONNECTED` / เชื่อมต่อแล้ว |

Case 2:

| Step | Actor | Endpoint | Status |
| --- | --- | --- | --- |
| 1 | ผู้ประกอบการ | `POST /cems-wpms-requests` | `PENDING_DESIGN_REVIEW` / รอพิจารณาแบบ |
| 2 | เจ้าหน้าที่ | `POST /cems-wpms-requests/:id/review` decision=`REQUEST_REVISION` | `WAITING_FACTORY_REVISION` / รอโรงงานแก้ไข |
| 3 | ผู้ประกอบการ | `PUT /cems-wpms-requests/:id/form` | `REVISED_PENDING_DESIGN_REVIEW` / แก้ไขแล้ว/รอพิจารณาแบบ |
| 4 | เจ้าหน้าที่ | `POST /cems-wpms-requests/:id/review` decision=`APPROVE_DESIGN` | `WAITING_CONNECTION` / รอเชื่อมต่อ |
| 5 | ผู้ประกอบการ | `POST /cems-wpms-requests/:id/confirm-connection` ภายใน 30 วัน | `CONNECTION_CONFIRMED` / ยืนยันการเชื่อมต่อ |
| 6 | เจ้าหน้าที่ | `POST /cems-wpms-requests/:id/verify-connection` | `CONNECTED` / เชื่อมต่อแล้ว |

### 8.2 Create request form

```http
POST http://localhost:3000/api/v1/cems-wpms-requests
Authorization: Bearer <operatorAccessToken>
Content-Type: application/json
```

Request body:

```json
{
  "factoryId": "factory-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "3-106-33/50สบ",
  "systemType": "CEMS",
  "contactName": "สมชาย ใจดี",
  "contactPhone": "0812345678",
  "contactEmail": "ops@example.com",
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointCode": "STACK-A",
      "pointType": "STACK",
      "latitude": 13.7563,
      "longitude": 100.5018,
      "parameters": ["NOx", "SO2", "PM"],
      "description": "จุดตรวจวัดหลัก"
    }
  ],
  "remarks": "ขอเชื่อมต่อระบบใหม่"
}
```

Allowed values:

| Field | Values |
| --- | --- |
| `systemType` | `CEMS`, `WPMS` |
| `pointType` | `STACK`, `WASTEWATER`, `OTHER` |

Success response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "requestNo": "CR-20260527-0001",
    "status": "PENDING_DESIGN_REVIEW",
    "statusLabel": "รอพิจารณาแบบ",
    "connectionDueAt": null,
    "measurementPoints": [
      {
        "id": 1,
        "pointName": "ปล่องระบาย A",
        "pointCode": "STACK-A",
        "pointType": "STACK",
        "latitude": 13.7563,
        "longitude": 100.5018,
        "parameters": ["NOx", "SO2", "PM"],
        "description": "จุดตรวจวัดหลัก"
      }
    ],
    "statusHistory": [
      {
        "status": "PENDING_DESIGN_REVIEW",
        "statusLabel": "รอพิจารณาแบบ"
      }
    ]
  }
}
```

### 8.3 List and detail

```http
GET http://localhost:3000/api/v1/cems-wpms-requests
Authorization: Bearer <accessToken>
```

Optional filter:

```http
GET http://localhost:3000/api/v1/cems-wpms-requests?status=WAITING_CONNECTION
```

```http
GET http://localhost:3000/api/v1/cems-wpms-requests/:id
Authorization: Bearer <accessToken>
```

Operator เห็นเฉพาะรายการที่ตัวเองสร้าง ส่วนเจ้าหน้าที่ที่มี scope `ALL` เห็นทั้งหมด

### 8.4 Officer review

Approve design:

```http
POST http://localhost:3000/api/v1/cems-wpms-requests/:id/review
Authorization: Bearer <officerAccessToken>
Content-Type: application/json
```

```json
{
  "decision": "APPROVE_DESIGN",
  "officerNote": "แบบถูกต้อง"
}
```

ผลลัพธ์จะเป็น `WAITING_CONNECTION` และ backend จะตั้ง `connectionDueAt` เป็น 30 วันนับจากเวลาพิจารณา

Request revision:

```json
{
  "decision": "REQUEST_REVISION",
  "revisionReason": "เพิ่มรายละเอียดจุดตรวจวัด",
  "officerNote": "ตรวจแล้วต้องแก้ไข"
}
```

ผลลัพธ์จะเป็น `WAITING_FACTORY_REVISION`

### 8.5 Resubmit revised form

```http
PUT http://localhost:3000/api/v1/cems-wpms-requests/:id/form
Authorization: Bearer <operatorAccessToken>
Content-Type: application/json
```

ใช้ body shape เดียวกับ `POST /cems-wpms-requests` หลังส่งสำเร็จ status จะเป็น
`REVISED_PENDING_DESIGN_REVIEW` / แก้ไขแล้ว/รอพิจารณาแบบ

### 8.6 Confirm and verify connection

Operator confirm ภายใน 30 วัน:

```http
POST http://localhost:3000/api/v1/cems-wpms-requests/:id/confirm-connection
Authorization: Bearer <operatorAccessToken>
Content-Type: application/json
```

```json
{
  "note": "ส่งค่าเข้าระบบได้แล้ว"
}
```

ถ้าเลย `connectionDueAt` จะได้ `400 BAD_REQUEST`

Officer verify:

```http
POST http://localhost:3000/api/v1/cems-wpms-requests/:id/verify-connection
Authorization: Bearer <officerAccessToken>
Content-Type: application/json
```

```json
{
  "note": "ตรวจสอบค่าในระบบแล้ว"
}
```

ผลลัพธ์จะเป็น `CONNECTED` / เชื่อมต่อแล้ว

## 9. Device connection config API

API ชุดนี้ใช้กับหน้าตั้งค่า connection อุปกรณ์ตรวจวัดตาม `stationId`

Base URL:

```text
http://localhost:3000/api/v1/device-connections
```

Permission ที่ใช้:

```text
GET /device-connections       ไม่ต้องส่ง Authorization
POST /device-connections      cems_wpms_requests:edit
POST /test-connection         cems_wpms_requests:edit
```

### 9.1 Data model สำหรับ UI

ทั้ง 4 protocol ใช้โครงเดียวกัน:

```ts
type DeviceConnectionPayload = {
  stationId: string
  protocol: 'MODBUS_RTU' | 'MODBUS_TCP' | 'MSSQL' | 'MYSQL'
  settings: object
  channels: DeviceMeasurementChannel[]
}
```

แนวคิดสำคัญ:

| Field | Meaning |
| --- | --- |
| `settings` | connection point 1 ชุด เช่น COM/Slave หรือ Host/DB |
| `channels` | อุปกรณ์/ค่าตรวจวัดหลายรายการภายใต้ connection point เดียวกัน |
| `POST /device-connections/test-connection` | backend จำลองการเชื่อมต่อสำเร็จ ใช้ระหว่างรอ API/driver จริง |
| `POST /device-connections` | บันทึก config ตาม payload จริง ไม่ต้องส่ง field สำหรับ mock |

Channel shape:

```json
{
  "addressId": 40001,
  "dataType": "CO2",
  "unit": "ppm",
  "valueRange": { "min": 0, "max": 200 },
  "valueFormat": "MEASUREMENT_VALUE",
  "offset": 0,
  "encoding": "UNSIGNED16_BIG_ENDIAN"
}
```

Validation สำคัญ:

| Field | Rule |
| --- | --- |
| `addressId` | integer ตั้งแต่ `40001` |
| `offset` | number ได้ทั้งบวกและลบ |
| `valueRange.min/max` | `min <= max` |
| `valueFormat` | รูปแบบค่าข้อมูลตรวจวัด: `MEASUREMENT_VALUE` = ค่าตรวจวัดปกติ, `CURRENT` = ค่ากระแสไฟฟ้า, `VOLTAGE` = ค่าแรงดันไฟฟ้า |
| Modbus channel | ต้องมี `valueRange` และ `encoding` |
| DB channel | ใช้เฉพาะ `addressId`, `dataType`, `unit`, `offset` ตามไฟล์ client |
| `dbPass` | ส่งตอน create/test ได้ แต่ response จะ mask เป็น `********` |

### 9.2 Mock test connection

```http
POST http://localhost:3000/api/v1/device-connections/test-connection
Authorization: Bearer <operatorAccessToken>
Content-Type: application/json
```

ตัวอย่าง Modbus RTU: 1 connection point + 2 อุปกรณ์ตรวจวัด

```json
{
  "stationId": "STATION_001",
  "protocol": "MODBUS_RTU",
  "settings": {
    "comPort": 1,
    "slaveId": 1,
    "baudRate": 9600,
    "parity": "NONE",
    "stopBits": 1,
    "dataBits": 8,
    "valueRange": { "min": 0, "max": 200 },
    "quantity": 2
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "CO2",
      "unit": "ppm",
      "valueRange": { "min": 0, "max": 200 },
      "valueFormat": "MEASUREMENT_VALUE",
      "offset": 0,
      "encoding": "UNSIGNED"
    },
    {
      "addressId": 40002,
      "dataType": "O2",
      "unit": "%",
      "valueRange": { "min": 0, "max": 25 },
      "valueFormat": "MEASUREMENT_VALUE",
      "offset": -0.1,
      "encoding": "SIGNED"
    }
  ]
}
```

Expected:

```json
{
  "success": true,
  "data": {
    "success": true,
    "mode": "MOCK",
    "protocol": "MODBUS_RTU",
    "stationId": "STATION_001",
    "message": "Mock connection succeeded",
    "checkedAt": "2026-05-27T13:21:00.000Z",
    "details": {
      "endpoint": "COM1:slave-1",
      "channelCount": 2
    }
  }
}
```

### 9.3 Create config

```http
POST http://localhost:3000/api/v1/device-connections
Authorization: Bearer <operatorAccessToken>
Content-Type: application/json
```

ตัวอย่าง MSSQL: 1 connection point + 2 อุปกรณ์ตรวจวัด

```json
{
  "stationId": "STATION_001",
  "protocol": "MSSQL",
  "settings": {
    "hostIp": "192.168.1.254",
    "port": 1433,
    "dbUser": "sensor_user",
    "dbPass": "secret-pass",
    "dbName": "sensor_db"
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "COD",
      "unit": "mg/L",
      "offset": -0.5
    },
    {
      "addressId": 40002,
      "dataType": "BOD",
      "unit": "mg/L",
      "offset": 0
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "stationId": "STATION_001",
    "protocol": "MSSQL",
    "settings": {
      "hostIp": "192.168.1.254",
      "port": 1433,
      "dbUser": "sensor_user",
      "dbPass": "********",
      "dbName": "sensor_db"
    },
    "channels": [
      {
        "addressId": 40001,
        "dataType": "COD",
        "unit": "mg/L",
        "offset": -0.5
      }
    ],
    "createdBy": 42,
    "createdAt": "2026-05-27T13:21:00.000Z",
    "updatedAt": "2026-05-27T13:21:00.000Z"
  }
}
```

### 9.4 List and detail

```http
GET http://localhost:3000/api/v1/device-connections?stationId=STATION_001
```

```http
GET http://localhost:3000/api/v1/device-connections/:id
```

Response list:

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 0 }
}
```

## 10. Error cases ที่ frontend ควรรองรับ

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

## 10. Quick manual test

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

## 11. Backend smoke test

ถ้า frontend บอกว่าเรียก backend ไม่ได้ ให้เช็คฝั่ง backend ด้วย:

```bash
npm run test:api:local
```

ถ้าผ่าน `All 15 tests passed` แปลว่า backend พร้อมใช้งาน
