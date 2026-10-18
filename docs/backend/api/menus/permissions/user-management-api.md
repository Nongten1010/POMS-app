# API จัดการผู้ใช้และสิทธิ์รายบัญชี

[กลับไปหน้าเมนูสิทธิ์การใช้งาน](./README.md)

เอกสารนี้อธิบาย 8 operations สำหรับการจัดการผู้ใช้และสิทธิ์ ว่าต้องส่ง header, path, query และ JSON body อย่างไร รวม response, validation และ error ที่ client ต้องรองรับ ส่วน role catalog และ default permission matrix อยู่ใน [หน้าเมนูสิทธิ์การใช้งาน](./README.md#approved-role-catalog)

## Contracts

### กติกาการเรียก API ร่วม

Runtime OpenAPI source อธิบาย endpoint ในหมวด “สิทธิ์การใช้งาน” 8 operations ตาม [Endpoint Summary](./README.md#endpoint-summary) หลังนำรุ่นนี้ขึ้นระบบ ต้องตรวจ [Production Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) และ [OpenAPI JSON](https://d-poms.diw.go.th/api/v1/openapi.json) ว่าตรงกับ contract นี้ โดยทุก operation ใช้กติกาต่อไปนี้:

| รายการ | ค่าที่ต้องส่ง |
| --- | --- |
| Base URL | `https://d-poms.diw.go.th/api/v1` |
| Authentication | `Authorization: Bearer <ACCESS_TOKEN>` |
| Request body | ส่งเป็น JSON และใส่ `Content-Type: application/json` เฉพาะ `POST`, `PATCH`, `PUT` |
| User ID | `:id`/`{id}` ต้องเป็นจำนวนเต็มบวก เช่น `12` |
| Permission guard แบบ `any` | ถ้า endpoint ระบุสอง permission ผู้เรียกมีอย่างใดอย่างหนึ่งก็ผ่าน เช่น `users:view` **หรือ** `permissions:manage` |
| Unknown field | body แบบ create/update/replace ส่วนใหญ่ไม่รับ field นอก schema และตอบ `400 VALIDATION_ERROR` |

การเลือกสิทธิ์ที่มีผลทำงานดังนี้:

1. บัญชีที่มี `permissionMode: "role_default"` อ่าน role grants จาก [Backend raw role / action / scope matrix](./README.md#backend-raw-role--action--scope-matrix) อัตโนมัติ ไม่ต้องส่ง default permission ซ้ำ
2. การส่ง `permissionOverrides`/`permissions` อย่างชัดเจนเมื่อสร้าง local account หรือบันทึกสิทธิ์ภายหลัง เปลี่ยนบัญชีเป็น `custom`; `allow` ให้สิทธิ์และ `deny` ปิดสิทธิ์ โดยใช้ snapshot ทั้งชุด ไม่เติม action ที่ละไว้จาก role
3. ผู้มี `permissions:manage` ให้ permission นอก role หรือเลือก scope กว้างกว่า role ได้ Backend ยังตรวจ code, scope, master location และขอบเขตข้อมูลจริง
4. `PUT /users/:id/permissions` **แทนที่สิทธิ์ทั้งชุด** รวม internal actions; `[]` หมายถึง `custom` ที่ไม่มีสิทธิ์ ส่วน PATCH ทั้ง grouped `permissions` และ legacy raw `permissionOverrides` กำหนด editable permissions ทั้งชุดและเก็บ internal/hidden grants เดิมที่ไม่ได้ส่งไว้ใน snapshot Raw PATCH ใช้ scope ที่ระบุใน request; กฎรักษา scope เดิมที่แคบกว่ามีเฉพาะ grouped PATCH เมื่อขอบเขตเมนูไม่เปลี่ยน
5. การเปลี่ยน role อย่างเดียวคง custom snapshot เดิม; คืนค่า role defaults ด้วย PATCH `{ "permissionMode": "role_default" }` โดยไม่ส่ง `permissions`
6. Backend อ่านสิทธิ์ล่าสุดทุก authenticated request; token เดิมใช้สิทธิ์ที่เพิ่มหรือถอนตั้งแต่คำขอถัดไป Client อ่าน `/auth/me` เพื่อปรับเมนูและปุ่มได้โดยไม่ต้อง login ใหม่

บัญชี managed officer/admin ที่มี `user_permissions` บันทึกไว้ก่อนขึ้นรุ่นนี้จะย้ายเป็น `custom` ด้วย migration `0136_add_user_permission_mode` โดยใช้สิทธิ์และพื้นที่ที่บันทึกไว้เหนือ role รวม action/scope ที่ role เดิมไม่อนุญาต `deny` ยังคงปิดสิทธิ์ ส่วน code ที่ไม่มีรายการบันทึกใช้ role default ตอนย้ายเพื่อให้ snapshot ครบ เมื่อย้ายแล้วไม่เติมสิทธิ์จาก role อีก ผู้ที่บันทึกสิทธิ์ไว้แล้วไม่ต้องกำหนดใหม่; หากคำขอเดิมถูกปฏิเสธก่อนบันทึก migration ไม่มีค่าใหม่ให้กู้คืน ดู [รายละเอียดการย้าย](./README.md#migration-and-client-impact)

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
      "permissionMode": "role_default",
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

Response นี้ใช้เติมหน้าแก้ไข โดยคืน `user.permissionMode` และ grouped effective permissions ตามโหมดปัจจุบัน ทุก module/action ใน [editable contract](./README.md#permission-management-editable-contract) มีค่าครบเป็น boolean; scoped module มี `data`, `region`, `province` และคืน `estateCode` เมื่อนิคมเป็น `IN_ESTATE` ส่วน binary module ไม่มี location fields:

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
    "permissionMode": "role_default",
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
| `data.permissionMode` | `role_default` \| `custom` | แหล่งสิทธิ์ที่ใช้จริง |
| `data.rolePermissions[]` | array | grants ที่มากับ role default โดยตรง |
| `data.rolePermissions[].code` | string | permission code |
| `data.rolePermissions[].scope` | scope \| `null` | scope เริ่มต้นของ role เพื่ออ้างอิง ไม่ใช่เพดานของ custom; `null` หมายถึง binary action |
| `data.overrides[]` | array | สิทธิ์ที่บันทึกใน `user_permissions` พร้อม `effect` และ location qualifier; custom ใช้เป็น snapshot ทั้งชุด |
| `data.effectiveScopes` | object | map `permissionCode -> scope` ที่ใช้จริงตามโหมด |
| `data.permissions` | object | grouped effective permissions สำหรับ frontend |

#### `PUT /api/v1/users/:id/permissions`

- Permission: `permissions:manage` เท่านั้น
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: บังคับ และเป็นการแทนที่สิทธิ์ custom ทั้งชุด

Request fields:

| Field | Type | Required | Nullable | Rules / Meaning |
| --- | --- | --- | --- | --- |
| `permissions` | array<object> | yes | no | `0-200` รายการ; ห้าม `code` ซ้ำ; `[]` = custom ไม่มีสิทธิ์ ไม่ใช่คืนค่า role defaults |
| `permissions[].code` | string | yes | no | raw backend permission code ยาว `1-64` และต้องมีอยู่ในระบบ เช่น `cems_wpms_requests:view`; field นี้ไม่รับ `permissions.connection.view` |
| `permissions[].effect` | `allow` \| `deny` | yes | no | `allow` ให้สิทธิ์แม้ role ไม่มี; `deny` ปิดสิทธิ์ |
| `permissions[].scope` | scope | conditional | ตาม code/effect | `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, `FACTORY_TYPE_88`; data-scoped `allow` ห้ามส่ง `null` แม้ code อยู่ใน role (`400 BAD_REQUEST`); ละ field ใช้ role scope ครั้งเดียวตอนบันทึก โดย edit/approve ที่ default เป็น null ใช้ role view scope ของ resource เดียวกัน ถ้าไม่มีตอบ `400`; code นอก role ต้องส่ง scope; binary code หรือ deny ใช้ `null` ได้ |
| `permissions[].region` | string | conditional | yes | ใช้เมื่อ `scope=IN_REGION`; ยาว `1-128`; ภาคเมนูมีผลก่อนภาคเริ่มต้นจากโปรไฟล์และไม่ต้องตรงกัน |
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
    "permissionMode": "custom",
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

- `allow` ใช้ code ที่ backend รองรับโดยไม่จำกัดด้วย role และให้ scope กว้างกว่า role ได้; data-scoped code ต้องมี scope ที่ใช้ได้ การส่ง `scope: null` อย่างชัดเจนตอบ `400 BAD_REQUEST` แม้ code อยู่ใน role ส่วนการละ field ให้คัดลอก role scope ครั้งเดียวตอนบันทึก และ edit/approve ที่ default เป็น null ใช้ role view scope ของ resource เดียวกัน ถ้าไม่มี scope ให้คัดลอกตอบ `400 BAD_REQUEST`
- `deny` ไม่ต้องส่ง `scope`/location; backend normalize ค่าเหล่านี้เป็น `null`
- location ที่ไม่ส่งจะอิง profile assignment ตอนบันทึก ไม่ได้หมายถึง scope ไม่จำกัด; `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE` ที่ยังไม่มี qualifier ใช้ได้หลังเติม defaults และ resolve master ตอบ `400 BAD_REQUEST` ไม่บันทึก snapshot ที่ใช้ไม่ได้
- พื้นที่ override ที่ระบุมีผลก่อน profile assignment; ถ้าไม่ระบุทั้งสองแหล่ง ระบบต้อง fail closed และไม่คืนข้อมูล ดู [กติกาพื้นที่รายเมนู](./README.md#region-and-location-rules)
- `province` และ `estateCode` ต้อง resolve กับ master data ได้ มิฉะนั้นตอบ `400 BAD_REQUEST`
- ตัวอย่าง raw PUT ข้างบนให้สิทธิ์ export เพียงรายการเดียว ส่วน grants ของ role อื่นไม่ถูกนำมาเติม หากต้องการคงสิทธิ์อื่น ต้องส่ง `allow` ของสิทธิ์นั้นพร้อมกัน

### Scope ที่เป็น null ในข้อมูลเดิม

การบันทึก custom ใหม่ต้องใช้ data scope ที่ใช้ได้ตามตารางข้างต้น ส่วนรายการเดิมที่เก็บ scope เป็น `null` หรือไม่ได้ระบุ ใช้กติกาต่อไปนี้เมื่อคำนวณสิทธิ์:

- Binary codes เช่น `permissions:manage`, `users:edit` และ `feedback:submit` ใช้ `null` ได้ตามเดิม
- เฉพาะ data-scoped `edit` หรือ `approve` ใช้ scope และ qualifiers ทั้งชุดจาก saved `view` ของ resource เดียวกัน เมื่อ view ยังอนุญาตและ scope ถูกต้อง ไม่อ่าน role หรือ profile มาเติมตอน runtime
- หาก saved view ไม่มี ถูก deny หรือ scope/qualifier ใช้ไม่ได้ ให้ปิด edit/approve ที่รอรับ scope นั้น โดยไม่ขึ้นกับลำดับแถวที่อ่าน
- Data-scoped `view`, `search`, `export` หรือ `direct_connect` ที่ scope เป็น null/ไม่ถูกต้องไม่ให้สิทธิ์ และ `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE` ต้องมี region, province หรือ estateCode/estate ที่บันทึกไว้ตามมิติ ค่าเว้นวรรคและ `all` ไม่ใช้เป็น qualifier
- Action ที่มี scope และ qualifier ที่ใช้ได้บันทึกชัดเจนยังคงใช้ scope ของตัวเอง สิทธิ์ default ของ role ไม่เติมเข้า custom snapshot

### Create local account

#### `POST /api/v1/users/local-accounts`

การสร้างบัญชีโดยส่ง `permissionOverrides` หรือ grouped `permissions` อย่างชัดเจน รวม `[]`/`{}` ต้องมี `permissions:manage` เพิ่มจาก `users:edit` และบัญชีจะเป็น `custom` บัญชีที่ละ field นี้ใช้ `role_default` และสิทธิ์สร้างบัญชีเดิมได้

- Permission: `users:edit` **หรือ** `permissions:manage`
- ใช้สร้างบัญชี POMS local ที่ login ด้วย `username`/`password`
- `username` ต้องไม่ซ้ำภายใน provider `local` รวมบัญชีที่ถูก soft-delete แล้ว; ชื่อเดิมยังถูกสงวนไว้ ตอบ `409 CONFLICT` และให้ใช้ชื่อใหม่ ไม่คืนชีพหรือเปลี่ยนรหัสผ่าน/สิทธิ์ของบัญชีเดิม
- Request body: บังคับ; รับ nested shape ของหน้า Permission Management (แนะนำ) และ legacy flat shape; ห้ามผสมสอง shape และไม่รับ field นอก schema

#### Shape A: nested page payload (แนะนำ)

| Field | Type | Required | Rules / Meaning |
| --- | --- | --- | --- |
| `user` | object | yes | ข้อมูลบัญชี local |
| `user.fullName` | string | yes | trim แล้ว `1-255` |
| `user.username` | string | yes | trim แล้ว `3-64`; ไม่ซ้ำกับบัญชี local ที่ยังไม่ถูก soft-delete |
| `user.password` | string | yes | `8-128`; backend hash ก่อนเก็บ |
| `user.department`, `user.lineNameTh`, `user.levelNameTh` | string | no | ค่าว่างถูก normalize เป็นไม่ส่ง |
| `user.roleCodes` | array<string> | yes | ต้องมี role code 1 ค่า |
| `user.userType` | `officer` \| `admin` | no | default `officer` |
| `user.isActive` | boolean | no | default `true` |
| `permissions` | object | no | grouped [editable permission matrix](./README.md#permission-management-editable-contract); ละ field = role defaults; ส่ง `{}` = custom ไม่มีสิทธิ์ทั้ง editable และ internal actions สำหรับบัญชีใหม่ |

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
    }
  }'
```

#### Shape B: legacy flat payload

Request fields:

| Field | Type | Required | Nullable | Default / Rules |
| --- | --- | --- | --- | --- |
| `fullName` | string | yes | no | trim แล้ว `1-255` ตัวอักษร |
| `username` | string | yes | no | trim แล้ว `3-64`; ไม่ซ้ำกับบัญชี local ที่ยังไม่ถูก soft-delete |
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

ไม่ส่ง `permissionOverrides` ในตัวอย่าง เพราะ role defaults ถูกให้โดยอัตโนมัติ หากต้องการ custom ให้ส่ง grants ทั้งชุด ตัวอย่างต่อไปนี้ให้ดู dashboard ในภาคตะวันออกและปิด `factories:edit`; ไม่รับสิทธิ์อื่นเพิ่มจาก role:

```json
{
  "permissionOverrides": [
    { "code": "dashboard:view", "effect": "allow", "scope": "IN_REGION", "region": "ภาคตะวันออก" },
    { "code": "factories:edit", "effect": "deny" }
  ]
}
```

Response (`201 Created`) พร้อม `Location: /api/v1/users/<id>`:

การใช้ชื่อเดิมหลังลบบัญชีตอบ `201 Created` เหมือนการสร้างปกติ โดย `data.id` และ `Location` เป็น user ID ใหม่ ผู้ใช้ login ด้วยรหัสผ่านที่ส่งในคำขอใหม่นี้ ไม่ใช้รหัสผ่านของบัญชีที่ลบแล้ว

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
    "permissionMode": "role_default",
    "isActive": true
  }
}
```

### Create managed user

#### `POST /api/v1/users`

- Permission: `users:edit` **หรือ** `permissions:manage`
- ใช้สร้าง managed officer/admin account โดย payload นี้ไม่มี `password` และไม่มี `permissionOverrides`
- สร้างบัญชีใน provider `local` ด้วย user ID ใหม่ จึงใช้ username ของบัญชีที่ soft-delete แล้วได้โดยไม่รับสิทธิ์หรือประวัติเดิม; บัญชีที่ยังไม่ถูกลบรวม inactive/suspended ยังสงวนชื่อและตอบ `409 CONFLICT`
- Request body: บังคับ; ไม่รับ field นอก schema

Top-level request fields:

| Field | Type | Required | Nullable | Default / Rules |
| --- | --- | --- | --- | --- |
| `username` | string | yes | no | trim แล้ว `3-64`; ไม่ซ้ำกับบัญชี local ที่ยังไม่ถูก soft-delete |
| `externalId` | string | no | no | `1-32`; ถ้าส่งต้องเท่ากับ `username`; ถ้าไม่ส่งใช้ `username` |
| `userType` | `officer` \| `admin` | no | no | default `officer` |
| `prenameTh` | string | no | yes | trim แล้ว `1-64` ตัวอักษร; `null` ใช้ล้างคำนำหน้า |
| `firstName` | string | yes | no | trim แล้ว `1-128` |
| `lastName` | string | yes | no | trim แล้ว `1-128` |
| `email` | string(email) | no | yes | ไม่เกิน `255` |
| `phone` | string | no | yes | ไม่เกิน `32` |
| `isActive` | boolean | no | no | default `true` |
| `roleCodes` | array<string> | yes | no | ต้องมี 1 ค่าเท่านั้น; code แต่ละค่ายาว `1-32` |
| `profile` | object | no | no | officer profile; ไม่รับ field นอก schema |

`prenameTh` รองรับคำนำหน้าบุคลากรภาษาไทยแบบยาว เช่น `ผู้ช่วยศาสตราจารย์ ดร.` โดยเก็บและคืนค่าครบตามขีดจำกัด 64 ตัวอักษร ขีดจำกัดเดียวกันใช้กับข้อมูลเจ้าหน้าที่จาก external identity provider ที่ sync ระหว่าง [login](../../shared/authentication/README.md)

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
    "permissionMode": "role_default",
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
- การแก้ `regionalAccess`, จังหวัด หรือนิคม และการส่ง `permissions`/`permissionOverrides`/top-level `permissionMode` ต้องมี `permissions:manage` เพิ่ม แม้ route guard จะผ่านด้วย `users:edit`
- Path: `id` เป็นจำนวนเต็มบวก
- Request body: บังคับ และรับได้ 2 shapes; ห้ามผสมสอง shape ใน request เดียว

#### Shape A: edit-page payload (แนะนำ)

Top-level fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `user` | object | yes | ข้อมูลที่หน้าแก้ไขส่งกลับ |
| `permissions` | object | no | grouped editable matrix ทั้งชุด; เปลี่ยนเป็น custom, ปิด actions ที่ละไว้ และเก็บ internal/hidden effective grants เดิมไว้ |
| `permissionMode` | `role_default` \| `custom` | no | root field: `role_default` คืนค่าเริ่มต้นและห้ามส่งพร้อม permissions; `custom` ต้องส่ง permissions ด้วย |

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
| `permissionMode` | `role_default` \| `custom` | no | no | metadata จาก GET ที่ส่งกลับได้ ไม่มีผลเปลี่ยนโหมด; ใช้ root field เพื่อสั่ง reset |

แต่ละ module ใน `permissions` ใช้รูปแบบต่อไปนี้:

ชื่อ module ต้องตรง grouped response เช่น เมนูขอเชื่อมต่อใช้ `connection` ไม่ใช้ `cems_wpms_requests`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `data` | scope \| `null` | conditional | บังคับสำหรับ scoped module รวม `chat`; ห้ามส่งใน `permissions`, `helpdesk`, `feedback`, `laws`, `faq` |
| `region` | string | conditional | qualifier เมื่อ `data=IN_REGION` |
| `province` | string | conditional | qualifier เมื่อ `data=IN_PROVINCE` |
| `estateCode` | string \| `null` | no | qualifier ของหนึ่งนิคมเมื่อ `data=IN_ESTATE`; มีผลก่อนนิคมโปรไฟล์ รับรหัส/ชื่อที่ resolve กับ master ได้ `1-32` |
| `estate` | string \| `null` | no | compatibility alias ของ `estateCode`; client ใหม่ใช้ `estateCode` |
| `<action>` | boolean | no | `true` = allow แม้ role ไม่มี; `false` หรือ action ที่ละไว้ = ปิด เช่น `view`, `edit`, `approve`, `export` |

Grouped permissions รับ `estateCode` หรือ `estate` เมื่อ `data=IN_ESTATE` สำหรับนิคมหนึ่งแห่ง; ถ้าไม่ส่งใช้ estate assignment ระดับ user profile การคืน `estateCode` ใน grouped response ทำให้ส่งสิทธิ์กลับได้โดยไม่ทำ qualifier รายเมนูหาย `data` รองรับ `FACTORY_TYPE_88` ยกเว้น module `factories` ใน frontend. Binary modules ใช้ boolean action โดยตรงและ backend เก็บ raw action เป็น scope `null`. Module `chat` เป็น scoped module รับ `view`, `ask`, `edit` พร้อม `data`, `region`, `province`; `edit` map ไป raw code `chat:answer` และไม่รับ request alias `answer`. Module `eligible_factories` รับ `view`, `edit`, `approve`; `approve` ใช้กับการเลือก monitoring-point form เป็นโรงงานที่เข้าข่าย. Module/action/field นอก editable matrix ตอบ `400 VALIDATION_ERROR`.

Chat ใช้ scope รายเมนูอิสระจาก `eligible_factories:view` ตัวอย่างส่วนหนึ่งของ grouped permissions คือ `{"chat":{"data":"IN_REGION","region":"ภาคตะวันออก","view":true,"ask":true,"edit":false}}` ผู้มีเพียง `view` อ่านได้อย่างเดียว ผู้มี `ask` ที่เป็น `operator`/`officer`/`admin` เปิดเรื่องและติดตามหรือปิดเรื่องที่ตนเปิดได้ ผู้มี `edit` ตอบหรือปิดเรื่องในขอบเขตที่มองเห็นได้ ทุกการเขียนตรวจทั้ง scope อ่านและ action; ดู [Chat](../chat/README.md#chat-scoped-actions) ต้องเติม `data` ให้ payload Chat แบบ binary เดิม มิฉะนั้นตอบ `400 VALIDATION_ERROR` และเรียก `GET /users/:id` หลังบันทึกเพื่อรับ matrix ปัจจุบัน

Grouped `data` เป็นค่ารวมสำหรับแสดงเมนูและอาจกว้างกว่า scope บาง action เช่น `view=ALL`, `edit=IN_PROVINCE` การบันทึก grouped matrix ที่ไม่เปลี่ยนขอบเขตเมนูคง scope และ qualifier ราย action ที่แคบกว่าไว้ ไม่ขยายสิทธิ์นั้นด้วยค่ารวม ถ้าต้องการแก้ scope แยกราย action ให้อ่าน `data.overrides[]` ผ่าน raw GET แล้วส่ง raw PUT ทั้งชุดพร้อม scope ที่ตั้งใจให้แต่ละ code โดย PUT เป็น explicit replacement และไม่รักษา scope ที่ละไว้

ตัวอย่างนี้บันทึก editable matrix ใหม่ ให้ดู dashboard ในภาคตะวันออกและปิด export; editable actions ที่ละไว้จะปิด ส่วน internal grants ที่มีผลเดิมจะคงอยู่:

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

สำหรับ local/POMS account ค่า `prenameTh` ใช้กติกาเดียวกับการสร้าง: trim แล้วต้องยาว `1-64` ตัวอักษร หรือส่ง `null` เพื่อล้างคำนำหน้า; ถ้าเกิน 64 ตัวอักษรจะตอบ `400 VALIDATION_ERROR`

ส่งอย่างน้อย 1 field และใช้ field เดียวกับ `POST /users` โดยทุก field เป็น optional พร้อม fields เพิ่มเติม:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `password` | string | no | `8-128`; ใช้เปลี่ยนรหัสผ่าน local account |
| `permissionMode` | `role_default` \| `custom` | no | `role_default` reset และห้ามส่งสิทธิ์พร้อมกัน; `custom` ต้องส่ง `permissionOverrides` ใน shape นี้ |
| `permissionOverrides` | array<object> | no | `0-200` รายการตาม field/rules ของ raw PUT; code ห้ามซ้ำ; แทนที่ editable permissions ทั้งชุดและคง internal grants เดิมที่ไม่ได้ส่ง; `[]` ปิด editable actions |

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

ตัวอย่าง raw PATCH กำหนด scope ราย action: ดูโรงงานได้ทั้งหมดและแก้เฉพาะระยอง ผู้เรียกต้องมี `permissions:manage` สิทธิ์ editable อื่นที่ละไว้จะปิด ส่วน internal grants ที่ไม่ได้ส่งคงเดิม:

```json
{
  "permissionMode": "custom",
  "permissionOverrides": [
    { "code": "factories:view", "effect": "allow", "scope": "ALL" },
    { "code": "factories:edit", "effect": "allow", "scope": "IN_PROVINCE", "province": "ระยอง" }
  ]
}
```

Raw PATCH ใช้ scope/location ที่ส่งอย่างชัดเจนตาม request จึงขยาย scope ได้โดยไม่ใช้การคง scope ที่แคบกว่าของ grouped UI การส่ง `scope: null` ของ data-scoped allow ตอบ `400 BAD_REQUEST`; ถ้าละ scope ของ code ที่ role มีอยู่ backend เติม role default ครั้งเดียวตอนบันทึก โดย edit/approve ที่ default เป็น null ใช้ role view scope ของ resource เดียวกัน ถ้าไม่มี scope ที่ใช้ได้ตอบ `400` แล้วจึง resolve province/estate และเติม location fallback `PUT /users/:id/permissions` ต่างกันตรงที่แทนที่ทุก code รวม internal actions และไม่คง grants เดิมที่ไม่ได้ส่ง

#### คืนค่าเริ่มต้นตาม role

ทั้งสอง shapes รับ top-level `permissionMode: "role_default"` แต่การ reset อย่างเดียวใช้ legacy partial payload นี้ได้ ต้องมี `permissions:manage` และห้ามส่ง `permissions` หรือ `permissionOverrides` พร้อมกัน:

```bash
curl --request PATCH \
  --url '<BASE_URL>/api/v1/users/12' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{ "permissionMode": "role_default" }'
```

สำเร็จตอบ user ใน envelope เดิมพร้อม `data.permissionMode: "role_default"`; ระบบล้าง custom snapshot และใช้ role ปัจจุบัน การส่ง `permissionMode: "custom"` ต้องส่ง `permissions` ใน nested shape หรือ `permissionOverrides` ใน legacy shape มิฉะนั้นตอบ `400 VALIDATION_ERROR` การส่งสิทธิ์อย่างชัดเจนโดยละโหมดถือเป็น custom แม้ metadata `user.permissionMode` ที่ echo กลับมายังเป็น `role_default`

ข้อจำกัดร่วมของ PATCH:

- local/POMS account: ถ้าเปลี่ยน `username` ระบบทำให้ account key ตรงกัน; ถ้าส่งทั้ง `username` และ `externalId` ต้องเท่ากัน
- เปลี่ยน username ของ local/POMS account ไปใช้ชื่อของบัญชีที่ soft-delete แล้วได้ โดยคง user ID ของบัญชีที่กำลังแก้ไข ไม่รวมบัญชีและไม่รับสิทธิ์หรือประวัติจากบัญชีที่ลบแล้ว; ถ้าชื่อยังอยู่กับบัญชีที่ไม่ถูกลบ รวม inactive/suspended จะตอบ `409 CONFLICT`
- API/IdP account: เปลี่ยน `username`, `externalId`, ข้อมูลบุคลากร, email, phone หรือ password ไม่ได้; Shape A ส่งค่าเดิมของ `username`, `fullName`, `department`, `lineNameTh`, `levelNameTh` กลับมาได้และ backend จะไม่นำ provider-owned fields เหล่านี้ไปเขียนทับ
- เมื่อส่ง Shape A สำหรับ API/IdP account ให้ส่ง `source: "api"` หรือ `accountType: "api"` ตามค่าจาก `GET /users/:id` เพื่อให้ backend แยก provider-owned fields ออกจาก authorization assignment ถูกต้อง
- API/IdP account ยังแก้ role, `isActive` และ authorization assignment (`regionalAccess`, จังหวัด, นิคม) ได้เมื่อผู้เรียกมีสิทธิ์ครบ
- พื้นที่ในแต่ละเมนูไม่ต้องตรงโปรไฟล์ และไม่อัปเดตโปรไฟล์อัตโนมัติ เช่นบัญชี `diw_central` ส่ง `permissions.dashboard.region: "ภาคตะวันออก"` และ `permissions.factories.province: "ระยอง"` ได้โดยไม่ส่ง `user.regionName`; ตัวอย่างเต็มอยู่ใน runtime OpenAPI ของ PATCH
- หลังแก้สิทธิ์ token เดิมใช้สิทธิ์ล่าสุดตั้งแต่คำขอถัดไป; `/auth/me` โหลดสิทธิ์ปัจจุบันเพื่อ refresh เมนูและปุ่ม
- บัญชี `role_default` ต้องมี assignment ที่ role ใหม่บังคับเมื่อเปลี่ยน role หรือคืนค่าเริ่มต้น มิฉะนั้นตอบ `400 BAD_REQUEST`; บัญชี `custom` คง scope และพื้นที่ใน snapshot แม้เปลี่ยน role
- ถ้าส่ง `permissions` backend แปลง grouped booleans เป็น custom snapshot ทั้ง editable matrix; internal/hidden grants ที่มีผลเดิม เช่น `cems_wpms_requests:direct_connect`, `statistics:export`, `permissions:manage` ถูกเก็บไว้โดยไม่กรองด้วย role ใหม่ ถ้าไม่ต้องการเปลี่ยนสิทธิ์ให้ละ field นี้
- Raw `permissionOverrides` มีผลแทนที่ editable permissions เช่นเดียวกันและคง internal grants ที่ไม่ได้ส่ง; scope ราย action ที่ส่งชัดเจนใช้ค่าตาม request โดยไม่รักษาค่าแคบกว่าอัตโนมัติ
- เปลี่ยน role อย่างเดียวไม่เปลี่ยน custom snapshot; การใช้สิทธิ์ `approve` ยังต้องผ่าน scope และสถานะ/ขั้นตอนของ workflow

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
    "permissionMode": "custom",
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
- เมื่อ soft-delete บัญชี provider `local` สำเร็จ สามารถใช้ username เดิมสร้างบัญชีใหม่ หรือเปลี่ยน username ของบัญชี local อื่นมาใช้ชื่อนี้ได้; การตั้ง inactive/suspended อย่างเดียวไม่คืนชื่อให้ใช้ซ้ำ
- ข้อมูลและประวัติของบัญชีที่ลบยังคงอยู่กับ user ID เดิม ไม่ย้ายไปบัญชีที่ใช้ชื่อซ้ำ ส่วน provider อื่นยังสงวน account key แม้ถูก soft-delete แล้ว

### Authentication, authorization, and error behavior

ทุก endpoint ในเมนูนี้ใช้ `authenticate` ก่อน `authorize`

| HTTP status | Code | เมื่อไรเกิด | Notes |
| --- | --- | --- | --- |
| `401` | `UNAUTHORIZED` | ไม่มี Bearer token, token หมดอายุ, token ตรวจไม่ผ่าน | client ควร login ใหม่ |
| `403` | `FORBIDDEN` | token ผ่านแต่ไม่มี permission ตาม route guard | route บางตัวเปิดด้วย `users:view` หรือ `permissions:manage`; `GET/PUT /:id/permissions` ต้องมี `permissions:manage` เสมอ |
| `404` | `NOT_FOUND` | ไม่พบ user ตาม `:id` หรือ resource ถูกลบแล้ว | ใช้กับ `GET`, `PATCH`, `DELETE`, `GET/PUT permissions` |
| `400` | `BAD_REQUEST` / validation error | payload หรือ query ไม่ผ่าน schema | duplicate permission code และ scope/location ผิดรูปแบบอยู่ในกลุ่มนี้ |
| `409` | `CONFLICT` | local: ชื่อซ้ำกับบัญชีที่ยังไม่ถูก soft-delete รวม inactive/suspended; provider อื่น: account key ซ้ำรวมบัญชีที่ soft-delete | `POST /users`, `POST /users/local-accounts`, `PATCH /users/:id`; รวมกรณีคำขอบันทึกชนกัน |

ตัวอย่าง identity ซ้ำ (`409 Conflict`):

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "External ID already exists"
  }
}
```

คำขอที่ชนกันไม่บันทึกข้อมูลบางส่วนและไม่แก้บัญชีเดิม; response ไม่เปิดเผย SQL, index, ID หรือสถานะของบัญชีที่ครองชื่ออยู่ การแก้บัญชีโดยคง identity ของบัญชีตัวเองยังทำได้ตามสิทธิ์เดิม

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
- `PATCH /api/v1/users/:id` ถ้าแก้พื้นที่โปรไฟล์หรือส่ง `permissions`/`permissionOverrides`/top-level `permissionMode` โดยไม่มี `permissions:manage` จะตอบ `403`; create ที่ส่งสิทธิ์อย่างชัดเจนรวมชุดว่างใช้กติกาเดียวกัน
- `DELETE /api/v1/users/:id` ถ้า `:id` ตรงกับผู้ใช้ที่ login อยู่จะตอบ `403`


## Backend Maintainer Links

- Route: [backend/src/modules/users/users.routes.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.routes.ts:1)
- Validator: [backend/src/modules/users/users.validator.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.validator.ts:1)
- Controller: [backend/src/modules/users/users.controller.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.controller.ts:1)
- Service: [backend/src/modules/users/users.service.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.service.ts:1)
- Types: [backend/src/modules/users/users.types.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.types.ts:1)
- Runtime OpenAPI: [backend/src/modules/api-docs/poms.openapi.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/api-docs/poms.openapi.ts:1)
- คำนำหน้า 64 ตัวอักษร: [validator tests](../../../../../backend/tests/unit/users.validator.test.ts) และ [OpenAPI contract tests](../../../../../backend/tests/unit/user-prename.openapi.test.ts)
- Identity conflict regression: [users.identity-conflicts.test.ts](../../../../../backend/tests/unit/users.identity-conflicts.test.ts)
- Identity conflict OpenAPI: [users.openapi.test.ts](../../../../../backend/tests/unit/users.openapi.test.ts)
- Custom permission OpenAPI: [users.custom-permissions.openapi.test.ts](../../../../../backend/tests/unit/users.custom-permissions.openapi.test.ts)
- Local account reuse regression: [users.local-account-reuse.test.ts](../../../../../backend/tests/unit/users.local-account-reuse.test.ts)
- Migration และ rollback regression: [local-user-identity-reuse-migration.test.ts](../../../../../backend/tests/unit/local-user-identity-reuse-migration.test.ts)

การ deploy พฤติกรรมใช้ชื่อเดิมซ้ำต้องรัน [migration 0125](../../../../../backend/src/db/migrations/0125_reuse_deleted_local_user_identity.ts) พร้อม release เพื่อปรับ unique index โดยเก็บบัญชีและประวัติเดิมทั้งหมดไว้ หากมีบัญชีเก่าและใหม่ที่ใช้ identity เดียวกันแล้ว การ rollback migration จะปฏิเสธและคง index ปัจจุบันไว้ ให้แก้ต่อด้วย forward migration เพื่อรักษาข้อมูล ไม่ลบแถวบัญชีเพื่อให้ rollback ผ่าน