# สิทธิ์การใช้งาน

> Owner: Backend

## Frontend Quick Start

เมนูนี้ครอบคลุมการจัดการผู้ใช้, บทบาท, สิทธิ์รายเมนู, และ per-user permission override ที่ backend ใช้คำนวณ token ของ `POST /api/v1/auth/login` และ `GET /api/v1/auth/me` ด้วย ผู้เรียกทุก endpoint ในหน้านี้ต้องส่ง Bearer token และอย่างน้อยต้องมี `users:view`, `users:edit`, หรือ `permissions:manage` ตาม route ที่เรียก

หน้านี้เป็น contract ที่ใช้งานจริงของ permission matrix ตั้งแต่ migration `0089_expand_auth_rbac_permission_scopes` และส่วนขยาย role กกพ. ใน migration `0103_add_erc_office_permissions` เป็นต้นไป

### Main Flow

1. อ่านรายการผู้ใช้ด้วย `GET /api/v1/users` เพื่อเลือก resource ที่จะแก้
2. อ่านรายละเอียดหน้าแก้ไขด้วย `GET /api/v1/users/:id`
3. อ่าน role grants และ override ปัจจุบันด้วย `GET /api/v1/users/:id/permissions`
4. แก้ role หรือข้อมูลผู้ใช้ด้วย `PATCH /api/v1/users/:id`
5. แทนที่ per-user overrides ทั้งชุดด้วย `PUT /api/v1/users/:id/permissions`; token ใหม่ที่ออกหลังบันทึกจะสะท้อนสิทธิ์ที่คำนวณล่าสุดเมื่อ implementation ตาม target ครบ

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/users/12/permissions' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

```bash
curl --request PUT \
  --url '<BASE_URL>/api/v1/users/12/permissions' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "permissions": [
      { "code": "dashboard.stats:export", "effect": "allow", "scope": "IN_REGION", "region": "ภาคตะวันออก" },
      { "code": "factories:edit", "effect": "deny" }
    ]
  }'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| รายการผู้ใช้ | `GET` | `/api/v1/users` | Bearer | `users:view` หรือ `permissions:manage` | [Managed user list](./user-management-api.md#managed-user-list) |
| รายละเอียดหน้าแก้ไขผู้ใช้ | `GET` | `/api/v1/users/:id` | Bearer | `users:view` หรือ `permissions:manage` | [Managed user detail](./user-management-api.md#managed-user-detail) |
| role grants และ overrides | `GET` | `/api/v1/users/:id/permissions` | Bearer | `permissions:manage` | [Permission override API](./user-management-api.md#permission-override-api) |
| แทนที่ overrides ทั้งชุด | `PUT` | `/api/v1/users/:id/permissions` | Bearer | `permissions:manage` | [Permission override API](./user-management-api.md#permission-override-api) |
| สร้างบัญชี local ของ POMS | `POST` | `/api/v1/users/local-accounts` | Bearer | `users:edit` หรือ `permissions:manage` | [Create local account](./user-management-api.md#create-local-account) |
| สร้างผู้ใช้ managed | `POST` | `/api/v1/users` | Bearer | `users:edit` หรือ `permissions:manage` | [Create managed user](./user-management-api.md#create-managed-user) |
| แก้ผู้ใช้ managed | `PATCH` | `/api/v1/users/:id` | Bearer | `users:edit` หรือ `permissions:manage` | [Update managed user](./user-management-api.md#update-managed-user) |
| ลบผู้ใช้แบบ soft delete | `DELETE` | `/api/v1/users/:id` | Bearer | `users:edit` หรือ `permissions:manage` | [Delete managed user](./user-management-api.md#delete-managed-user) |

## Contracts

### Approved permission model

Target model ของเมนูนี้คือ:

1. managed officer/admin หนึ่งบัญชีต้องมี system role เดียวใน `user_roles`; login จะ fail closed หากบัญชี legacy มีหลาย role
2. แต่ละ role ให้ permission codes พร้อม data scope ตาม approved matrix ด้านล่าง
3. regional assignment ของ role บางกลุ่มไม่ได้แปลว่า “scope กว้างที่สุด” แต่ต้องตรง region assignment ของผู้ใช้หรือค่าที่ policy ระบุ
4. `user_permissions` ใช้เป็น per-user override เพิ่มเติม
5. `deny` ตัด permission code นั้นออกจาก effective result
6. `allow` ใช้ได้เฉพาะ permission ที่ role มีอยู่แล้ว และจำกัด scope ได้เท่าเดิมหรือแคบลงเท่านั้น; backend ปฏิเสธการเพิ่ม permission หรือขยาย scope
7. `/auth/login`, `/auth/me`, และ `GET /api/v1/users/:id` ต้อง map permission code ไปเป็น grouped response ที่สอดคล้องกับ target นี้

Account and assignment invariants:

- `roleCodes` ต้องมีสมาชิกหนึ่งค่าเท่านั้นทั้ง create/update
- `monitoring_5_centers` และ `center_director` ต้องมี assigned region หนึ่งภาค
- `monitoring_kpm` และ `kpm_director` ใช้ `ภาคกลาง` เป็น assignment ที่ระบบกำหนด
- `provincial_office` ต้องมี assigned province หนึ่งจังหวัด
- `industrial_estate` ต้องมี `estateCode` หนึ่งนิคม; เจ้าหน้าที่เห็นโรงงานทุกแห่งที่ผูกกับนิคมนั้น ไม่ได้จำกัดเพียงโรงงานเดียว
- per-menu override เป็นเพียงการลดสิทธิ์ภายใน assignment ข้างต้น ไม่สามารถแทนที่หรือขยาย profile assignment

Data scope keywords ที่ target รองรับ:

| Scope | Meaning |
| --- | --- |
| `ALL` | เข้าถึงข้อมูลได้ทั้งหมด |
| `IN_REGION` | จำกัดตามภาค |
| `IN_PROVINCE` | จำกัดตามจังหวัด |
| `IN_ESTATE` | จำกัดตามนิคมอุตสาหกรรม |
| `OWN_FACTORY` | จำกัดเฉพาะโรงงานของผู้ใช้ |
| `FACTORY_TYPE_88` | จำกัดเฉพาะโรงงานที่รหัสประเภทหลัก normalize เป็น `00088`; เป็น category scope ไม่ใช่ location scope |
| `null` | action แบบ binary ไม่มี data-scope dimension |

### Approved role catalog

Approved target ใช้ 13 roles ต่อไปนี้:

| Role code | Label | Primary intent |
| --- | --- | --- |
| `public_anonymous` | ประชาชน ไม่ login | public routes เท่านั้น |
| `public_user` | ประชาชน login | dashboard เบื้องต้นและ content interaction |
| `factory_operator` | โรงงาน (ผู้ประกอบการ) | งานของโรงงานตนเอง |
| `diw_central` | กรอ. | อ่านและติดตามข้อมูลส่วนกลาง |
| `provincial_office` | สอจ. | อ่านข้อมูลในจังหวัดของตน |
| `industrial_estate` | กนอ. | อ่านข้อมูลในนิคมของตน |
| `erc_office` | สำนักงานกำกับกิจการพลังงาน (กกพ.) | อ่านข้อมูลโรงงานประเภท 88 เท่านั้น |
| `monitoring_kpm` | เจ้าหน้าที่ศูนย์เฝ้า (กฝม.) | ภาคกลาง + workflow หลัก |
| `monitoring_5_centers` | เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์) | ภาคที่ได้รับมอบหมาย + workflow ระดับศูนย์ |
| `center_director` | ผอ.ศูนย์ | ภาคที่ได้รับมอบหมาย |
| `kpm_director` | ผอ.กฝม. | ภาคกลาง |
| `kwp_director` | ผอ.กวภ. | ทุกพื้นที่ |
| `admin` | Admin | explicit matrix ระดับระบบ |

### Runtime connection permission contract

Frontend ต้องใช้ module `connection` สำหรับเมนูขอเชื่อมต่อ ห้ามสร้าง module หรือ object ชื่อ `cems_wpms_requests` เพิ่มใน state, permission hook หรือ UI guard

| งาน | Frontend grouped key | Backend raw permission code |
| --- | --- | --- |
| อ่านคำขอ/ข้อมูลเชื่อมต่อ | `permissions.connection.view` | `cems_wpms_requests:view` |
| สร้างหรือแก้ไขคำขอ | `permissions.connection.edit` | `cems_wpms_requests:edit` |
| ตรวจสอบหรืออนุมัติ | `permissions.connection.approve` | `cems_wpms_requests:approve` |
| เชื่อมต่อโดยเจ้าหน้าที่ทันที | `permissions.connection.direct_connect` | `cems_wpms_requests:direct_connect` |

ตัวอย่าง grouped response ที่ Frontend ใช้:

```json
{
  "permissions": {
    "connection": {
      "data": "IN_REGION",
      "region": "ภาคตะวันออก",
      "view": true,
      "edit": true,
      "approve": true,
      "direct_connect": true
    }
  }
}
```

`permissions.connection.direct_connect` ยังอยู่ใน response ของ `POST /api/v1/auth/login` และ `GET /api/v1/auth/me` เพราะหน้าขอเชื่อมต่อใช้ตัดสินใจแสดง action เชื่อมต่อทันที แต่ field นี้ไม่อยู่ใน response และ request ของหน้า Permission Management

Raw code `cems_wpms_requests:*` ใช้เฉพาะ backend route guard, JWT `scopes`, ตาราง permission/role และ field `permissions[].code` หรือ `permissionOverrides[].code` ที่ API รับเท่านั้น

### Permission Management editable contract

`GET /api/v1/users/:id` คืน matrix เต็มสำหรับ dialog จัดการสิทธิ์ ทุก action เป็น boolean ชัดเจน และ `POST /api/v1/users/local-accounts` กับ grouped payload ของ `PATCH /api/v1/users/:id` รับเฉพาะ module/action ต่อไปนี้:

| Module | Editable actions | Data/location fields |
| --- | --- | --- |
| `dashboard` | `view`, `favorite`, `search`, `advanced_search`, `statistics`, `export` | `data`, `region`, `province`; รองรับ `estateCode`/`estate` สำหรับ compatibility |
| `factories` | `view`, `edit`, `approve` | เช่นเดียวกับ scoped module แต่ `data` ไม่รับ `FACTORY_TYPE_88` จาก frontend |
| `connection` | `view`, `edit`, `approve` | scoped module; ไม่มี `direct_connect` ในหน้าแก้สิทธิ์ |
| `kwp_forms` | `view`, `edit`, `approve` | scoped module |
| `bod_cod_errors` | `view`, `edit`, `approve` | scoped module |
| `notifications` | `view` | scoped module; ไม่มี `view_status`, `edit`, `approve` ในหน้าแก้สิทธิ์ |
| `statistics` | `view` | scoped module |
| `conditional_search` | `view` | scoped module |
| `helpdesk` | `view` | ไม่มี `data`, `region`, `province` |
| `feedback` | `view` | ไม่มี `data`, `region`, `province` |
| `laws` | `view`, `edit` | ไม่มี `data`, `region`, `province` |
| `faq` | `view`, `edit` | ไม่มี `data`, `region`, `province` |
| `chat` | `view`, `edit` | ไม่มี `data`, `region`, `province`; `edit` map ไป raw `chat:answer` |
| `permissions` | `view` | ไม่มี `data`, `region`, `province`; ไม่มี `manage` ในหน้าแก้สิทธิ์ |
| `eligible_factories` | `view`, `edit`, `approve` | scoped module |

`api_documentation` และ internal actions เช่น `statistics:export`, `chat:ask`, `permissions:manage`, `eligible_factories:manage` ไม่อยู่ใน editable matrix แต่ raw grants, route guards และ runtime auth permissions ยังทำงานตาม role matrix เดิม เมื่อ grouped PATCH แทนที่ matrix ระบบรักษา per-user overrides ของ internal actions เดิมไว้เพื่อไม่ให้ deny ถูกล้างหรือสิทธิ์ถูกเปิดกลับโดยไม่ตั้งใจ

### Backend raw role / action / scope matrix

ตารางนี้เป็น backend reference ของ role defaults และ location scope ที่ seed/runtime ใช้จริง ค่าในตารางเป็น **raw permission code** ไม่ใช่ JSON key ที่ Frontend ต้องสร้าง สำหรับเมนูขอเชื่อมต่อ Frontend ต้องอ่านผ่าน `permissions.connection.*` ตาม mapping ด้านบน

| Role | Dashboard / Search / Stats | Factories | Eligible factories | Connection requests (raw backend code) | KWP forms | BOD/COD | Notifications | Helpdesk / Feedback / Chat | Permission admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `public_anonymous` | `dashboard:view=ALL` | - | - | - | - | - | - | `feedback:submit`, `laws:view`, `faq:view` | - |
| `public_user` | `dashboard:view=ALL`, `dashboard.alerts:view` | - | - | - | - | - | - | `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `factory_operator` | `dashboard:view=OWN_FACTORY`, `dashboard.alerts:view`, `dashboard.stats:view=OWN_FACTORY`, `dashboard.stats:export=OWN_FACTORY` | `factories:view=OWN_FACTORY`, `factories:edit` | `eligible_factories:view=OWN_FACTORY` | `cems_wpms_requests:view=OWN_FACTORY`, `cems_wpms_requests:edit` | `kwp_forms:view=OWN_FACTORY`, `kwp_forms:edit` | `bod_cod_errors:view=OWN_FACTORY`, `bod_cod_errors:edit` | `notifications:view=OWN_FACTORY` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `diw_central` | `dashboard:view=ALL`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=ALL`, `dashboard.stats:export=ALL`, `conditional_search:view=ALL`, `statistics:view=ALL`, `statistics:export=ALL` | `factories:view=ALL` | `eligible_factories:view=ALL` | - | `kwp_forms:view=ALL` | `bod_cod_errors:view=ALL` | `notifications:view=ALL` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `provincial_office` | `dashboard:view=IN_PROVINCE`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_PROVINCE`, `dashboard.stats:export=IN_PROVINCE`, `conditional_search:view=IN_PROVINCE`, `statistics:view=IN_PROVINCE`, `statistics:export=IN_PROVINCE` | `factories:view=IN_PROVINCE` | `eligible_factories:view=IN_PROVINCE` | - | `kwp_forms:view=IN_PROVINCE` | `bod_cod_errors:view=IN_PROVINCE` | `notifications:view=IN_PROVINCE` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `industrial_estate` | `dashboard:view=IN_ESTATE`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_ESTATE`, `dashboard.stats:export=IN_ESTATE`, `conditional_search:view=IN_ESTATE`, `statistics:view=IN_ESTATE`, `statistics:export=IN_ESTATE` | `factories:view=IN_ESTATE` | `eligible_factories:view=IN_ESTATE` | - | `kwp_forms:view=IN_ESTATE` | `bod_cod_errors:view=IN_ESTATE` | `notifications:view=IN_ESTATE` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `erc_office` | `dashboard:view=FACTORY_TYPE_88`, `dashboard.alerts:view`, `dashboard.search:basic=FACTORY_TYPE_88`, `dashboard.search:advanced=FACTORY_TYPE_88`, `dashboard.stats:view=FACTORY_TYPE_88`, `dashboard.stats:export=FACTORY_TYPE_88`, `conditional_search:view=FACTORY_TYPE_88`, `statistics:view=FACTORY_TYPE_88`, `statistics:export=FACTORY_TYPE_88` | `factories:view=FACTORY_TYPE_88` | `eligible_factories:view=FACTORY_TYPE_88` | `cems_wpms_requests:view=FACTORY_TYPE_88` | `kwp_forms:view=FACTORY_TYPE_88` | `bod_cod_errors:view=FACTORY_TYPE_88` | `notifications:view=FACTORY_TYPE_88` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `monitoring_kpm` | `dashboard:view=IN_REGION (ภาคกลาง)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (ภาคกลาง)`, `dashboard.stats:export=IN_REGION (ภาคกลาง)`, `conditional_search:view=IN_REGION (ภาคกลาง)`, `statistics:view=IN_REGION (ภาคกลาง)`, `statistics:export=IN_REGION (ภาคกลาง)` | `factories:view=IN_REGION (ภาคกลาง)`, `factories:edit`, `factories:approve` | `eligible_factories:view=IN_REGION (ภาคกลาง)` | `cems_wpms_requests:view=IN_REGION (ภาคกลาง)`, `cems_wpms_requests:edit`, `cems_wpms_requests:approve`, `cems_wpms_requests:direct_connect=IN_REGION (ภาคกลาง)` | `kwp_forms:view=IN_REGION (ภาคกลาง)`, `kwp_forms:edit`, `kwp_forms:approve` | `bod_cod_errors:view=IN_REGION (ภาคกลาง)`, `bod_cod_errors:edit`, `bod_cod_errors:approve=IN_REGION (ภาคกลาง)` | `notifications:view=IN_REGION (ภาคกลาง)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:answer` | - |
| `monitoring_5_centers` | `dashboard:view=IN_REGION (assigned region)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (assigned region)`, `dashboard.stats:export=IN_REGION (assigned region)`, `conditional_search:view=IN_REGION (assigned region)`, `statistics:view=IN_REGION (assigned region)`, `statistics:export=IN_REGION (assigned region)` | `factories:view=IN_REGION (assigned region)`, `factories:edit`, `factories:approve` | `eligible_factories:view=IN_REGION (assigned region)` | `cems_wpms_requests:view=IN_REGION (assigned region)` | `kwp_forms:view=IN_REGION (assigned region)`, `kwp_forms:edit`, `kwp_forms:approve` | `bod_cod_errors:view=IN_REGION (assigned region)`, `bod_cod_errors:edit`, `bod_cod_errors:approve=IN_REGION (assigned region)` | `notifications:view=IN_REGION (assigned region)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:answer` | - |
| `center_director` | `dashboard:view=IN_REGION (assigned region)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (assigned region)`, `dashboard.stats:export=IN_REGION (assigned region)`, `conditional_search:view=IN_REGION (assigned region)`, `statistics:view=IN_REGION (assigned region)`, `statistics:export=IN_REGION (assigned region)` | `factories:view=IN_REGION (assigned region)` | `eligible_factories:view=IN_REGION (assigned region)` | `cems_wpms_requests:view=IN_REGION (assigned region)` | `kwp_forms:view=IN_REGION (assigned region)` | `bod_cod_errors:view=IN_REGION (assigned region)`, `bod_cod_errors:approve=IN_REGION (assigned region)` | `notifications:view=IN_REGION (assigned region)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | - |
| `kpm_director` | `dashboard:view=IN_REGION (ภาคกลาง)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (ภาคกลาง)`, `dashboard.stats:export=IN_REGION (ภาคกลาง)`, `conditional_search:view=IN_REGION (ภาคกลาง)`, `statistics:view=IN_REGION (ภาคกลาง)`, `statistics:export=IN_REGION (ภาคกลาง)` | `factories:view=IN_REGION (ภาคกลาง)` | `eligible_factories:view=IN_REGION (ภาคกลาง)` | `cems_wpms_requests:view=IN_REGION (ภาคกลาง)` | `kwp_forms:view=IN_REGION (ภาคกลาง)` | `bod_cod_errors:view=IN_REGION (ภาคกลาง)`, `bod_cod_errors:approve=IN_REGION (ภาคกลาง)` | `notifications:view=IN_REGION (ภาคกลาง)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | - |
| `kwp_director` | `dashboard:view=ALL`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=ALL`, `dashboard.stats:export=ALL`, `conditional_search:view=ALL`, `statistics:view=ALL`, `statistics:export=ALL` | `factories:view=ALL` | `eligible_factories:view=ALL` | `cems_wpms_requests:view=ALL` | `kwp_forms:view=ALL` | `bod_cod_errors:view=ALL`, `bod_cod_errors:approve=ALL` | `notifications:view=ALL` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | - |
| `admin` | `dashboard:view=ALL`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=ALL`, `dashboard.stats:export=ALL`, `conditional_search:view=ALL`, `statistics:view=ALL`, `statistics:export=ALL` | `factories:view=ALL`, `factories:edit`, `factories:approve` | `eligible_factories:view=ALL`, `eligible_factories:edit=ALL`, `eligible_factories:approve=ALL`, `eligible_factories:manage` (deprecated) | `cems_wpms_requests:view=ALL`, `cems_wpms_requests:edit`, `cems_wpms_requests:approve`, `cems_wpms_requests:direct_connect=ALL` | `kwp_forms:view=ALL`, `kwp_forms:edit`, `kwp_forms:approve` | `bod_cod_errors:view=ALL`, `bod_cod_errors:edit`, `bod_cod_errors:approve=ALL` | `notifications:view=ALL`, `notifications:view_status=ALL`, `notifications:edit`, `notifications:approve` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `laws:edit`, `faq:view`, `faq:edit`, `chat:view`, `chat:answer` | `permissions:view`, `permissions:manage`, `users:view`, `users:edit`, `roles:view`, `roles:edit`, `audit:view`, `api_documentation:view` |

Admin target intentionally **does not include** `chat:ask`

### Explicit action-scope rules

ใช้กฎนี้เมื่อ matrix ข้างบนระบุ action แบบ binary โดยไม่ได้ใส่ `=SCOPE`

| Action family | Scope rule |
| --- | --- |
| `dashboard:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view`, `dashboard.stats:export`, `statistics:view`, `statistics:export`, `conditional_search:view`, `factories:view`, `eligible_factories:view`, `eligible_factories:edit`, `cems_wpms_requests:view`, `kwp_forms:view`, `bod_cod_errors:view`, `bod_cod_errors:approve`, `notifications:view`, `notifications:view_status` | ใช้ data scope ตาม role matrix เมื่อแถวนั้นระบุ scope ไว้ |
| `dashboard.alerts:view` | เป็น binary action ไม่มี data scope |
| `factories:*`, `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve`, `cems_wpms_requests:*`, `kwp_forms:*`, `bod_cod_errors:*`, `notifications:*` | ทุก action ที่ role ได้รับใช้ data scope เดียวกับ role ใน matrix; backend บังคับ scope ตอนอ่าน/แก้ไข/อนุมัติ |
| `eligible_factories:manage` | deprecated compatibility permission; เป็น binary action และมีใน admin default เท่านั้น |
| `chat:answer`, `laws:edit`, `faq:edit`, `users:view`, `users:edit`, `roles:view`, `roles:edit`, `permissions:*`, `audit:view`, `api_documentation:view` | เป็น binary action; contract ไม่เพิ่ม location field |
| `chat:view`, `chat:ask`, `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | เป็น binary action ใน approved target รอบนี้ |

### Approved backend permission codes (raw)

รายการนี้ใช้สำหรับ backend authorization, JWT `scopes` และ request body ที่รับ raw `code`; ไม่ใช่ชื่อ grouped module สำหรับ Frontend

| Capability | Codes |
| --- | --- |
| Dashboard | `dashboard:view`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view`, `dashboard.stats:export`, `statistics:view`, `statistics:export`, `conditional_search:view` |
| Factories | `factories:view`, `factories:edit`, `factories:approve` |
| Connection requests | `cems_wpms_requests:view`, `cems_wpms_requests:edit`, `cems_wpms_requests:approve`, `cems_wpms_requests:direct_connect` |
| KWP forms | `kwp_forms:view`, `kwp_forms:edit`, `kwp_forms:approve` |
| BOD/COD | `bod_cod_errors:view`, `bod_cod_errors:edit`, `bod_cod_errors:approve` |
| Notifications | `notifications:view`, `notifications:view_status`, `notifications:edit`, `notifications:approve` |
| Eligible factories | `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve`, `eligible_factories:manage` (deprecated compatibility) |
| Helpdesk / feedback / content | `helpdesk:submit`, `feedback:submit`, `laws:view`, `laws:edit`, `faq:view`, `faq:edit`, `chat:view`, `chat:ask`, `chat:answer` |
| Permission and admin | `permissions:view`, `permissions:manage`, `api_documentation:view`, `users:view`, `users:edit`, `roles:view`, `roles:edit`, `audit:view` |

### Runtime grouped permission keys

`POST /api/v1/auth/login` และ `GET /api/v1/auth/me` คืน grouped runtime permissions จาก permission code เดียวกับที่ backend ตรวจจริง ส่วน `GET /api/v1/users/:id` ใช้ editable matrix ที่กรอง internal actions ตามหัวข้อก่อนหน้า

| Permission code | Response group/action |
| --- | --- |
| `dashboard:view` | `permissions.dashboard.view` |
| `dashboard.alerts:view` | `permissions.dashboard.favorite` |
| `dashboard.search:basic` | `permissions.dashboard.search` |
| `dashboard.search:advanced` | `permissions.dashboard.advanced_search` และอาจต้อง mirror ไป `permissions.conditional_search.view` ระหว่าง migration |
| `conditional_search:view` | `permissions.conditional_search.view` |
| `dashboard.stats:view` | `permissions.dashboard.statistics` |
| `statistics:view` | `permissions.statistics.view` |
| `dashboard.stats:export` | `permissions.dashboard.export` |
| `cems_wpms_requests:view` | `permissions.connection.view` |
| `cems_wpms_requests:edit` | `permissions.connection.edit` |
| `cems_wpms_requests:approve` | `permissions.connection.approve` |
| `cems_wpms_requests:direct_connect` | `permissions.connection.direct_connect` เฉพาะ runtime auth response; ไม่อยู่ใน Permission Management |
| `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve` | `permissions.eligible_factories.view`, `permissions.eligible_factories.edit`, `permissions.eligible_factories.approve` |
| `permissions:view`, `permissions:manage` | runtime response อาจมี `view`/`manage`; Permission Management มีเฉพาะ `view` และไม่มี `data` |
| `chat:view`, `chat:ask`, `chat:answer` | runtime response มี `view`, `ask`, `edit` และ compatibility `answer`; Permission Management มีเฉพาะ `view`, `edit` และไม่มี `data` |

Frontend ต้องใช้ grouped response เป็น canonical UI contract โดยเฉพาะ `permissions.connection.*`; raw permission code มีไว้สำหรับส่งกลับใน API ที่ระบุ field `code` และสำหรับ backend authorization เท่านั้น

### Region and location rules

| Case | Request / storage rule | Response rule |
| --- | --- | --- |
| `IN_REGION` | รับ `region` เป็น string; ถ้าไม่ส่งให้ใช้ assigned region จาก profile แต่ถ้าค่าขัดกับ profile หรือ profile ไม่มี assignment ต้อง fail closed | grouped permissions คืน effective assigned region; `monitoring_kpm`/`kpm_director` เป็นภาคกลาง ส่วน 5 ศูนย์/ผอ.ศูนย์เป็นภาคที่มอบหมาย |
| `IN_PROVINCE` | รับ `province` เป็นชื่อหรือรหัสจังหวัดและ resolve เป็น province id; ค่าต้องตรง assigned province | grouped permissions คืนชื่อจังหวัดไทย; qualifier หายหรือขัดกันทำให้ไม่มีข้อมูล |
| `IN_ESTATE` | รับ `estateCode` หรือ compatibility field `estate`; resolve กับ industrial estate master และค่าต้องตรง profile assignment | grouped permissions คืน canonical `estateCode`/`estate`; qualifier หายหรือขัดกันทำให้ไม่มีข้อมูล |
| `OWN_FACTORY` | ไม่มี field location เพิ่มเติม | client เห็นเพียง `data: "OWN_FACTORY"` |
| `FACTORY_TYPE_88` | ไม่มี field location เพิ่มเติม; filter จาก factory type ที่เก็บใน eligible/snapshot/form | client เห็น `data: "FACTORY_TYPE_88"`; scope นี้แคบกว่า `ALL` แต่เทียบลำดับกับ region/province/estate ไม่ได้ |
| profile-level regional access | `profile.regionalAccess` เป็นคนละชั้นกับ per-menu permission scope | ใช้กับการกำหนดพื้นที่เจ้าหน้าที่ ไม่ใช่รายการ `permissions.<module>.region` |

`profile.regionalAccess` กับ `permissions.<module>.region` จึงไม่ใช่ field แทนกัน:

- `profile.regionalAccess`, `profile.provinceId` และ `profile.estateCode` เป็นเพดานพื้นที่ระดับ profile
- `permissions.<module>.region` ใช้บันทึก override เฉพาะเมนู
- effective location เป็นจุดตัดของ role scope, profile assignment และ per-menu qualifier; ค่าใดหายหรือขัดกันต้องไม่คืนข้อมูล
- การแก้ region/province/estate assignment ต้องมี `permissions:manage` แม้ route จะ authorize ด้วย `users:edit` ได้อยู่แล้ว

### Detailed API contract

รายละเอียด field, validation, curl และ response ของทั้ง 8 operations อยู่ที่ [API จัดการผู้ใช้และสิทธิ์รายบัญชี](./user-management-api.md) หน้าเมนูหลักนี้เก็บ role catalog, default permission matrix, scope rules และ maintainer map เพื่อไม่ทำ contract ซ้ำ
### Migration and client impact

| Area | Client impact |
| --- | --- |
| Canonical docs location | ใช้หน้านี้เป็น owner ของ `/api/v1/users*` แทนการอ้างเอกสาร legacy กระจัดกระจาย |
| Approved matrix | seed, migration และ code ใช้ matrix นี้ |
| Runtime role count | target ใช้ 13 roles รวม `erc_office`; `public_anonymous` ยังเป็น system role แต่ frontend ไม่ต้องแสดงใน dropdown สร้างผู้ใช้ |
| Regional roles | `monitoring_kpm` และ `kpm_director` target เป็น `IN_REGION` ภาคกลาง; `monitoring_5_centers` และ `center_director` target เป็น assigned region |
| One-role policy | managed account รับ role เดียว; IdP sync คง specialized role ที่ Admin มอบหมายและไม่เติม base role ซ้ำ |
| Assignment ceiling | per-menu location ต้องอยู่ภายใน profile assignment; missing/conflict เป็น no data |
| New codes | เพิ่ม `statistics:view`, `conditional_search:view`, `chat:view`, `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve` ใน target contract |
| Grouped permission aliases | `dashboard.search`, `dashboard.advanced_search`, `dashboard.statistics`, `dashboard.export`, `statistics.*`, `conditional_search.view`, `permissions.*`, `chat.edit` |
| Estate location detail | ใช้ `estateCode` (หรือ compatibility field `estate`) และตรวจสอบกับ master data |

Migration guidance:

- หาก client เดิมสร้าง UI จากเอกสาร legacy ให้ย้ายมาอ่าน canonical page นี้
- ถ้า admin UI แก้สิทธิ์รายเมนู ให้ส่ง grouped permission shape ผ่าน `PATCH /api/v1/users/:id` หรือส่ง permission code ดิบผ่าน `PUT /api/v1/users/:id/permissions`
- token ที่ออกก่อนเปลี่ยน role/override จะไม่เปลี่ยนย้อนหลังจนกว่าจะ login หรือ refresh ใหม่ตาม auth flow ของ client
- token ที่ออกก่อน migration หรือก่อนเปลี่ยน role/override ต้อง login หรือ refresh ใหม่เพื่อรับ scope ล่าสุด

### Implementation status notes

สถานะ code/test สำหรับ approved target ณ วันอังคารที่ 11 สิงหาคม 2026:

| Area | Status |
| --- | --- |
| Approved role matrix vs code/seed alignment | implemented by `rbac_matrix_v20260810.ts` and migration `0089` |
| New permission codes | implemented: `statistics:*`, `conditional_search:view`, `permissions:view`, `chat:view`, `eligible_factories:view/edit` |
| Regional role assignment | `monitoring_kpm`/`kpm_director` are fixed to ภาคกลาง; 5 ศูนย์/ผอ.ศูนย์ use assigned profile region |
| Province/estate assignment | สอจ. ใช้หนึ่งจังหวัด; กนอ. ใช้ canonical `estateCode` หนึ่งนิคมและเห็นทุกโรงงานในนิคมนั้น |
| Fail-closed enforcement | request, dashboard, eligible factory, KWP/BOD, alert, monitoring point, device config และ parameter reads ใช้ profile intersection |
| Grouped response aliases | implemented and covered by auth/user tests |
| ERC factory-type scope | migration `0103`, RBAC seeds และ repository filters ใช้ `FACTORY_TYPE_88`/`00088` แบบ fail closed |
| Tests proving matrix | see evidence page |

## Business Flow And Explanations

- [Permission menu location-scope workflow](../../../../../workflows/permission-menu-location-scope.md)
- [Backend documentation migration workflow](../../../explanations/documentation-migration-workflow.md)
- [Shared authentication contract](../../shared/authentication/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Detailed request/response contract | [API จัดการผู้ใช้และสิทธิ์รายบัญชี](./user-management-api.md) |
| Routes | [backend/src/modules/users/users.routes.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.routes.ts:1) |
| Controllers | [backend/src/modules/users/users.controller.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.controller.ts:1) |
| Validators | [backend/src/modules/users/users.validator.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.validator.ts:1) |
| Service | [backend/src/modules/users/users.service.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.service.ts:1) |
| Repository | [backend/src/modules/users/users.repository.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/users/users.repository.ts:1), [backend/src/modules/auth/auth.repository.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/auth/auth.repository.ts:349) |
| Current permission aliases in code | [backend/src/modules/auth/permissions.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/modules/auth/permissions.ts:1) |
| Current seed files to reconcile | [backend/src/db/seeds/04_roles.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/db/seeds/04_roles.ts:1), [backend/src/db/seeds/05_permissions.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/db/seeds/05_permissions.ts:1), [backend/src/db/seeds/06_role_permissions.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/db/seeds/06_role_permissions.ts:1) |
| Endpoint registry | [docs/backend/api/ENDPOINTS.md](../../ENDPOINTS.md) |
| Evidence | [Permission matrix rollout evidence](../../../evidence/permissions/permission-matrix-rollout.tdd.md), [Permission Management contract alignment](../../../evidence/permissions/permission-management-contract-alignment.tdd.md) |
