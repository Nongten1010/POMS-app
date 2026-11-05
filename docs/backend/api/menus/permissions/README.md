# สิทธิ์การใช้งาน

> Owner: Backend

## Frontend Quick Start

เมนูนี้ครอบคลุมการจัดการผู้ใช้, บทบาท และสิทธิ์รายคนที่ backend ใช้ตรวจ API จริง บทบาทให้สิทธิ์เริ่มต้น; หลังบันทึกสิทธิ์รายคน ระบบใช้ชุดที่บันทึกโดยไม่จำกัดด้วยบทบาท `POST /api/v1/auth/login` และ `GET /api/v1/auth/me` คืนสิทธิ์ชุดเดียวกัน ผู้เรียกทุก endpoint ในหน้านี้ต้องส่ง Bearer token และมี `users:view`, `users:edit`, หรือ `permissions:manage` ตาม route ที่เรียก

หน้านี้เป็น contract ที่ใช้งานจริงของ permission matrix ตั้งแต่ migration `0089_expand_auth_rbac_permission_scopes` และส่วนขยาย role กกพ. ใน migration `0103_add_erc_office_permissions` เป็นต้นไป

### Main Flow

1. อ่านรายการผู้ใช้ด้วย `GET /api/v1/users` เพื่อเลือก resource ที่จะแก้
2. อ่านรายละเอียดหน้าแก้ไขด้วย `GET /api/v1/users/:id`
3. อ่าน role grants และ override ปัจจุบันด้วย `GET /api/v1/users/:id/permissions`
4. แก้ role หรือข้อมูลผู้ใช้ด้วย `PATCH /api/v1/users/:id`
5. บันทึก grouped matrix ด้วย `PATCH /api/v1/users/:id` หรือสิทธิ์ raw ทั้งชุดด้วย `PUT /api/v1/users/:id/permissions`; บัญชีเปลี่ยนเป็น `custom` และ token เดิมใช้สิทธิ์ล่าสุดตั้งแต่คำขอถัดไป
6. ถ้าต้องการคืนค่าเริ่มต้น ส่ง `PATCH /api/v1/users/:id` ด้วย `{ "permissionMode": "role_default" }` โดยไม่ส่ง `permissions`

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

```bash
curl --request PATCH \
  --url '<BASE_URL>/api/v1/users/12' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{ "permissionMode": "role_default" }'
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

โมเดลสิทธิ์ของเมนูนี้คือ:

1. managed officer/admin หนึ่งบัญชีต้องมี system role เดียวใน `user_roles`; login จะ fail closed หากบัญชี legacy มีหลาย role
2. `permissionMode: "role_default"` ใช้ permission codes และ data scope เริ่มต้นของ role ตาม matrix ด้านล่าง
3. `permissionMode: "custom"` ใช้ `user_permissions` เป็น snapshot สิทธิ์ทั้งชุด ไม่รวมสิทธิ์ที่ไม่ได้บันทึกจาก role; `allow` ให้สิทธิ์และ `deny` ปิดสิทธิ์นั้น
4. ผู้มี `permissions:manage` เพิ่ม action ที่ role ไม่มีหรือเลือก scope ที่กว้างกว่า role ได้ เช่น `ALL` โดยต้องเป็น code, scope และพื้นที่ที่ backend รองรับ
5. PATCH รับ grouped `permissions` หรือ legacy raw `permissionOverrides` เพื่อกำหนด editable permissions ทั้งชุด; action ที่ละไว้เป็นปิด และระบบคงสิทธิ์ internal/hidden เดิมที่ไม่ได้ส่งใน snapshot Raw PATCH ใช้ scope ที่ส่งอย่างชัดเจน; grouped PATCH คง action scope เดิมที่แคบกว่าเมื่อขอบเขตเมนูไม่เปลี่ยน Raw PUT แทนที่ทั้งชุดรวม internal actions; `[]` ของ PUT คือ `custom` ที่ไม่มีสิทธิ์
6. เปลี่ยน role อย่างเดียวไม่เปลี่ยน snapshot ของบัญชี `custom`; การคืนค่า role defaults ต้องส่ง top-level `permissionMode: "role_default"` โดยไม่ส่ง `permissions`
7. พื้นที่รายเมนูมีผลก่อนพื้นที่โปรไฟล์และไม่ต้องตรงกัน ไม่แก้โปรไฟล์อัตโนมัติ; การบันทึกใหม่ที่ scope ต้องใช้พื้นที่แต่ไม่มี qualifier ที่ใช้ได้หลังเติม defaults และ resolve master ตอบ `400 BAD_REQUEST`; ข้อมูลเดิมที่ qualifier ใช้ไม่ได้ให้ไม่มีสิทธิ์หรือข้อมูล
8. `/auth/login`, `/auth/me`, รายละเอียดผู้ใช้ และ API guards ใช้ตัวคำนวณสิทธิ์เดียวกัน Backend โหลดสิทธิ์ล่าสุดจากฐานข้อมูลทุกคำขอ จึงเพิ่มหรือถอนสิทธิ์ได้โดยไม่ต้อง login ใหม่; persona citizen/operator ยังแยกตาม session ที่เลือก

| การเปลี่ยนแปลง | สิทธิ์ที่มีผล |
| --- | --- |
| บัญชีใช้ `role_default` | ติดตาม role ปัจจุบัน |
| บันทึกสิทธิ์รายคน | เปลี่ยนเป็น `custom` และใช้ชุดที่บันทึก |
| เปลี่ยน role ของบัญชี `custom` | คงสิทธิ์ชุดเดิม |
| คืนค่า `role_default` | ล้าง snapshot และใช้ role ปัจจุบัน |

Data-scoped `allow` ที่บันทึกใหม่ต้องมี scope ที่ใช้ได้ ห้ามส่ง `scope: null`; ถ้าละ field จะคัดลอก role scope ครั้งเดียวตอนบันทึก Binary codes ยังใช้ null ได้ ส่วน custom legacy edit/approve ที่มี null ใช้เฉพาะ saved view scope และ qualifiers ที่ถูกต้อง ไม่ใช้ role/profile fallback ดู [กติกา scope null และ validation](./user-management-api.md#scope-ที่เป็น-null-ในข้อมูลเดิม)

`permissions:view` ใช้แสดงเมนูสิทธิ์เท่านั้น ไม่ให้ `permissions:manage` อัตโนมัติ สิทธิ์จัดการผู้ใช้และสิทธิ์จัดการสิทธิ์เป็นคนละ capability การบันทึกสิทธิ์หรือคืนค่าเริ่มต้นต้องตรวจ `permissions:manage` เสมอ

### สิทธิ์อนุมัติแยกรายเมนู

Backend API อนุญาตผู้ที่ได้รับ `approve` ของเมนูใดให้ทำรายการอนุมัติในเมนูนั้นตาม scope และสถานะ/ขั้นตอนปัจจุบัน โดยไม่จำกัดชื่อ role หรือ `userType` และคืน `allowedActions` ตามสิทธิ์จริงเมื่อ endpoint มี field นี้

รอบนี้เปลี่ยนเฉพาะ backend และ OpenAPI ไม่ปรับ frontend หรือการ refresh สิทธิ์ใน App ข้อจำกัด role/userType เดิมในหน้าเว็บจึงยังอาจซ่อนหรือปิดปุ่มอนุมัติแม้ API อนุญาต ผลการแก้ backend ไม่ใช่การยืนยันว่าปุ่มหน้าเว็บรองรับครบแล้ว

| เมนู | สิทธิ์อ่านเพื่อเปิดรายการ/รายละเอียด | สิทธิ์อนุมัติและ contract |
| --- | --- | --- |
| ขอเชื่อมต่อ | `cems_wpms_requests:view` | `cems_wpms_requests:approve`; [review/status/verify-connection](../connection-requests/README.md#approval-access) |
| กวภ. | `kwp_forms:view` | `kwp_forms:approve`; [workflow](../kwp-forms/README.md#get-apiv1kwp-form-submissionsidworkflow) |
| BOD/COD | `bod_cod_errors:view` | `bod_cod_errors:approve`; mutation ต้องมี view ร่วมด้วยและผ่านทั้งสอง scope; [สิทธิ์การพิจารณา](../bod-cod-deviation-reports/README.md#สิทธิ์การพิจารณา) |
| คำขอแก้ไขโรงงาน POMS | `factories:view` | `factories:approve` ร่วมกับ view; [คำขอแก้ไขโรงงาน](../master-data/factory-edit-requests.md) |
| โรงงานที่เข้าข่าย | `eligible_factories:view` | `eligible_factories:approve` ร่วมกับ view สำหรับ review; [พิจารณาคำขอเพิ่มโรงงาน](../eligible-factories/README.md#post-apiv1eligible-factoriesadd-requestsidreview) |

`approve` เป็นคนละ grant ในแต่ละเมนู ไม่ให้ approve ของเมนูอื่น และไม่เติม `view` หรือ `edit` เข้า custom snapshot อัตโนมัติ การอ่านรายการและรายละเอียดผ่าน API ยังต้องมี view ของเมนูนั้นแยกตาม endpoint; การเลือก view และ approve ไม่ได้ยกเลิกข้อจำกัด UI เดิมใน release ที่แก้เฉพาะ backend นี้ ขอบเขตอ่านที่กว้างกว่าไม่ขยายขอบเขตอนุมัติ และสิทธิ์อนุมัติไม่ข้ามสถานะหรือ current step ของ workflow

Account and assignment invariants (location assignment เป็นข้อกำหนดของ `role_default`; `custom` ใช้ scope และพื้นที่ที่บันทึกใน snapshot):

- `roleCodes` ต้องมีสมาชิกหนึ่งค่าเท่านั้นทั้ง create/update
- `monitoring_5_centers` และ `center_director` ต้องมี assigned region หนึ่งภาค
- `monitoring_kpm` และ `kpm_director` ใช้ `ภาคกลาง` เป็น assignment ที่ระบบกำหนด
- `provincial_office` ต้องมี assigned province หนึ่งจังหวัด
- `industrial_estate` ต้องมี `estateCode` หนึ่งนิคม; เจ้าหน้าที่เห็นโรงงานทุกแห่งที่ผูกกับนิคมนั้น ไม่ได้จำกัดเพียงโรงงานเดียว
- สิทธิ์รายเมนูระบุพื้นที่ต่างจาก profile assignment ได้ เช่น `diw_central` ให้ dashboard เป็นภาคตะวันออกและ factories เป็นจังหวัดระยอง โดยไม่เปลี่ยนโปรไฟล์; ใน `custom` ให้ action หรือ scope เกินค่าเริ่มต้นของ role ได้

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

Raw code `cems_wpms_requests:*` ใช้กับ backend route guard, ตาราง permission/role และ field `permissions[].code` หรือ `permissionOverrides[].code` ที่ API รับ JWT `scopes` เป็น snapshot ตอนออก token; backend ตรวจสิทธิ์ล่าสุดจากฐานข้อมูลแทนการเชื่อถือ snapshot นี้

### Permission Management editable contract

`GET /api/v1/users/:id` คืน matrix เต็มสำหรับ dialog จัดการสิทธิ์ ทุก action เป็น boolean ชัดเจน และ `POST /api/v1/users/local-accounts` กับ grouped payload ของ `PATCH /api/v1/users/:id` รับเฉพาะ module/action ต่อไปนี้:

| Module | Editable actions | Data/location fields |
| --- | --- | --- |
| `dashboard` | `view`, `favorite`, `search`, `advanced_search`, `statistics`, `export` | `data`, `region`, `province` |
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
| `chat` | `view`, `ask`, `edit` | scoped module อิสระ; `view` = มีสิทธิ์ใช้งาน, `ask` = เปิดการสนทนา, `edit` = ตอบคำถามและ map ไป raw `chat:answer` |
| `permissions` | `view` | ไม่มี `data`, `region`, `province`; ไม่มี `manage` ในหน้าแก้สิทธิ์ |
| `eligible_factories` | `view`, `edit`, `approve` | scoped module |

Scoped permission groups ใช้ `data`, `region`, `province` และ optional `estateCode` สำหรับนิคมรายเมนูหนึ่งแห่งเมื่อ `data=IN_ESTATE`; `estate` เป็น compatibility alias และ client ใหม่ควรใช้ `estateCode` Response คืน `estateCode` ของ scope นี้ เพื่อให้ส่งกลับผ่าน grouped PATCH โดยไม่สูญเสียพื้นที่รายเมนู ถ้าไม่ระบุนิคมใช้ profile fallback และยังคงจำกัดหนึ่งนิคม

`data` ใน grouped response แสดงขอบเขตรวมของเมนู แต่ scope ของแต่ละ action อาจต่างกัน เช่น `view=ALL` และ `edit=IN_PROVINCE` การส่ง grouped matrix กลับโดยไม่เปลี่ยนขอบเขตเมนูต้องคง scope/qualifier ราย action ที่แคบกว่า ไม่ใช้ค่า display ที่กว้างที่สุดขยาย edit หรือ approve อัตโนมัติ ถ้าต้องการแก้ scope แยกแต่ละ action ให้ใช้ raw GET/PUT ตาม [API สิทธิ์รายบัญชี](./user-management-api.md#permission-override-api)

`api_documentation` และ internal actions เช่น `statistics:export`, `permissions:manage`, `eligible_factories:manage` ไม่อยู่ใน editable matrix เมื่อ grouped PATCH เปลี่ยนบัญชีเป็น `custom` ระบบเก็บสิทธิ์ internal ที่มีผลอยู่ก่อนบันทึกไว้ใน snapshot เพื่อไม่ให้สิทธิ์หายหรือเปิดกลับจาก role โดยไม่ตั้งใจ Raw PUT เป็นช่องทางแทนที่สิทธิ์ทุก code รวม internal actions ผู้ที่มีเพียง `permissions:view` จะไม่ได้สิทธิ์แก้ผู้ใช้หรือแก้สิทธิ์เพิ่ม

Chat ใช้ `data`/`region`/`province` ของเมนูตนเอง ไม่อิง `eligible_factories:view` ขณะใช้งาน `view` อย่างเดียวอ่านได้เท่านั้น; `ask` อนุญาตให้ `operator`/`officer`/`admin` เปิดเรื่องและติดตามหรือปิดเรื่องที่ตนเปิด; `edit` อนุญาตตอบและปิดเรื่องในขอบเขตที่อ่านได้ ต้องผ่านทั้ง scope อ่านและ scope ของ action ดู [สัญญา Chat](../chat/README.md#chat-scoped-actions) สำหรับ capability และ error ที่เกี่ยวข้อง Grouped Chat ต้องส่ง `data`; payload แบบ binary เดิมที่ไม่มี `data` ตอบ `400 VALIDATION_ERROR` และไม่รับ request alias `answer`

### Backend raw role / action / scope matrix

ตารางนี้เป็น backend reference ของ role defaults และ location scope ที่ seed/runtime ใช้จริง ใช้เป็นค่าเริ่มต้นสำหรับ `role_default` และไม่ใช่เพดานของ `custom` ค่าในตารางเป็น **raw permission code** ไม่ใช่ JSON key ที่ Frontend ต้องสร้าง สำหรับเมนูขอเชื่อมต่อ Frontend ต้องอ่านผ่าน `permissions.connection.*` ตาม mapping ด้านบน ค่า Chat ปัจจุบันมาจาก [06_role_permissions.ts](../../../../../backend/src/db/seeds/06_role_permissions.ts) และ migration `0142_scope_chat_permissions`; raw matrix `rbac_matrix_v20260810.ts` ใช้เป็นข้อมูลประวัติสำหรับ migration รุ่นเดิม

| Role | Dashboard / Search / Stats | Factories | Eligible factories | Connection requests (raw backend code) | KWP forms | BOD/COD | Notifications | Helpdesk / Feedback / Chat | Permission admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `public_anonymous` | `dashboard:view=ALL` | - | - | - | - | - | - | `feedback:submit`, `laws:view`, `faq:view` | - |
| `public_user` | `dashboard:view=ALL`, `dashboard.alerts:view` | - | - | - | - | - | - | `feedback:submit`, `laws:view`, `faq:view`, `chat:view`, `chat:ask` | - |
| `factory_operator` | `dashboard:view=OWN_FACTORY`, `dashboard.alerts:view`, `dashboard.stats:view=OWN_FACTORY`, `dashboard.stats:export=OWN_FACTORY` | `factories:view=OWN_FACTORY`, `factories:edit` | `eligible_factories:view=OWN_FACTORY` | `cems_wpms_requests:view=OWN_FACTORY`, `cems_wpms_requests:edit` | `kwp_forms:view=OWN_FACTORY`, `kwp_forms:edit` | `bod_cod_errors:view=OWN_FACTORY`, `bod_cod_errors:edit` | `notifications:view=OWN_FACTORY` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=OWN_FACTORY`, `chat:ask=OWN_FACTORY` | - |
| `diw_central` | `dashboard:view=ALL`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=ALL`, `dashboard.stats:export=ALL`, `conditional_search:view=ALL`, `statistics:view=ALL`, `statistics:export=ALL` | `factories:view=ALL` | `eligible_factories:view=ALL` | - | `kwp_forms:view=ALL` | `bod_cod_errors:view=ALL` | `notifications:view=ALL` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=ALL`, `chat:ask=ALL` | - |
| `provincial_office` | `dashboard:view=IN_PROVINCE`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_PROVINCE`, `dashboard.stats:export=IN_PROVINCE`, `conditional_search:view=IN_PROVINCE`, `statistics:view=IN_PROVINCE`, `statistics:export=IN_PROVINCE` | `factories:view=IN_PROVINCE` | `eligible_factories:view=IN_PROVINCE` | - | `kwp_forms:view=IN_PROVINCE` | `bod_cod_errors:view=IN_PROVINCE` | `notifications:view=IN_PROVINCE` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=IN_PROVINCE`, `chat:ask=IN_PROVINCE` | - |
| `industrial_estate` | `dashboard:view=IN_ESTATE`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_ESTATE`, `dashboard.stats:export=IN_ESTATE`, `conditional_search:view=IN_ESTATE`, `statistics:view=IN_ESTATE`, `statistics:export=IN_ESTATE` | `factories:view=IN_ESTATE` | `eligible_factories:view=IN_ESTATE` | - | `kwp_forms:view=IN_ESTATE` | `bod_cod_errors:view=IN_ESTATE` | `notifications:view=IN_ESTATE` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=IN_ESTATE`, `chat:ask=IN_ESTATE` | - |
| `erc_office` | `dashboard:view=FACTORY_TYPE_88`, `dashboard.alerts:view`, `dashboard.search:basic=FACTORY_TYPE_88`, `dashboard.search:advanced=FACTORY_TYPE_88`, `dashboard.stats:view=FACTORY_TYPE_88`, `dashboard.stats:export=FACTORY_TYPE_88`, `conditional_search:view=FACTORY_TYPE_88`, `statistics:view=FACTORY_TYPE_88`, `statistics:export=FACTORY_TYPE_88` | `factories:view=FACTORY_TYPE_88` | `eligible_factories:view=FACTORY_TYPE_88` | `cems_wpms_requests:view=FACTORY_TYPE_88` | `kwp_forms:view=FACTORY_TYPE_88` | `bod_cod_errors:view=FACTORY_TYPE_88` | `notifications:view=FACTORY_TYPE_88` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=FACTORY_TYPE_88`, `chat:ask=FACTORY_TYPE_88` | - |
| `monitoring_kpm` | `dashboard:view=IN_REGION (ภาคกลาง)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (ภาคกลาง)`, `dashboard.stats:export=IN_REGION (ภาคกลาง)`, `conditional_search:view=IN_REGION (ภาคกลาง)`, `statistics:view=IN_REGION (ภาคกลาง)`, `statistics:export=IN_REGION (ภาคกลาง)` | `factories:view=IN_REGION (ภาคกลาง)`, `factories:edit` | `eligible_factories:view=IN_REGION (ภาคกลาง)` | `cems_wpms_requests:view=IN_REGION (ภาคกลาง)`, `cems_wpms_requests:edit`, `cems_wpms_requests:approve`, `cems_wpms_requests:direct_connect=IN_REGION (ภาคกลาง)` | `kwp_forms:view=IN_REGION (ภาคกลาง)`, `kwp_forms:edit`, `kwp_forms:approve` | `bod_cod_errors:view=IN_REGION (ภาคกลาง)`, `bod_cod_errors:edit`, `bod_cod_errors:approve=IN_REGION (ภาคกลาง)` | `notifications:view=IN_REGION (ภาคกลาง)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=IN_REGION (ภาคกลาง)`, `chat:answer=IN_REGION (ภาคกลาง)` | - |
| `monitoring_5_centers` | `dashboard:view=IN_REGION (assigned region)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (assigned region)`, `dashboard.stats:export=IN_REGION (assigned region)`, `conditional_search:view=IN_REGION (assigned region)`, `statistics:view=IN_REGION (assigned region)`, `statistics:export=IN_REGION (assigned region)` | `factories:view=IN_REGION (assigned region)`, `factories:edit` | `eligible_factories:view=IN_REGION (assigned region)` | `cems_wpms_requests:view=IN_REGION (assigned region)` | `kwp_forms:view=IN_REGION (assigned region)`, `kwp_forms:edit`, `kwp_forms:approve` | `bod_cod_errors:view=IN_REGION (assigned region)`, `bod_cod_errors:edit`, `bod_cod_errors:approve=IN_REGION (assigned region)` | `notifications:view=IN_REGION (assigned region)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view`, `chat:view=IN_REGION (assigned region)`, `chat:answer=IN_REGION (assigned region)` | - |
| `center_director` | `dashboard:view=IN_REGION (assigned region)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (assigned region)`, `dashboard.stats:export=IN_REGION (assigned region)`, `conditional_search:view=IN_REGION (assigned region)`, `statistics:view=IN_REGION (assigned region)`, `statistics:export=IN_REGION (assigned region)` | `factories:view=IN_REGION (assigned region)` | `eligible_factories:view=IN_REGION (assigned region)` | `cems_wpms_requests:view=IN_REGION (assigned region)` | `kwp_forms:view=IN_REGION (assigned region)` | `bod_cod_errors:view=IN_REGION (assigned region)`, `bod_cod_errors:approve=IN_REGION (assigned region)` | `notifications:view=IN_REGION (assigned region)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | - |
| `kpm_director` | `dashboard:view=IN_REGION (ภาคกลาง)`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=IN_REGION (ภาคกลาง)`, `dashboard.stats:export=IN_REGION (ภาคกลาง)`, `conditional_search:view=IN_REGION (ภาคกลาง)`, `statistics:view=IN_REGION (ภาคกลาง)`, `statistics:export=IN_REGION (ภาคกลาง)` | `factories:view=IN_REGION (ภาคกลาง)` | `eligible_factories:view=IN_REGION (ภาคกลาง)` | `cems_wpms_requests:view=IN_REGION (ภาคกลาง)` | `kwp_forms:view=IN_REGION (ภาคกลาง)` | `bod_cod_errors:view=IN_REGION (ภาคกลาง)`, `bod_cod_errors:approve=IN_REGION (ภาคกลาง)` | `notifications:view=IN_REGION (ภาคกลาง)` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | - |
| `kwp_director` | `dashboard:view=ALL`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=ALL`, `dashboard.stats:export=ALL`, `conditional_search:view=ALL`, `statistics:view=ALL`, `statistics:export=ALL` | `factories:view=ALL` | `eligible_factories:view=ALL` | `cems_wpms_requests:view=ALL` | `kwp_forms:view=ALL` | `bod_cod_errors:view=ALL`, `bod_cod_errors:approve=ALL` | `notifications:view=ALL` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | - |
| `admin` | `dashboard:view=ALL`, `dashboard.alerts:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view=ALL`, `dashboard.stats:export=ALL`, `conditional_search:view=ALL`, `statistics:view=ALL`, `statistics:export=ALL` | `factories:view=ALL`, `factories:edit`, `factories:approve` | `eligible_factories:view=ALL`, `eligible_factories:edit=ALL`, `eligible_factories:approve=ALL`, `eligible_factories:manage` (deprecated) | `cems_wpms_requests:view=ALL`, `cems_wpms_requests:edit`, `cems_wpms_requests:approve`, `cems_wpms_requests:direct_connect=ALL` | `kwp_forms:view=ALL`, `kwp_forms:edit`, `kwp_forms:approve` | `bod_cod_errors:view=ALL`, `bod_cod_errors:edit`, `bod_cod_errors:approve=ALL` | `notifications:view=ALL`, `notifications:view_status=ALL`, `notifications:edit`, `notifications:approve` | `helpdesk:submit`, `feedback:submit`, `laws:view`, `laws:edit`, `faq:view`, `faq:edit`, `chat:view=ALL`, `chat:answer=ALL` | `permissions:view`, `permissions:manage`, `users:view`, `users:edit`, `roles:view`, `roles:edit`, `audit:view`, `api_documentation:view` |

Admin default ไม่มี `chat:ask`; ผู้มี `permissions:manage` มอบ `chat:ask` และ scope ให้ admin หรือเจ้าหน้าที่เพื่อเปิดเรื่องได้ โดยไม่เปลี่ยน role. `public_user` มี Chat codes แต่ไม่มี scope โรงงานที่ใช้ได้และยังถูกจำกัด persona: options คืน `canCreate=false` รายการว่าง และ resource เฉพาะรายการตอบ `404`

### Explicit action-scope rules

ใช้กฎนี้เมื่อ matrix ข้างบนระบุ action แบบ binary โดยไม่ได้ใส่ `=SCOPE`

| Action family | Scope rule |
| --- | --- |
| `dashboard:view`, `dashboard.search:basic`, `dashboard.search:advanced`, `dashboard.stats:view`, `dashboard.stats:export`, `statistics:view`, `statistics:export`, `conditional_search:view`, `factories:view`, `eligible_factories:view`, `eligible_factories:edit`, `cems_wpms_requests:view`, `kwp_forms:view`, `bod_cod_errors:view`, `bod_cod_errors:approve`, `notifications:view`, `notifications:view_status` | ใช้ data scope ตาม role matrix เมื่อแถวนั้นระบุ scope ไว้ |
| `dashboard.alerts:view` | เป็น binary action ไม่มี data scope |
| `factories:*`, `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve`, `cems_wpms_requests:*`, `kwp_forms:*`, `bod_cod_errors:*`, `notifications:*` | `role_default` ใช้ scope ของ role ใน matrix; `custom` ใช้ scope ที่บันทึกสำหรับ action นั้น Backend บังคับ scope ตอนอ่าน/แก้ไข/อนุมัติและไม่ข้ามสถานะหรือขั้นตอนธุรกิจ |
| `eligible_factories:manage` | deprecated compatibility permission; เป็น binary action และมีใน admin default เท่านั้น |
| `chat:view`, `chat:ask`, `chat:answer` | scoped actions แยกกันและเป็นอิสระจาก eligible factories; default scope ตาม role ของ Chat; custom ใช้ scope/qualifier ที่บันทึกของแต่ละ action; ต้องมี scope ที่ใช้ได้จึงเข้าถึง resource |
| `laws:edit`, `faq:edit`, `users:view`, `users:edit`, `roles:view`, `roles:edit`, `permissions:*`, `audit:view`, `api_documentation:view` | เป็น binary action; contract ไม่เพิ่ม location field |
| `helpdesk:submit`, `feedback:submit`, `laws:view`, `faq:view` | เป็น binary action ใน approved target รอบนี้ |

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
| `chat:view`, `chat:ask`, `chat:answer` | runtime response มี `view`, `ask`, `edit` และ compatibility `answer`; Permission Management รับ/คืน `view`, `ask`, `edit` พร้อม `data`, `region`, `province`; request ไม่รับ `answer` |

Frontend ต้องใช้ grouped response เป็น canonical UI contract โดยเฉพาะ `permissions.connection.*`; raw permission code มีไว้สำหรับส่งกลับใน API ที่ระบุ field `code` และสำหรับ backend authorization เท่านั้น

### Region and location rules

| Case | Request / storage rule | Response rule |
| --- | --- | --- |
| `IN_REGION` | รับ `region` เป็น string; ใช้ภาคที่ระบุรายเมนูก่อน ถ้าไม่ส่งให้ใช้ภาคเริ่มต้นจากโปรไฟล์ ถ้าไม่มีทั้งสองแหล่งตอนบันทึก custom ตอบ `400 BAD_REQUEST`; ข้อมูลเดิม fail closed | grouped permissions คืนภาคเมนูเดิมแม้ต่างจากโปรไฟล์; ค่าเริ่มต้นของ `monitoring_kpm`/`kpm_director` ยังเป็นภาคกลาง |
| `IN_PROVINCE` | รับ `province` เป็นชื่อหรือรหัสจังหวัดและ resolve เป็น province id; ใช้จังหวัดเมนูก่อนค่าเริ่มต้นจากโปรไฟล์ | grouped permissions คืนชื่อจังหวัดไทย; การบันทึก custom ที่ไม่มี qualifier หรือค่าเริ่มต้นใช้ได้ตอบ `400 BAD_REQUEST`; ข้อมูลเดิมให้ไม่มีข้อมูล |
| `IN_ESTATE` | grouped และ raw API รับ `estateCode` หรือ compatibility field `estate` สำหรับหนึ่งนิคมและ resolve กับ master; ใช้นิคมรายเมนูก่อนค่าเริ่มต้นจากโปรไฟล์ | Permission Management group คืน `estateCode` เมื่อ `data: "IN_ESTATE"` เพื่อรักษา scope เมื่อส่งกลับ; runtime/raw contract คืน qualifier ที่มอบหมายไว้ |
| `OWN_FACTORY` | ไม่มี field location เพิ่มเติม | client เห็นเพียง `data: "OWN_FACTORY"` |
| `FACTORY_TYPE_88` | ไม่มี field location เพิ่มเติม; filter จาก factory type ที่เก็บใน eligible/snapshot/form | client เห็น `data: "FACTORY_TYPE_88"`; scope นี้แคบกว่า `ALL` แต่เทียบลำดับกับ region/province/estate ไม่ได้ |
| profile-level regional access | `profile.regionalAccess` เป็นคนละชั้นกับ per-menu permission scope | ใช้กับการกำหนดพื้นที่เจ้าหน้าที่ ไม่ใช่รายการ `permissions.<module>.region` |

การบันทึก custom `IN_REGION`, `IN_PROVINCE` หรือ `IN_ESTATE` ต้องได้ qualifier ที่ใช้ได้หลังเติม defaults และ resolve master มิฉะนั้นตอบ `400 BAD_REQUEST` การปิดสิทธิ์เมื่อ qualifier ไม่ครบเป็นกติกาสำหรับข้อมูลเดิมที่ runtime อ่านพบ

`profile.regionalAccess` กับ `permissions.<module>.region` จึงไม่ใช่ field แทนกัน:

- `profile.regionalAccess`, `profile.provinceId` และ `profile.estateCode` เป็นค่าเริ่มต้นสำหรับ permission ที่ไม่ได้ระบุพื้นที่รายเมนู
- `permissions.<module>.region` ใช้บันทึก override เฉพาะเมนู
- effective location ใช้ per-menu qualifier ก่อน profile default; ไม่มีทั้งสองแหล่งต้องไม่คืนข้อมูล และ location scopes ไม่ถูกกรองซ้ำด้วยภาคโปรไฟล์
- การแก้ region/province/estate assignment หรือส่ง `permissions`/`permissionOverrides`/top-level `permissionMode` ผ่าน PATCH ต้องมี `permissions:manage` แม้ route จะ authorize ด้วย `users:edit` ได้อยู่แล้ว; การสร้างบัญชีพร้อมสิทธิ์ custom ใช้กติกาเดียวกัน
- Direct Connection ใช้ `cems_wpms_requests:direct_connect` พร้อม action scope ที่บันทึก ไม่จำกัดด้วยชื่อ role หรือภาคกลาง; workflow อื่นยังตรวจ scope และสถานะ/ขั้นตอนที่ทำรายการได้

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
| Menu assignment | พื้นที่รายเมนูมีผลก่อน profile default; ถ้าไม่ระบุทั้งสองแหล่งเป็น no data และ token เดิมใช้สิทธิ์ล่าสุดตั้งแต่คำขอถัดไป |
| Custom permission snapshot | ใช้สิทธิ์ทั้งชุดที่บันทึก ไม่รับ role fallback; Raw PUT `[]` ไม่คืน role defaults และ grouped PATCH ปิด editable actions ที่ละไว้ |
| New codes | เพิ่ม `statistics:view`, `conditional_search:view`, `chat:view`, `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve` ใน target contract |
| Grouped permission aliases | `dashboard.search`, `dashboard.advanced_search`, `dashboard.statistics`, `dashboard.export`, `statistics.*`, `conditional_search.view`, `permissions.*`, `chat.edit` |
| Estate location detail | grouped Permission Management รองรับ `estateCode` รายเมนูเมื่อ IN_ESTATE และ `estate` compatibility alias; scope ยังคงหนึ่งนิคม |
| Chat scope/actions | บันทึก `chat.data` และเปิด/ปิด `view`, `ask`, `edit` ได้; `view` อย่างเดียวอ่านได้; เจ้าหน้าที่ที่มี `ask` เปิดเรื่องได้; `edit` ใช้ `chat:answer` เดิม; ดู [breaking change](../../CHANGELOG.md#chat-scoped-actions) |

Migration guidance:

- หาก client เดิมสร้าง UI จากเอกสาร legacy ให้ย้ายมาอ่าน canonical page นี้
- ถ้า admin UI แก้สิทธิ์รายเมนู ให้ส่ง grouped permission shape ผ่าน `PATCH /api/v1/users/:id` หรือส่ง permission code ดิบผ่าน `PUT /api/v1/users/:id/permissions`
- รัน migration `0136_add_user_permission_mode` ก่อนเริ่ม backend รุ่นนี้ บัญชี managed officer/admin ที่ไม่มีสิทธิ์รายคนใช้ `role_default`; บัญชี managed ที่มีสิทธิ์รายคนย้ายเป็น `custom` โดยใช้ `allow`/`deny` และพื้นที่ที่บันทึกไว้ก่อน แม้ action หรือ scope นั้นเคยถูก role กรองทิ้ง `deny` มีผลปิดสิทธิ์ ส่วน code ที่ไม่เคยบันทึกใช้ค่าเริ่มต้นของ role ตอนย้ายเพื่อสร้าง snapshot ทั้งชุด ผู้ที่มีค่าบันทึกแล้วไม่ต้องเลือกสิทธิ์ใหม่ Citizen/operator คง `role_default` และกติกา persona เดิม
- token ที่ยังไม่หมดอายุใช้สิทธิ์ล่าสุดจากฐานข้อมูล โดยยังตรวจลายเซ็น อายุ token และสถานะบัญชีตามปกติ Client เรียก `/auth/me` หลังแก้สิทธิ์เพื่อปรับเมนูและปุ่ม
- ใช้ PATCH `{ "permissionMode": "role_default" }` เมื่อต้องการคืนค่าเริ่มต้น; ดู [breaking change และขั้นตอนย้าย](../../CHANGELOG.md#custom-user-permission-snapshots)
- รัน `0142_scope_chat_permissions` เพื่อย้าย Chat grants เดิมที่ scope เป็น `null` ตามขอบเขต `eligible_factories:view` ที่มีผลก่อนย้าย รวม qualifier/custom/deny; ไม่เพิ่ม `ALL` เมื่อไม่มีขอบเขตที่อนุญาต และไม่เปิด action ที่ขาดหรือถูก deny ตรวจ Chat scope และ actions หลังย้ายแล้วใช้ scope ของ Chat อิสระจากโรงงานที่เข้าข่าย

### Implementation status notes

แหล่ง implementation และการตรวจโมเดลสิทธิ์:

| Area | Status |
| --- | --- |
| Approved role matrix vs code/seed alignment | baseline จาก `rbac_matrix_v20260810.ts` และ migration `0089`; Chat scope ปัจจุบันใช้ `06_role_permissions.ts` และ migration `0142` |
| New permission codes | implemented: `statistics:*`, `conditional_search:view`, `permissions:view`, `chat:view`, `eligible_factories:view/edit` |
| Regional role assignment | `monitoring_kpm`/`kpm_director` are fixed to ภาคกลาง; 5 ศูนย์/ผอ.ศูนย์ use assigned profile region |
| Province/estate assignment | สอจ. ใช้หนึ่งจังหวัด; กนอ. ใช้ canonical `estateCode` หนึ่งนิคมและเห็นทุกโรงงานในนิคมนั้น |
| Fail-closed enforcement | request, dashboard, eligible factory, KWP/BOD, alert, monitoring point, device config และ parameter reads ใช้ effective action scope ล่าสุด; qualifier รายเมนูมีผลก่อน profile fallback |
| Custom snapshot | การบันทึกสิทธิ์ไม่ติดเพดาน role, การเปลี่ยน role คง snapshot, reset ใช้ top-level `permissionMode` |
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
| Runtime custom contract tests | [users.custom-permissions.openapi.test.ts](../../../../../backend/tests/unit/users.custom-permissions.openapi.test.ts) |
| Current seed files to reconcile | [backend/src/db/seeds/04_roles.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/db/seeds/04_roles.ts:1), [backend/src/db/seeds/05_permissions.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/db/seeds/05_permissions.ts:1), [backend/src/db/seeds/06_role_permissions.ts](/Users/yuthsuwannadech/Documents/POMS-app/backend/src/db/seeds/06_role_permissions.ts:1) |
| Endpoint registry | [docs/backend/api/ENDPOINTS.md](../../ENDPOINTS.md) |
| Evidence | [ผลทดสอบ custom permission snapshots](../../../evidence/permissions/custom-permission-snapshots.tdd.md), [Permission matrix rollout evidence](../../../evidence/permissions/permission-matrix-rollout.tdd.md), [Permission Management contract alignment](../../../evidence/permissions/permission-management-contract-alignment.tdd.md) |
