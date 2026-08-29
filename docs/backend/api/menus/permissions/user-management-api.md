# API จัดการผู้ใช้และสิทธิ์รายบัญชี

[กลับไปหน้าเมนูสิทธิ์การใช้งาน](./README.md)

เอกสารนี้อธิบายเฉพาะ 8 operations ที่มีจริงใน production ว่าต้องส่ง header, path, query และ JSON body อย่างไร รวม response, validation และ error ที่ client ต้องรองรับ ส่วน role catalog และ default permission matrix อยู่ใน [หน้าเมนูสิทธิ์การใช้งาน](./README.md#approved-role-catalog)

## Contracts

### กติกาการเรียก API ร่วม

[Production Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) และ [OpenAPI JSON](https://d-poms.diw.go.th/api/v1/openapi.json) ปัจจุบันมี endpoint ในหมวด “สิทธิ์การใช้งาน” 8 operations ตาม [Endpoint Summary](./README.md#endpoint-summary) เท่านั้น โดยทุก operation ใช้กติกาต่อไปนี้:

| รายการ | ค่าที่ต้องส่ง |
| --- | --- |
| Base URL | `https://d-poms.diw.go.th/api/v1` |
| Authentication | `Authorization: Bearer <ACCESS_TOKEN>` |
| Request body | ส่งเป็น JSON และใส่ `Content-Type: application/json` เฉพาะ `POST`, `PATCH`, `PUT` |
| User ID | `:id`/`{id}` ต้องเป็นจำนวนเต็มบวก เช่น `12` |
| Permission guard แบบ `any` | ถ้า endpoint ระบุสอง permission ผู้เรียกมีอย่างใดอย่างหนึ่งก็ผ่าน เช่น `users:view` **หรือ** `permissions:manage` |
| Unknown field | body แบบ create/update/replace ส่วนใหญ่ไม่รับ field นอก schema และตอบ `400 VALIDATION_ERROR` |

การให้สิทธิ์ default ทำงานดังนี้:

1. เมื่อสร้างหรือเปลี่ยน role ให้ส่ง role code เดียว ระบบอ่าน role grants จาก [Backend raw role / action / scope matrix](./README.md#backend-raw-role--action--scope-matrix) อัตโนมัติ ไม่ต้องส่ง default permission ซ้ำ
2. `permissionOverrides`/`permissions` เป็นส่วนต่างจาก role default เท่านั้น: `deny` ใช้ปิดสิทธิ์ และ `allow` ใช้คงสิทธิ์เดิมพร้อมลด scope ให้แคบลง
3. override ห้ามเพิ่ม permission ที่ role ไม่มี และห้ามขยาย scope ให้กว้างกว่า role
4. `PUT /users/:id/permissions` เป็น raw API ที่ **แทนที่ override ทั้งชุด**; ถ้าส่ง `[]` จะล้าง override และกลับไปใช้ role default ล้วน ส่วน grouped `permissions` ของ `PATCH /users/:id` แทนที่เฉพาะ editable actions และรักษา internal/hidden overrides เดิมไว้
5. เปลี่ยน role หรือ override แล้ว access token เดิมไม่เปลี่ยนย้อนหลัง ผู้ใช้ต้อง login/refresh token ใหม่ตาม auth flow เพื่อรับ effective permission ล่าสุด

Production ยังไม่มี `GET /roles`, `GET /permissions` หรือ endpoint สำหรับอ่าน role-default catalog โดยตรง ตาราง default ในหน้าเมนูหลักจึงอ้างอิง seed/runtime canonical และ response ของ user แต่ละคนต้องอ่านผ่าน `GET /users/:id` หรือ `GET /users/:id/permissions`

สำหรับ 8 operations ในหมวดนี้ route guard ใช้จริงเพียง `users:view`, `users:edit` และ `permissions:manage`; code อื่นใน default matrix เป็นสิทธิ์ของเมนูอื่นหรือสิทธิ์ระดับ UI และไม่ได้หมายความว่ามี endpoint จัดการ role/permission catalog เพิ่ม

สำหรับเมนูขอเชื่อมต่อ ให้ Frontend ใช้ [runtime connection permission contract](./README.md#runtime-connection-permission-contract): runtime auth response ใช้ `permissions.connection.*`; หน้า Permission Management ใช้เฉพาะ editable actions และ raw `cems_wpms_requests:*` ใช้เฉพาะ field `code` ของ override API

### Managed user list

#### `GET /api/v1/users`

- Permission: `users:view` **หรือ** `permissions:manage`
- Request body: ไม่มี

Query fields:

| Field | Type | Required | Default | Rules / Meaning |
| --- | --- | --- | --- | --- |
| `page` | integer | no | `1` เมื่อเปิด pagination | ค่าตั้งแต่ `1`; ถ้าส่ง `page` หรือ `perPage` อย่างน้อยหนึ่ง field ระบบเปิด pagination |
| `perPage` | integer | no | `25` เมื่อเปิด pagination | `1-100` |
| `search` | string | no | - | trim แล้วต้องยาว `1-128`; ค้น `username`, `externalId`, ชื่อ, นามสกุล หรือชื่อเต็ม |
| `roleCode` | string | no | - | role code ยาวไม่เกิน `32` ตัวอักษร |
| `status` | `active` \| `suspended` \| `all` | no | `all` | กรองสถานะบัญชี |

Request example:

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/users?page=1&perPage=25&roleCode=monitoring_5_centers&status=active' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

Response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "accountType": "poms",
      "identityProvider": "local",
      "username": "local_officer",
      "fullName": "สมชาย ทดสอบ",
      "department": "กองจัดการคุณภาพน้ำ",
      "lineNameTh": "นักวิทยาศาสตร์",
      "levelNameTh": "ชำนาญการ",
      "roles": "monitoring_5_centers",
      "roleCodes": ["monitoring_5_centers"],
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

ถ้าไม่ส่งทั้ง `page` และ `perPage` ระบบไม่จำกัดหน้ารายการ และ `meta` คืนเฉพาะ `total`

### Managed user detail

#### `GET /api/v1/users/:id`

- Permission: `users:view` **หรือ** `permissions:manage`
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: ไม่มี

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/users/12' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

Response นี้ใช้เติมหน้าแก้ไข โดยคืน grouped effective permissions หลังรวม role default และ per-user overrides แล้ว ทุก module/action ใน [editable contract](./README.md#permission-management-editable-contract) มีค่าครบเป็น boolean; scoped module มี `data`, `region`, `province` ส่วน binary module ไม่มี location fields:

```json
{
  "user": {
    "accountType": "poms",
    "identityProvider": "local",
    "userType": "officer",
    "username": "local_officer",
    "fullName": "สมชาย ทดสอบ",
    "department": "กองจัดการคุณภาพน้ำ",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "provinceName": null,
    "estateCode": null,
    "regionalAccess": { "regions": ["ภาคตะวันออก"] },
    "roles": "monitoring_5_centers",
    "roleCodes": ["monitoring_5_centers"],
    "isActive": true,
    "source": "created"
  },
  "permissions": {
    "dashboard": {
      "data": "IN_REGION",
      "region": "ภาคตะวันออก",
      "province": null,
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true,
      "export": true
    },
    "connection": {
      "data": "IN_REGION",
      "region": "ภาคตะวันออก",
      "province": null,
      "view": true,
      "edit": false,
      "approve": false
    },
    "helpdesk": {
      "view": true
    },
    "permissions": {
      "view": false
    }
  }
}
```

ตัวอย่างย่อแสดงบาง module เพื่อความกระชับ แต่ response จริงมีครบทุก module ใน editable matrix ข้อควรระวัง: endpoint นี้ไม่ได้ห่อผลลัพธ์ด้วย `{ "success": true, "data": ... }`; root ของ response คือ `user` และ `permissions`

### Permission override API

#### `GET /api/v1/users/:id/permissions`

- Permission: `permissions:manage` เท่านั้น
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: ไม่มี

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/users/12/permissions' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

Response fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `success` | boolean | สำเร็จเป็น `true` |
| `data.userId` | integer | user เป้าหมาย |
| `data.rolePermissions[]` | array | grants ที่มากับ role default โดยตรง |
| `data.rolePermissions[].code` | string | permission code |
| `data.rolePermissions[].scope` | scope \| `null` | scope สูงสุดที่ role ให้; `null` หมายถึง binary action |
| `data.overrides[]` | array | override ที่บันทึกใน `user_permissions` พร้อม `effect` และ location qualifier |
| `data.effectiveScopes` | object | map `permissionCode -> scope` หลังรวม role และ override |
| `data.permissions` | object | grouped effective permissions สำหรับ frontend |

#### `PUT /api/v1/users/:id/permissions`

- Permission: `permissions:manage` เท่านั้น
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: บังคับ และเป็นการแทนที่ override ทั้งชุด

Request fields:

| Field | Type | Required | Nullable | Rules / Meaning |
| --- | --- | --- | --- | --- |
| `permissions` | array<object> | yes | no | `0-200` รายการ; ห้าม `code` ซ้ำ; `[]` = ล้าง overrides ทั้งหมด |
| `permissions[].code` | string | yes | no | raw backend permission code ยาว `1-64` และต้องมีอยู่ในระบบ เช่น `cems_wpms_requests:view`; field นี้ไม่รับ `permissions.connection.view` |
| `permissions[].effect` | `allow` \| `deny` | yes | no | `allow` ใช้ลด/คงสิทธิ์; `deny` ใช้ปิดสิทธิ์ |
| `permissions[].scope` | scope | no | yes | `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, `FACTORY_TYPE_88`; ถ้า `allow` แล้วไม่ส่ง จะใช้ scope ของ role |
| `permissions[].region` | string | conditional | yes | ใช้เมื่อ `scope=IN_REGION`; ยาว `1-128` และต้องอยู่ใน profile assignment |
| `permissions[].province` | string | conditional | yes | ใช้เมื่อ `scope=IN_PROVINCE`; รับชื่อหรือรหัสจังหวัด ยาว `1-128` |
| `permissions[].estateCode` | string | conditional | yes | ใช้เมื่อ `scope=IN_ESTATE`; รหัสหรือชื่อที่ resolve กับ master ได้ ยาว `1-32` |
| `permissions[].estate` | string | no | yes | compatibility alias ของ `estateCode`; client ใหม่ควรส่ง `estateCode` |

Request example:

```bash
curl --request PUT \
  --url '<BASE_URL>/api/v1/users/12/permissions' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "permissions": [
      {
        "code": "dashboard.stats:export",
        "effect": "allow",
        "scope": "IN_REGION",
        "region": "ภาคตะวันออก"
      },
      {
        "code": "factories:edit",
        "effect": "deny"
      }
    ]
  }'
```

Response (`200 OK`) ของ `GET` และ `PUT` ใช้ shape เดียวกัน:

```json
{
  "success": true,
  "data": {
    "userId": 12,
    "rolePermissions": [
      {
        "code": "dashboard.stats:export",
        "resource": "dashboard.stats",
        "action": "export",
        "description": "ส่งออกข้อมูล",
        "scope": "IN_REGION",
        "region": null,
        "provinceId": null,
        "provinceName": null,
        "estateCode": null
      }
    ],
    "overrides": [
      {
        "code": "dashboard.stats:export",
        "resource": "dashboard.stats",
        "action": "export",
        "description": "ส่งออกข้อมูล",
        "scope": "IN_REGION",
        "region": "ภาคตะวันออก",
        "provinceId": null,
        "provinceName": null,
        "estateCode": null,
        "effect": "allow"
      },
      {
        "code": "factories:edit",
        "resource": "factories",
        "action": "edit",
        "description": "แก้ไขข้อมูลพื้นฐานโรงงาน",
        "scope": null,
        "region": null,
        "provinceId": null,
        "provinceName": null,
        "estateCode": null,
        "effect": "deny"
      }
    ],
    "effectiveScopes": {
      "dashboard.stats:export": "IN_REGION"
    },
    "permissions": {
      "dashboard": {
        "data": "IN_REGION",
        "region": "ภาคตะวันออก",
        "export": true
      }
    }
  }
}
```

Validation and limitation notes:

- `allow` ใช้ได้เฉพาะ code ที่ role มี และ scope ต้องเท่ากับหรือแคบกว่า role; การเพิ่ม action ใหม่หรือขยาย scope ตอบ `400 BAD_REQUEST`
- `deny` ไม่ต้องส่ง `scope`/location; backend normalize ค่าเหล่านี้เป็น `null`
- location ที่ไม่ส่งจะอิง profile assignment ไม่ได้หมายถึง scope ไม่จำกัด
- ถ้า profile assignment ที่จำเป็นหายหรือขัดกับ override ระบบต้อง fail closed และไม่คืนข้อมูลนอกขอบเขต
- `province` และ `estateCode` ต้อง resolve กับ master data ได้ มิฉะนั้นตอบ `400 BAD_REQUEST`

### Create local account

#### `POST /api/v1/users/local-accounts`

- Permission: `users:edit` **หรือ** `permissions:manage`
- ใช้สร้างบัญชี POMS local ที่ login ด้วย `username`/`password`
- Request body: บังคับ; รับ nested shape ของหน้า Permission Management (แนะนำ) และ legacy flat shape; ห้ามผสมสอง shape และไม่รับ field นอก schema

#### Shape A: nested page payload (แนะนำ)

| Field | Type | Required | Rules / Meaning |
| --- | --- | --- | --- |
| `user` | object | yes | ข้อมูลบัญชี local |
| `user.fullName` | string | yes | trim แล้ว `1-255` |
| `user.username` | string | yes | trim แล้ว `3-64`; ต้องไม่ซ้ำ |
| `user.password` | string | yes | `8-128`; backend hash ก่อนเก็บ |
| `user.department`, `user.lineNameTh`, `user.levelNameTh` | string | no | ค่าว่างถูก normalize เป็นไม่ส่ง |
| `user.roleCodes` | array<string> | yes | ต้องมี role code 1 ค่า |
| `user.userType` | `officer` \| `admin` | no | default `officer` |
| `user.isActive` | boolean | no | default `true` |
| `permissions` | object | no | grouped [editable permission matrix](./README.md#permission-management-editable-contract); default `{}` และแปลงเป็น per-user overrides |

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/users/local-accounts' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "user": {
      "fullName": "เจ้าหน้าที่ กกพ.",
      "username": "erc_officer",
      "password": "<STRONG_PASSWORD>",
      "department": "",
      "lineNameTh": "",
      "levelNameTh": "",
      "roleCodes": ["erc_office"],
      "userType": "officer",
      "isActive": true
    },
    "permissions": {}
  }'
```

#### Shape B: legacy flat payload

Request fields:

| Field | Type | Required | Nullable | Default / Rules |
| --- | --- | --- | --- | --- |
| `fullName` | string | yes | no | trim แล้ว `1-255` ตัวอักษร |
| `username` | string | yes | no | trim แล้ว `3-64`; ต้องไม่ซ้ำ |
| `password` | string | yes | no | `8-128` ตัวอักษร; backend hash ก่อนเก็บ |
| `department` | string | no | no | trim แล้ว `1-255`; ค่าว่างถูกถือว่าไม่ส่ง |
| `lineNameTh` | string | no | no | trim แล้ว `1-128` |
| `levelNameTh` | string | no | no | trim แล้ว `1-64` |
| `provinceId` | string | conditional | yes | รหัสจังหวัด `1-32`; ใช้กับ role `provincial_office` |
| `provinceName` | string | conditional | yes | ชื่อจังหวัด `1-128`; ใช้แทน `provinceId` ได้ |
| `estateCode` | string | conditional | yes | `1-32`; บังคับสำหรับ role `industrial_estate` |
| `regionName` | string | conditional | yes | `1-128`; ใช้กับ `monitoring_5_centers`/`center_director` |
| `regions` | array<string> | no | yes | compatibility form; ไม่เกิน 1 ค่า |
| `regionalAccess` | object | no | yes | รูปแบบ `{ "regions": ["<region>"] }` และต้องมี 1 ค่า |
| `roles` | string | yes | no | role code เดียวตาม [Approved role catalog](./README.md#approved-role-catalog); ไม่ใช่ array |
| `userType` | `officer` \| `admin` | no | no | default `officer` |
| `isActive` | boolean | no | no | default `true` |
| `permissionOverrides` | array<object> | no | no | ไม่เกิน 200; ใช้ field/rule แบบเดียวกับ `permissions[]` ของ PUT; ห้าม code ซ้ำ |

เลือก field พื้นที่ตาม role:

| Role | Assignment ที่ต้องส่ง |
| --- | --- |
| `monitoring_5_centers`, `center_director` | ส่งหนึ่งภาคผ่าน `regionName` หรือ `regionalAccess.regions[0]` |
| `monitoring_kpm`, `kpm_director` | ไม่ต้องส่งภาค; effective assignment ถูกกำหนดเป็น `ภาคกลาง` |
| `provincial_office` | ส่ง `provinceName` หรือ `provinceId` หนึ่งจังหวัด |
| `industrial_estate` | ส่ง `estateCode` หนึ่งนิคม |
| `erc_office` | ไม่ต้องส่ง location assignment; role default บังคับ `FACTORY_TYPE_88` |
| role อื่น | ไม่บังคับ location assignment จาก role |

Legacy request example:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/users/local-accounts' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "fullName": "สมชาย ทดสอบ",
    "username": "local_officer",
    "password": "<STRONG_PASSWORD>",
    "department": "ศูนย์เฝ้าระวังและควบคุมคุณภาพสิ่งแวดล้อม",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "regionName": "ภาคตะวันออก",
    "roles": "monitoring_5_centers",
    "userType": "officer",
    "isActive": true
  }'
```

ไม่ส่ง `permissionOverrides` ในตัวอย่าง เพราะ role defaults ถูกให้โดยอัตโนมัติ หากต้องการปิดเฉพาะ `factories:edit` จึงค่อยเพิ่ม:

```json
{
  "permissionOverrides": [
    { "code": "factories:edit", "effect": "deny" }
  ]
}
```

Response (`201 Created`) พร้อม `Location: /api/v1/users/<id>`:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "accountType": "poms",
    "identityProvider": "local",
    "username": "local_officer",
    "fullName": "สมชาย ทดสอบ",
    "department": "ศูนย์เฝ้าระวังและควบคุมคุณภาพสิ่งแวดล้อม",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "monitoring_5_centers",
    "roleCodes": ["monitoring_5_centers"],
    "isActive": true
  }
}
```

### Create managed user

#### `POST /api/v1/users`

- Permission: `users:edit` **หรือ** `permissions:manage`
- ใช้สร้าง managed officer/admin account โดย payload นี้ไม่มี `password` และไม่มี `permissionOverrides`
- Request body: บังคับ; ไม่รับ field นอก schema

Top-level request fields:

| Field | Type | Required | Nullable | Default / Rules |
| --- | --- | --- | --- | --- |
| `username` | string | yes | no | trim แล้ว `3-64`; ต้องไม่ซ้ำ |
| `externalId` | string | no | no | `1-32`; ถ้าส่งต้องเท่ากับ `username`; ถ้าไม่ส่งใช้ `username` |
| `userType` | `officer` \| `admin` | no | no | default `officer` |
| `prenameTh` | string | no | yes | ไม่เกิน `16` |
| `firstName` | string | yes | no | trim แล้ว `1-128` |
| `lastName` | string | yes | no | trim แล้ว `1-128` |
| `email` | string(email) | no | yes | ไม่เกิน `255` |
| `phone` | string | no | yes | ไม่เกิน `32` |
| `isActive` | boolean | no | no | default `true` |
| `roleCodes` | array<string> | yes | no | ต้องมี 1 ค่าเท่านั้น; code แต่ละค่ายาว `1-32` |
| `profile` | object | no | no | officer profile; ไม่รับ field นอก schema |

`profile` fields:

| Field | Type | Nullable | Rules / Meaning |
| --- | --- | --- | --- |
| `posNo` | string | yes | เลขที่ตำแหน่ง; `1-255` |
| `pertypeId`, `pertype` | string | yes | รหัส/ชื่อประเภทบุคลากร; `1-255` |
| `positionTypeId`, `positionTypeTh` | string | yes | รหัส/ชื่อตำแหน่ง; `1-255` |
| `lineId`, `lineNameTh` | string | yes | รหัส/ชื่อสายงาน; `1-255` |
| `levelId`, `levelNameTh` | string | yes | รหัส/ชื่อระดับ; `1-255` |
| `mpositionId`, `mposition` | string | yes | รหัส/ชื่อตำแหน่งบริหาร; `1-255` |
| `organizeId`, `divisionNameTh` | string | yes | รหัสหน่วยงาน/ชื่อกอง; `1-255` |
| `departmentId`, `ministryId` | string | yes | รหัสกรม/กระทรวง; `1-255` |
| `provinceId` | string | yes | รหัสจังหวัด; `1-255`; backend ตรวจ master data |
| `provinceName` | string | yes | ชื่อจังหวัด; `1-128`; ใช้ resolve เป็น `provinceId` |
| `estateCode` | string | yes | รหัสหรือชื่อที่ resolve เป็นรหัสนิคม; `1-32` |
| `perStatus`, `perStatusName` | string | yes | รหัส/ชื่อสถานะบุคลากร; `1-255` |
| `relocationType`, `relocationName` | string | yes | รหัส/ชื่อการย้าย; `1-255` |
| `regionalAccess` | object | yes | `{ "regions": ["<region>"] }`; เมื่อส่งต้องมี region 1 ค่า |

กติกา assignment ตาม role ใช้ตารางเดียวกับ [Create local account](#create-local-account)

Request example:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/users' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "username": "1234567890123",
    "externalId": "1234567890123",
    "userType": "officer",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "email": "officer@example.com",
    "phone": "0812345678",
    "isActive": true,
    "roleCodes": ["monitoring_5_centers"],
    "profile": {
      "lineNameTh": "นักวิทยาศาสตร์",
      "levelNameTh": "ชำนาญการ",
      "regionalAccess": {
        "regions": ["ภาคตะวันออก"]
      }
    }
  }'
```

Response (`201 Created`) คืน `Location: /api/v1/users/<id>` และ `ManagedUserDetail`:

```json
{
  "success": true,
  "data": {
    "id": 13,
    "accountType": "poms",
    "identityProvider": "local",
    "userType": "officer",
    "username": "1234567890123",
    "externalId": "1234567890123",
    "fullName": "สมชาย ใจดี",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "email": "officer@example.com",
    "phone": "0812345678",
    "roles": "monitoring_5_centers",
    "roleCodes": ["monitoring_5_centers"],
    "isActive": true,
    "profile": {
      "lineNameTh": "นักวิทยาศาสตร์",
      "levelNameTh": "ชำนาญการ",
      "regionalAccess": {
        "regions": ["ภาคตะวันออก"]
      }
    }
  }
}
```

`profile` จริงยังมี field บุคลากรตามตารางด้านบน โดย field ที่ยังไม่มีข้อมูลจะคืน `null`

### Update managed user

#### `PATCH /api/v1/users/:id`

- Permission: `users:edit` **หรือ** `permissions:manage`
- การแก้ `regionalAccess`, จังหวัด หรือนิคม ต้องมี `permissions:manage` เพิ่ม แม้ route guard จะผ่านด้วย `users:edit`
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: บังคับ และรับได้ 2 shapes; ห้ามผสมสอง shape ใน request เดียว

#### Shape A: edit-page payload (แนะนำ)

Top-level fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `user` | object | yes | ข้อมูลที่หน้าแก้ไขส่งกลับ |
| `permissions` | object | no | grouped editable matrix; ถ้าส่งจะแทนที่ editable overrides และรักษา internal/hidden overrides เดิมไว้ |

`user` fields:

| Field | Type | Required | Nullable | Rules / Meaning |
| --- | --- | --- | --- | --- |
| `fullName` | string | yes | no | `1-255` |
| `username` | string | yes | no | `3-64` |
| `isActive` | boolean | yes | no | เปิด/ระงับบัญชี |
| `roles` | string | conditional | no | role code เดียว; ต้องส่ง `roles` หรือ `roleCodes` อย่างใดอย่างหนึ่ง |
| `roleCodes` | array<string> | conditional | no | ต้องมี 1 ค่า; ใช้แทน `roles` ได้ |
| `password` | string | no | no | `8-128`; ค่าว่าง = ไม่เปลี่ยน; ใช้กับ local account เท่านั้น |
| `department` | string | no | no | `1-255`; ค่าว่าง = ไม่ส่ง |
| `lineNameTh` | string | no | no | `1-128` |
| `levelNameTh` | string | no | no | `1-64` |
| `provinceName` | string | no | yes | ชื่อ/รหัสจังหวัด; `null`, ค่าว่าง หรือ `all` ใช้ล้าง |
| `estateCode` | string | no | yes | รหัส/ชื่อนิคม; `null`, ค่าว่าง หรือ `all` ใช้ล้าง |
| `regionName` | string | no | yes | ชื่อภาค; `null`, ค่าว่าง หรือ `all` ใช้ล้าง |
| `regions` | array<string> | no | yes | compatibility form; ไม่เกิน 1 ค่า |
| `regionalAccess` | object | no | yes | `{ "regions": ["<region>"] }` หรือ `null` |
| `accountType` | `poms` \| `api` | no | no | ใช้บอกชนิดบัญชีใน edit response |
| `identityProvider` | string | no | no | `1-32`; field ประกอบจาก response |
| `source` | `api` \| `created` | no | no | ใช้บอกว่า profile มาจาก IdP หรือสร้างใน POMS |

แต่ละ module ใน `permissions` ใช้รูปแบบต่อไปนี้:

ชื่อ module ต้องตรง grouped response เช่น เมนูขอเชื่อมต่อใช้ `connection` ไม่ใช้ `cems_wpms_requests`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `data` | scope \| `null` | conditional | บังคับสำหรับ scoped module; ห้ามส่งใน `permissions`, `helpdesk`, `feedback`, `laws`, `faq`, `chat` |
| `region` | string | conditional | qualifier เมื่อ `data=IN_REGION` |
| `province` | string | conditional | qualifier เมื่อ `data=IN_PROVINCE` |
| `<action>` | boolean | no | `true` = allow ภายใน role; `false` = deny เช่น `view`, `edit`, `approve`, `export` |

Grouped permissions ไม่รับ `estateCode` หรือ `estate`; เมื่อ `data=IN_ESTATE` backend ใช้ estate assignment ระดับ user profile. `data` รองรับ `FACTORY_TYPE_88` ยกเว้น module `factories` ใน frontend. Binary modules ใช้ boolean action โดยตรงและ backend เก็บ raw action เป็น scope `null`. Module `chat` รับ action `edit` และ map ไป raw code `chat:answer`. Module `eligible_factories` รับ `view`, `edit`, `approve`; `approve` ใช้กับการเลือก monitoring-point form เป็นโรงงานที่เข้าข่าย. Module/action/field นอก editable matrix ตอบ `400 VALIDATION_ERROR`.

ตัวอย่างนี้คงสิทธิ์ dashboard ภายในภาคตะวันออก แต่ปิด export:

```bash
curl --request PATCH \
  --url '<BASE_URL>/api/v1/users/12' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "user": {
      "accountType": "poms",
      "fullName": "สมชาย แก้ไข",
      "username": "local_officer",
      "roles": "monitoring_5_centers",
      "isActive": true,
      "regionName": "ภาคตะวันออก",
      "source": "created"
    },
    "permissions": {
      "dashboard": {
        "data": "IN_REGION",
        "region": "ภาคตะวันออก",
        "view": true,
        "export": false
      }
    }
  }'
```

#### Shape B: legacy partial payload

ส่งอย่างน้อย 1 field และใช้ field เดียวกับ `POST /users` โดยทุก field เป็น optional พร้อม `password` เพิ่มเติม:

```json
{
  "isActive": false,
  "roleCodes": ["diw_central"],
  "profile": {
    "regionalAccess": null,
    "provinceName": null,
    "estateCode": null
  }
}
```

ข้อจำกัดร่วมของ PATCH:

- local/POMS account: ถ้าเปลี่ยน `username` ระบบทำให้ account key ตรงกัน; ถ้าส่งทั้ง `username` และ `externalId` ต้องเท่ากัน
- API/IdP account: เปลี่ยน `username`, `externalId`, ข้อมูลบุคลากร, email, phone หรือ password ไม่ได้; Shape A ส่งค่าเดิมของ `username`, `fullName`, `department`, `lineNameTh`, `levelNameTh` กลับมาได้และ backend จะไม่นำ provider-owned fields เหล่านี้ไปเขียนทับ
- เมื่อส่ง Shape A สำหรับ API/IdP account ให้ส่ง `source: "api"` หรือ `accountType: "api"` ตามค่าจาก `GET /users/:id` เพื่อให้ backend แยก provider-owned fields ออกจาก authorization assignment ถูกต้อง
- API/IdP account ยังแก้ role, `isActive` และ authorization assignment (`regionalAccess`, จังหวัด, นิคม) ได้เมื่อผู้เรียกมีสิทธิ์ครบ
- เปลี่ยน role แล้วต้องมี assignment ที่ role ใหม่บังคับ มิฉะนั้นตอบ `400 BAD_REQUEST`
- ถ้าส่ง `permissions` backend แปลง grouped booleans เป็น override และแทนที่เฉพาะ editable overrides; internal/hidden overrides เช่น `cems_wpms_requests:direct_connect`, `statistics:export`, `permissions:manage` ถูกเก็บไว้หากยังใช้ได้กับ role ใหม่ ถ้าไม่ต้องการเปลี่ยน editable overrides ให้ละ field นี้

Response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 12,
    "accountType": "poms",
    "identityProvider": "local",
    "username": "local_officer",
    "fullName": "สมชาย แก้ไข",
    "roles": "monitoring_5_centers",
    "roleCodes": ["monitoring_5_centers"],
    "isActive": true,
    "profile": {
      "provinceName": null,
      "estateCode": null,
      "regionalAccess": {
        "regions": ["ภาคตะวันออก"]
      }
    }
  }
}
```

response ของ PATCH คืนข้อมูลผู้ใช้ที่บันทึกแล้ว แต่ไม่คืน effective permissions; ถ้าต้อง refresh checkbox/scope หลังบันทึก ให้เรียก `GET /users/:id` หรือ `GET /users/:id/permissions` ต่อ

### Delete managed user

#### `DELETE /api/v1/users/:id`

- Permission: `users:edit` **หรือ** `permissions:manage`
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: ไม่มี

```bash
curl --request DELETE \
  --url '<BASE_URL>/api/v1/users/12' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

- สำเร็จตอบ `204 No Content` โดยไม่มี response body
- user ลบตัวเองไม่ได้; ตอบ `403 FORBIDDEN`
- backend ทำ soft delete โดยตั้งบัญชี inactive และไม่คืนผู้ใช้นั้นในรายการปกติ

### Authentication, authorization, and error behavior

ทุก endpoint ในเมนูนี้ใช้ `authenticate` ก่อน `authorize`

| HTTP status | Code | เมื่อไรเกิด | Notes |
| --- | --- | --- | --- |
| `401` | `UNAUTHORIZED` | ไม่มี Bearer token, token หมดอายุ, token ตรวจไม่ผ่าน | client ควร login ใหม่ |
| `403` | `FORBIDDEN` | token ผ่านแต่ไม่มี permission ตาม route guard | route บางตัวเปิดด้วย `users:view` หรือ `permissions:manage`; `GET/PUT /:id/permissions` ต้องมี `permissions:manage` เสมอ |
| `404` | `NOT_FOUND` | ไม่พบ user ตาม `:id` หรือ resource ถูกลบแล้ว | ใช้กับ `GET`, `PATCH`, `DELETE`, `GET/PUT permissions` |
| `400` | `BAD_REQUEST` / validation error | payload หรือ query ไม่ผ่าน schema | duplicate permission code และ scope/location ผิดรูปแบบอยู่ในกลุ่มนี้ |
| `409` | `CONFLICT` | identity ซ้ำ เช่น `username` หรือ account key ซ้ำ | พบได้ตอนสร้าง/แก้บางกรณี |

ตัวอย่าง validation error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "issues": [
      {
        "path": ["roleCodes"],
        "pathString": "roleCodes",
        "message": "Array must contain exactly 1 element(s)"
      }
    ]
  }
}
```

Route-specific notes:

- `GET /api/v1/users/:id/permissions` และ `PUT /api/v1/users/:id/permissions` ไม่ fallback เป็น `users:view`; ถ้าไม่มี `permissions:manage` จะตอบ `403`
- `PATCH /api/v1/users/:id` ถ้าพยายามแก้ region, province หรือ estate assignment โดยไม่มี `permissions:manage` จะตอบ `403`
- `DELETE /api/v1/users/:id` ถ้า `:id` ตรงกับผู้ใช้ที่ login อยู่จะตอบ `403`


## Backend Maintainer Links

- Route: [backend/src/modules/users/users.routes.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.routes.ts:1)
- Validator: [backend/src/modules/users/users.validator.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.validator.ts:1)
- Controller: [backend/src/modules/users/users.controller.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.controller.ts:1)
- Service: [backend/src/modules/users/users.service.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.service.ts:1)
- Types: [backend/src/modules/users/users.types.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.types.ts:1)
- Runtime OpenAPI: [backend/src/modules/api-docs/poms.openapi.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/api-docs/poms.openapi.ts:1)
