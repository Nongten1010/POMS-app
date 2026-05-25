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

Query filter:

| query | type | example |
| --- | --- | --- |
| `page` | number | optional; ถ้าไม่ส่ง `page/perPage` จะดึงทั้งหมด |
| `perPage` | number | optional; ถ้าส่ง max `100` |
| `search` | string | `เคมี` |
| `provinceName` | string | `ระยอง` |
| `operationStatus` | string | `แจ้งประกอบแล้ว` |
| `hasEia` | boolean string | ใช้กับ mock ได้; `fac_import` ยังไม่มี column EIA ที่ map ได้ชัดเจน |

Example:

```bash
curl "http://localhost:3000/api/v1/eligible-factories/candidates?provinceName=ระยอง&hasEia=true" \
  -H "Authorization: Bearer <accessToken>"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "sourceSystem": "diw.fac_import",
      "sourceFactoryId": "10100302325234",
      "factoryName": "ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง",
      "factoryRegistrationNoNew": "3-64(6)-45/17",
      "provinceName": "กรุงเทพมหานคร",
      "operationStatus": "แจ้งประกอบแล้ว",
      "hasEia": null
    }
  ],
  "meta": {
    "total": 2400,
    "source": "external"
  }
}
```

ถ้าต้องการ paginate ค่อยส่ง `page/perPage`:

```bash
curl "http://localhost:3000/api/v1/eligible-factories/candidates?page=1&perPage=25" \
  -H "Authorization: Bearer <accessToken>"
```

### 7.2 Save selected eligible factory

เมื่อผู้ใช้เลือก candidate แล้ว ให้ส่งข้อมูลโรงงานนั้นเข้า endpoint นี้ เพื่อบันทึก snapshot ลง DB เรา

```http
POST http://localhost:3000/api/v1/eligible-factories
Content-Type: application/json
Authorization: Bearer <accessToken>
```

Payload example:

```json
{
  "sourceSystem": "diw.fac_import",
  "sourceFactoryId": "10100302325234",
  "factoryName": "ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง",
  "factoryRegistrationNoNew": "3-64(6)-45/17",
  "factoryRegistrationNoOld": "08",
  "factoryTypeSequence": "31/12/2547",
  "address": "50/10-11-12 ซอยบรมบรรพต ถนนบริพัตร",
  "provinceName": "กรุงเทพมหานคร",
  "industrialEstateName": null,
  "coordinates": null,
  "businessActivity": "ทำผลิตภัณฑ์โลหะต่าง ๆ",
  "operationStatus": "แจ้งประกอบแล้ว",
  "capitalAmount": 1825000,
  "machineryHorsepower": 75,
  "productionCapacity": null,
  "wastewaterDischargeInfo": null,
  "boilerCount": null,
  "boilerSizeEach": null,
  "fuelUsed": null,
  "hasEia": null,
  "selectedReason": "เลือกจากรายการโรงงานเข้าข่าย"
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

### 7.3 List selected eligible factories

ใช้แสดงรายการที่เลือกเข้าข่ายแล้วจาก DB ของ POMS

```http
GET http://localhost:3000/api/v1/eligible-factories?page=1&perPage=25
```

Query filter:

| query | type | example |
| --- | --- | --- |
| `page` | number | `1` |
| `perPage` | number | `25`, max `100` |
| `search` | string | ชื่อโรงงานหรือเลขทะเบียน |
| `provinceName` | string | `ระยอง` |
| `operationStatus` | string | `แจ้งประกอบแล้ว` |
| `hasEia` | boolean string | `true` หรือ `false` |

## 8. Error cases ที่ frontend ควรรองรับ

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

## 9. Quick manual test

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

## 10. Backend smoke test

ถ้า frontend บอกว่าเรียก backend ไม่ได้ ให้เช็คฝั่ง backend ด้วย:

```bash
npm run test:api:local
```

ถ้าผ่าน `All 15 tests passed` แปลว่า backend พร้อมใช้งาน
