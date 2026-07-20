# แผนปรับโครงสร้างบัญชี Login และ Frontend handoff

สถานะ: **Backend implemented in the current worktree; frontend และ production deployment ยังไม่ทำ**

ปรับปรุงล่าสุด: 2026-07-20

เอกสารนี้กำหนดแผนสำหรับบัญชี 3 ช่องทางที่ต้องใช้ response pattern เดียวกัน:

1. บัญชีที่ผู้ดูแลสร้างใน POMS
2. บัญชี DPIS ที่ login ด้วยชื่อทดสอบ เช่น `U100`
3. บัญชี i-Industry ที่ login ด้วยเลข 13 หลัก

เป้าหมายสำคัญคือบัญชีจากคนเดียวกันต้องยังเป็น **คนละ account** เมื่อ login คนละช่องทาง ห้ามรวมผู้ใช้ สิทธิ์ หรือประวัติการใช้งานด้วย `percardno` / `per_cardno`.

## ข้อตกลงหลัก

| เรื่อง | ข้อตกลง |
| --- | --- |
| ประเภทบัญชีที่ API เปิดเผย | `poms` หรือ `api` ผ่าน field `accountType` |
| Provider ภายใน | `local`, `diw_dpis`, `i_industry` รวมถึง provider เดิมของ operator/citizen และไม่ส่งออกใน auth response |
| Internal user ID | ใช้ `users.id` เป็น PK, JWT `sub`, FK และ audit ต่อไป แต่ไม่ส่งใน `/auth/login` หรือ `/auth/me` |
| บัญชี POMS | account key คือ username ที่สร้างใน POMS |
| บัญชี DPIS | account key คือ username ที่ผู้ใช้กรอก เช่น `U100` ไม่ใช่เลขบัตรที่ provider ตอบกลับ |
| บัญชี i-Industry | account key คือ username เลข 13 หลัก โดยเก็บ/ส่งเป็น JSON string |
| Person reference | ไม่ใช้ `percardno` / `per_cardno` เพื่อค้นหา รวม หรือย้ายสิทธิ์ข้าม account |
| Division | ใช้ชื่อจาก upstream `division` เป็น `officerProfile.division`; ไม่ใช้ `division_id` |
| Role | ใช้ `roleCodes: string[]`; ไม่ใช้ division เพื่ออนุมานสิทธิ์ |
| Permissions | คง grouped permission shape เดิม เช่น `permissions.dashboard.view` และ `data` scope |

`accountType` ไม่ควรใช้แทน role:

- `accountType` บอกวิธีตรวจสอบตัวตน
- `userType` บอกชนิดผู้ใช้ เช่น `officer`, `admin`, `operator`, `citizen`
- `roleCodes` และ `permissions` บอกสิทธิ์ในระบบ

## Source-of-truth ภายใน

แนะนำให้ใช้ provider เป็น source-of-truth แล้ว derive `accountType` ตอนสร้าง response:

| Internal provider | Public `accountType` | Account key |
| --- | --- | --- |
| `local` | `poms` | POMS username |
| `diw_dpis` | `api` | username ที่ขึ้นต้นด้วย `U` เช่น `U100` |
| `i_industry` | `api` | username เลข 13 หลัก |
| `officer_dpis` | `api` | legacy compatibility เท่านั้น |
| `mock` | `api` | development/test เท่านั้น; ห้ามใช้เป็น production identity |

กติกากลางคือ `identity_provider = local` คืน `poms`; provider อื่นคืน `api`. ดังนั้น operator/citizen จากระบบภายนอกและ provider ใหม่ในอนาคตมี `accountType = api` โดยไม่ต้องเพิ่ม public enum ใหม่. Mock ใช้กติกานี้เฉพาะ environment ทดสอบ.

ไม่แนะนำให้เก็บ `users.account_type` ซ้ำตั้งแต่รอบแรก เพราะสามารถ derive จาก provider ได้แน่นอนและลดความเสี่ยงที่สองค่าไม่ตรงกัน หากอนาคตมีเหตุผลด้าน query performance จึงค่อยพิจารณา denormalize พร้อม constraint/verification.

## Target login request

Client ใหม่ไม่ต้องส่ง `accountType`. Backend เป็นผู้ resolve แหล่งบัญชีจาก provider-scoped local
lookup และผลการตรวจ credential โดยยังคงแยก POMS/API เป็นคนละ `users.id`.

### POMS account

```json
{
  "userType": "officer",
  "username": "local_officer",
  "password": "<password>"
}
```

### DPIS API account

```json
{
  "userType": "officer",
  "username": "U100",
  "password": "<password>",
  "departmentID": "2"
}
```

### i-Industry API account

```json
{
  "userType": "officer",
  "username": "1102000000000",
  "password": "<password>",
  "departmentID": "8"
}
```

Backend routing rule:

1. ค้นหา POMS account ด้วย `(identity_provider = local, external_id = submitted username)`.
2. ถ้า local credential ผ่าน ให้ login POMS ทันทีและไม่เรียก external API.
3. ถ้าไม่พบ local account หรือ local credential ไม่ผ่าน ให้ลอง external API ต่อ.
4. External officer ต้องมี `departmentID`; POMS officer ไม่ใช้ field นี้.
5. ภายใน API ให้ router แยก `diw_dpis` กับ `i_industry` จากรูปแบบ login identifier ที่ผ่าน validation.
6. ถ้า username/password เดียวกันผ่านทั้ง POMS และ API ให้ POMS มีลำดับก่อน.
7. ทั้งสองทางล้มเหลวต้องคืน generic `401 Invalid credentials` และไม่เปิดเผยว่าพบบัญชีในระบบใด.
8. ระหว่าง compatibility window ยังรับ legacy `accountType: poms|api` และ `provider: local` เป็น explicit route hint ได้ แต่ client ใหม่ไม่ควรส่ง field เหล่านี้.

เมื่อ client รุ่นเก่าส่ง explicit route hint ต้องคงพฤติกรรม strict routing: `poms`/`local` ตรวจเฉพาะ
local credential และ `api` ตรวจเฉพาะ external API. `user.accountType` ใน response ยังคง derive
จาก provider และไม่เชื่อค่าจาก request.

## Target auth response

ใช้กับ:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

`/auth/me` ใช้ `user` และ `permissions` pattern เดียวกัน แต่ไม่มี `accessToken`.

```json
{
  "accessToken": "<jwt-token>",
  "user": {
    "accountType": "api",
    "username": "U100",
    "userType": "officer",
    "fullName": "นายตัวอย่าง ผู้ใช้งาน",
    "name": {
      "prenameTh": "นาย",
      "firstName": "ตัวอย่าง",
      "lastName": "ผู้ใช้งาน",
      "fullName": "นายตัวอย่าง ผู้ใช้งาน"
    },
    "officerProfile": {
      "lineNameTh": "นักวิทยาศาสตร์",
      "levelNameTh": "ชำนาญการ",
      "mposition": null,
      "organize": {
        "id": "3010065",
        "name": "กลุ่มตัวอย่าง"
      },
      "division": "กองตัวอย่าง",
      "department": {
        "id": "3010000",
        "name": "กรมโรงงานอุตสาหกรรม"
      }
    },
    "roleCodes": [
      "diw_central"
    ],
    "isActive": true,
    "regionalAccess": null
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    },
    "factories": {
      "data": "ALL",
      "view": true
    }
  }
}
```

กติกา response:

- field ที่ไม่มีข้อมูลให้ส่ง `null`; ห้ามนำ ID มาใส่แทน display name.
- `mposition` ที่ upstream ส่งเป็น empty string ต้อง normalize เป็น `null`.
- `division` ต้อง trim whitespace และมาจากชื่อ `division` / `division_name_th` เท่านั้น.
- `organize.id` และ `department.id` เป็น string เพื่อรักษาเลขศูนย์นำหน้า.
- `roleCodes` เป็น array แม้มี role เดียว.
- `/auth/login` และ `/auth/me` ไม่ส่ง `id`, internal provider, `externalId`, `percardno`, `per_cardno`, `loginDisplay` หรือ `divisionId`.
- `officerProfile` เป็น object สำหรับ `officer`/`admin` ที่มี profile; สำหรับ `operator`/`citizen` ให้เป็น `null`.
- `regionalAccess` เป็น object หรือ `null` สำหรับ officer/admin ตาม flow เดิม.
- `ownedFactoryIds: string[]` ยังคงส่งสำหรับ operator ตาม flow เดิม และไม่ต้องส่งสำหรับ user type อื่น.
- operator/citizen ต้องใช้ `accountType` ตามกติกา `local => poms`, provider อื่น `=> api` และต้องมี regression tests แยกจาก officer.

## Field mapping เก่าไปใหม่

| Current field | Target field | หมายเหตุ |
| --- | --- | --- |
| ไม่มี | `user.accountType` | derive จาก internal provider |
| `user.username` | `user.username` | เปลี่ยน semantics ให้เป็น login identifier ของ account นั้น |
| `user.prenameTh` | `user.name.prenameTh` | legacy alias คงไว้ช่วงเปลี่ยนผ่านได้ |
| `user.firstName` | `user.name.firstName` | legacy alias คงไว้ช่วงเปลี่ยนผ่านได้ |
| `user.lastName` | `user.name.lastName` | legacy alias คงไว้ช่วงเปลี่ยนผ่านได้ |
| `user.fullName` | `user.fullName` | คงไว้เป็น display string หลัก |
| `user.lineNameTh` | `user.officerProfile.lineNameTh` | nullable; คงข้อมูล local/officer เดิม |
| `user.levelNameTh` | `user.officerProfile.levelNameTh` | nullable |
| `user.mposition` | `user.officerProfile.mposition` | empty string เป็น `null` |
| `user.organize` | `user.officerProfile.organize.name` | เพิ่ม `organize.id` แยก |
| `user.division` | `user.officerProfile.division` | ไม่มี `divisionId` |
| `user.department` | `user.officerProfile.department.name` | เพิ่ม `department.id` แยก |
| `user.roles` | `user.roleCodes` | string เปลี่ยนเป็น `string[]` |
| `user.source = created` | `user.accountType = poms` | ใช้ใน managed-user UI |
| `user.source = api` | `user.accountType = api` | ไม่เปิดเผย provider ย่อย |

## DB target design

### 1. ใช้ identity columns เดิมของ `users`

Requirement ปัจจุบันคือหนึ่ง login identity ต้องเป็นหนึ่ง `users.id` และห้าม link หลาย provider เข้าหา user เดียวกัน ดังนั้นยังไม่จำเป็นต้องเพิ่มตาราง `user_identities`.

Schema เดิมรองรับ requirement ได้ด้วย unique constraint ที่มีอยู่แล้ว:

```text
UNIQUE(identity_provider, external_id)
```

ต้องเปลี่ยน semantics ให้ชัดเจนดังนี้:

| `users.identity_provider` | `users.external_id` | `users.username` |
| --- | --- | --- |
| `local` | POMS username | POMS username |
| `diw_dpis` | username ที่กรอก เช่น `U100` | username ที่กรอก เช่น `U100` |
| `i_industry` | username เลข 13 หลัก | username เลข 13 หลัก |

`external_id` ใน model นี้หมายถึง **provider-scoped account key** ไม่ใช่ person identifier. Backend lookup ต้องใช้คู่ `(identity_provider, external_id)` เสมอ.

ข้อห้าม:

- ห้าม lookup external officer ด้วย `percardno` / `per_cardno`.
- ห้ามใช้ `findByUsername(username)` แบบไม่ระบุ provider ใน authentication flow.
- ห้ามเพิ่ม global unique constraint ที่ `users.username` เพราะ local `U100` และ API `U100` ต้องสามารถเป็นคนละ account ได้.
- ห้ามเพิ่ม `person_card_no` เพื่อนำไปค้นหา/link account ใน scope นี้; ถ้าต้องเก็บเพื่อวัตถุประสงค์ทางกฎหมายในอนาคตต้องออก privacy/access policy แยกก่อน.
- ไม่ต้องเพิ่ม `users.account_type`; derive `poms|api` จาก `identity_provider`.

คง columns เหล่านี้ไว้:

- `identity_provider`
- `external_id`
- `username`
- `password_hash`

`mock` และ provider ของ operator/citizen ที่มีอยู่ยังต้องทำงานต่อ; การ refactor officer ห้ามเปลี่ยน semantics ของ flow เหล่านั้นโดยไม่ได้ทดสอบ.

### 2. Legacy external officer rows

row ปัจจุบันที่ `identity_provider = officer_dpis` ใช้ `external_id = percardno/per_cardno` และจึงมี account semantics แบบเก่าที่กำกวม.

- ให้ถือ `officer_dpis` เป็น legacy provider ชั่วคราว.
- ห้าม bulk rename เป็น `diw_dpis` หรือ `i_industry` เพราะ DB ไม่มี username เดิม `U...` ให้ตัดสินแหล่งที่มาได้.
- login ใหม่ที่ local credential ไม่ผ่านและ external API ยืนยันสำเร็จ ต้อง provision/find account ด้วย provider ใหม่และ login identifier ที่ผู้ใช้กรอก.
- legacy row, role และ permission override ต้องผ่าน report/manual review ก่อน suspend หรือย้าย.
- ห้าม copy custom permission overrides จาก legacy row ไปทั้งสอง provider อัตโนมัติ.

### 3. `officer_profiles`

สถานะปัจจุบัน:

- มี `division_id` และ index `ix_officer_division`
- มี `department_name_th`
- migration `0071_add_officer_organization_names.ts` เพิ่ม `organize_name_th` และ `division_name_th`

Target:

- ใช้ `organize_id` + `organize_name_th`
- ใช้ `division_name_th` อย่างเดียวสำหรับ division response
- ใช้ `department_id` + `department_name_th`
- หยุดอ่าน/เขียน `division_id`

ห้าม drop `division_id` ใน migration เดียวกับการแก้ application.

## Migration plan แบบ expand–migrate–contract

### Phase 0 — Inventory และ backup evidence

- นับ user แยกตาม `identity_provider`, `user_type`, active status.
- หา user ที่ `identity_provider = officer_dpis` และสรุปว่า login identifier ต้นฉบับไม่สามารถกู้จาก row ปัจจุบันได้.
- สรุป role และ per-user permission override ของ legacy external officer โดยใช้ internal `users.id`; report ต้อง mask login identifiers.
- นับ `officer_profiles.division_name_th IS NULL` และตรวจว่า join `organizations(external_id, level='division')` ได้กี่รายการ.
- สำรองฐานข้อมูลตาม runbook ของ environment และบันทึก migration version ปัจจุบัน.

### Phase 1 — Schema expand เฉพาะ organization names

identity model รอบนี้ไม่ต้องสร้างตารางหรือ column ใหม่. งาน schema ที่จำเป็นมีเฉพาะ:

1. ตรวจ migration `0071_add_officer_organization_names.ts` ว่าถูก apply ใน environment แล้ว.
2. แยก data migration สำหรับ backfill `division_name_th` ออกจาก schema migration.
3. ยังไม่แก้/drop `division_id`, `identity_provider`, `external_id` หรือ username index เดิม.

Production ใช้ forward migration เป็นหลักและต้องทดสอบบนสำเนาข้อมูลก่อน apply.

### Phase 2 — Backend account-key cutover

- ให้ login validator รับ request หลักโดยไม่ต้องมี `accountType`; คง field เดิมไว้ชั่วคราวเพื่อ backward compatibility.
- เมื่อ request ไม่มี route hint ให้ตรวจ POMS ก่อนและ fallback ไป API เมื่อ local credential ไม่ผ่าน.
- เมื่อ request รุ่นเก่ามี `accountType` หรือ `provider=local` ให้คง strict routing เดิม.
- เปลี่ยน external identity adapter ให้คืน `provider`, `accountKey` และ profile แยกกัน.
- ส่ง username ที่ผู้ใช้กรอกเข้า parser/provisioning; ห้ามแทน account key ด้วย `per_cardno` ที่ upstream ตอบกลับ.
- lookup/upsert account ด้วย `(identity_provider, external_id)` โดย `external_id` คือ account key.
- external login แต่ละ provider ต้องสร้างคนละ `users.id`, คนละ role assignment, permission overrides และ audit trail.
- local account creation ใช้ `identity_provider=local` และตรวจ uniqueness แบบ provider-scoped.
- request ใหม่ไม่ส่ง `accountType`; response ยังคืน `user.accountType` ที่ derive จาก provider.
- JWT `sub` ยังคงเป็น internal `users.id`; ไม่ใส่ username เลข 13 หลักหรือ provider ลง JWT หาก middleware ไม่ต้องใช้.

### Phase 3 — Data backfill

Identity rows ใหม่ไม่ต้อง backfill เพราะใช้ตาราง `users` เดิม. Legacy officer เป็นกรณีพิเศษ:

- ระบบปัจจุบันเก็บ `external_id = per_cardno/percardno` และ overwrite `username` ด้วยค่านี้.
- จึงไม่สามารถรู้จาก DB อย่างแน่นอนได้ว่า row เดิมเกิดจาก login U-code ใด หรือจาก login เลข 13 หลัก.
- **ห้ามเดาและห้าม auto-merge** จากเลขบัตร.
- ให้สร้าง migration report สำหรับ admin review และ provision/find account ใหม่ตาม provider เมื่อ login สำเร็จครั้งถัดไป.
- การย้าย custom permission overrides จาก legacy row ไป account ใหม่ต้องเป็น admin-approved operation พร้อม audit; ห้าม copy ไปทั้งสอง account อัตโนมัติ.
- หลัง grace period และตรวจสอบ replacement account แล้ว จึงค่อย suspend legacy row ตามการอนุมัติของ admin.

Division name backfill ต้องเป็น data migration แยกต่างหาก:

1. เติม `division_name_th` เฉพาะ row ที่ยังว่าง.
2. join `organizations.external_id = officer_profiles.division_id` และ `organizations.level = 'division'`.
3. ไม่เขียนทับชื่อที่ได้จาก upstream V2 แล้ว.
4. รายการที่ join ไม่ได้ต้องรายงานเป็น unresolved; ห้ามนำ ID มาแสดงเป็นชื่อ.

### Phase 4 — API contract compatibility

การเปลี่ยน flat fields เป็น nested fields และ `roles: string` เป็น `roleCodes: string[]` เป็น breaking change.

แนวทางที่แนะนำ:

1. เพิ่ม `accountType`, `name`, `officerProfile`, `roleCodes` แบบ additive ใน `/api/v1`.
2. คง legacy aliases เช่น `roles`, `department`, `levelNameTh`, `organize`, `division` ชั่วคราว.
3. Deploy frontend ที่อ่าน target fields ก่อนและ fallback legacy fields ได้.
4. เก็บ metrics/error logs แบบไม่บันทึก PII เพื่อยืนยันว่า frontend ใหม่ทำงานแล้ว.
5. หากต้องการลบ legacy fields ให้เปิด `/api/v2` หรือกำหนด coordinated breaking release ที่ชัดเจน; ไม่ควรลบ field จาก v1 โดยไม่มี transition.

### Phase 5 — Division contract

หลัง backend ทุก instance หยุดอ่าน/เขียน `division_id` แล้ว:

1. ตรวจ `division_name_th` coverage และ unresolved report.
2. ลบ fallback ที่คืน `division_id` เป็น display string.
3. Deploy และ monitor อย่างน้อยหนึ่ง release.
4. migration ถัดไปจึง drop `ix_officer_division`.
5. drop `officer_profiles.division_id` ใน contract migration แยก.

ห้ามลบ division rows จาก `organizations` เพราะ master data อื่นอาจยังใช้งาน.

### Phase 6 — Legacy account cleanup

ทำได้เมื่อ frontend ใหม่ใช้งานแล้วและ legacy report ผ่านการตรวจสอบ:

- หยุดสร้าง/อ่าน provider `officer_dpis` ใน flow ใหม่.
- suspend legacy row เฉพาะรายการที่ admin ยืนยันแล้วว่ามี replacement account.
- คง `users.external_id` / `users.identity_provider` เพราะเป็น identity source-of-truth ของ model นี้.
- คง `users.username` สำหรับ display/audit แต่ authentication query ต้องใช้ provider + external_id.
- operator, citizen และ mock/seed ไม่ต้องย้าย provider ใน scope นี้.

## Backend work items

| Area | ไฟล์หลัก | สิ่งที่ต้องทำ |
| --- | --- | --- |
| Request validation | `backend/src/modules/auth/auth.validator.ts` | `accountType` ไม่บังคับ; คง legacy route hint และ validate common login fields |
| Auth DTO | `backend/src/modules/auth/auth.types.ts` | เพิ่ม target user contract และ compatibility fields |
| Login orchestration | `backend/src/modules/auth/auth.service.ts` | local-success-first แล้ว fallback API; legacy route hint ยังคง strict routing |
| Provider contract | `backend/src/modules/auth/identity-provider/identity-provider.interface.ts` | แยก account identity ออกจาก person/profile fields; เลิก `division_id` |
| Provider parser | `backend/src/modules/auth/identity-provider/diw-user-login.identity-provider.ts` | preserve input login name; normalize organization names; ไม่ใช้ percardno เป็น account key |
| Provider routing | `backend/src/modules/auth/identity-provider/index.ts` | route DPIS/i-Industry ภายในและรองรับ provider เพิ่มในอนาคต |
| Auth persistence | `backend/src/modules/auth/auth.repository.ts` | lookup/upsert ด้วย provider + account key; profile sync ไม่มี division_id |
| User management | `backend/src/modules/users/users.types.ts` | เปลี่ยน `source` เป็น `accountType`; ใช้ roleCodes |
| User validation | `backend/src/modules/users/users.validator.ts` | POMS/API edit rules; compatibility decoder |
| User service/repository | `backend/src/modules/users/users.service.ts`, `users.repository.ts` | provider-scoped lookup; username semantics; API identity read-only |
| Migrations | `backend/src/db/migrations/` | organization-name expand, division-name backfill และ division cleanup แยก migration |
| Tests | `backend/tests/unit/` | identity separation, response contract, migration, privacy logging |

จุด global-username behavior ที่ต้องแก้โดยตรง:

- `authRepository.findUserByUsername()` ห้ามใช้เป็น account lookup โดยไม่มี provider.
- `usersRepository.findByUsername()` และ `usersService.ensureUniqueIdentity()` ต้องตรวจซ้ำแบบ provider-scoped.
- managed-user validator ต้องหยุดผูก `externalId = user.username` สำหรับ API account; local endpoint เท่านั้นที่ตั้งสองค่าเท่ากันได้.
- query/list สำหรับ display สามารถอ่าน `users.username` ได้ แต่การ authenticate/update identity ต้องใช้ `(identity_provider, external_id)`.

Role resolution สำหรับ external officer ยังคงอิง `department_id` + `department_name_th`; ไม่ใช้ division. Base organization role ของแต่ละ account sync แยกกัน และ roles/overrides ของอีก account ต้องไม่ถูกอ่านหรือแก้ตาม.

## Frontend handoff

รอบนี้ยังไม่แก้ไฟล์ frontend. เมื่อ backend compatibility response พร้อมแล้ว frontend ต้องทำตามรายการนี้.

### 1. Login dialog

ไฟล์หลัก: `frontend/src/components/DpomsLoginDialog.jsx`

- ไม่ต้องเพิ่มตัวเลือกหรือส่ง `accountType`; backend เป็นผู้ resolve POMS/API.
- ส่ง `departmentID` สำหรับ officer flow เพื่อให้ fallback ไป API ได้; POMS จะไม่ใช้ค่า field นี้.
- ห้าม frontend ส่งชื่อ internal provider เช่น `diw_dpis` หรือ `i_industry`.
- อ่าน `user.accountType` จาก response หาก UI ต้องแสดงแหล่งบัญชี.

### 2. Auth normalization

ไฟล์หลัก: `frontend/src/App.jsx`

- อ่าน `response.user.accountType`.
- ใช้ `response.user.fullName` เป็น display name ก่อน `response.user.name` เพราะ `name` ใหม่เป็น object.
- เปลี่ยน role lookup จาก `user.roles` string เป็น `user.roleCodes[0]` หรือ logic ที่รองรับหลาย role.
- คงการอ่าน `permissions` แบบเดิม.
- เพิ่ม fallback fields ชั่วคราวระหว่าง backend rollout.
- version key ของข้อมูล auth ที่เก็บใน browser หรือ clear auth state เก่าหลัง deploy contract ใหม่.

ข้อควรระวัง: ปัจจุบัน raw login response ถูกเก็บใน `localStorage`. เมื่อ `username` เป็นเลข 13 หลัก ข้อมูลดังกล่าวจะถูกเก็บใน browser ด้วยตาม requirement. Frontend ต้องไม่ log response, ต้องลบเมื่อ logout และควรประเมินการเปลี่ยนไปใช้ secure HttpOnly cookie/session design แยกเป็น security task.

### 3. App bar

ไฟล์หลัก: `frontend/src/components/DpomsAppBar.jsx`

- ต้องรับ display name เป็น string เท่านั้น.
- ห้ามส่ง `user.name` object เข้า code ที่เรียก `.split(' ')`.

### 4. Permission management

ไฟล์หลัก: `frontend/src/pages/PermissionManagementPage.jsx`

Mapping สำหรับ `GET /api/v1/users` (table summary):

| UI value | Target list row |
| --- | --- |
| แหล่งบัญชี | `row.accountType` |
| Provider (เฉพาะ Admin) | `row.identityProvider` |
| Username | `row.username` |
| ชื่อเต็ม | `row.fullName` |
| หน่วยงาน | `row.department` |
| สายงาน | `row.lineNameTh` |
| ระดับ | `row.levelNameTh` |
| Role | `row.roleCodes` |
| สถานะ | `row.isActive` |

Mapping สำหรับ `GET /api/v1/users/:id` (managed-user edit detail):

| UI value | Target detail response |
| --- | --- |
| แหล่งบัญชี | `response.user.accountType` |
| Provider (เฉพาะ Admin) | `response.user.identityProvider` |
| Username | `response.user.username` |
| ชื่อเต็ม | `response.user.fullName` |
| หน่วยงาน | `response.user.department` |
| สายงาน | `response.user.lineNameTh` |
| ระดับ | `response.user.levelNameTh` |
| Role | `response.user.roleCodes` |
| สถานะ | `response.user.isActive` |

กติกา edit:

- `accountType = api`: username/account type/provider เป็น read-only; แก้ได้เฉพาะ status, roleCodes และ permission overrides.
- `accountType = poms`: แก้ username/password ตาม policy ของ local account ได้.
- หยุดส่ง `source: created|api` หลัง backend เปิด target request contract.
- ห้ามส่ง `accountType` เพื่อเปลี่ยนบัญชี POMS เป็น API หรือกลับกัน.
- `GET /api/v1/users` ยังมี internal `id` สำหรับหน้า admin ใช้เลือก resource; detail endpoint ระบุ id อยู่ใน URL และไม่จำเป็นต้องส่งซ้ำใน `user`. ข้อกำหนดไม่ส่ง `id` ใช้กับ `/auth/login` และ `/auth/me`.
- `identityProvider` ส่งได้เฉพาะ managed-user endpoints ที่มี `permissions:manage`; ใช้แยก `diw_dpis`, `i_industry`, `officer_dpis` legacy และ `local`. ห้ามนำ field นี้ไปเพิ่มใน public auth response.

### 5. Frontend API documentation page

ไฟล์หลัก: `frontend/src/pages/ApiDocumentationPage.jsx`

- เปลี่ยนตัวอย่าง `roles` เป็น `roleCodes`.
- เปลี่ยน `source: created|api` เป็น `accountType: poms|api`.
- เปลี่ยน flat organization/profile fields เป็น nested target fields.
- ตัวอย่าง login request ไม่ส่ง `accountType`; response ยังคงแสดง `user.accountType`.

### 6. จุดที่ไม่ต้องเปลี่ยนถ้า permissions contract คงเดิม

- menu permission checks เช่น `permissions.<module>.view`
- permission data scopes: `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, `null`
- `Authorization: Bearer <token>` และ JWT `sub` semantics

## Managed-user API contract ที่ต้องตกลงก่อน implementation

Backend และ frontend ต้อง freeze contract ของ endpoint ต่อไปนี้พร้อมกัน:

| Endpoint | ข้อตกลงที่ต้อง freeze |
| --- | --- |
| `POST /api/v1/auth/login` | request ไม่บังคับ accountType; backend resolve account; response คืน derived accountType |
| `GET /api/v1/auth/me` | user/permissions shape เดียวกับ login |
| `GET /api/v1/users` | list fields, accountType, roleCodes, internal id |
| `GET /api/v1/users/:id` | canonical user detail + permissions |
| `POST /api/v1/users/local-accounts` | สร้าง `poms/local` identity ใน transaction เดียว |
| `PATCH /api/v1/users/:id` | API identity read-only; POMS identity edit policy |

ไม่ควรเปลี่ยนเฉพาะ login response แล้วปล่อย `/users/:id` ใช้ username/source semantics เดิม เพราะหน้า Permission Management จะอ่านและเขียนกลับผิดรูปแบบ.

### Managed-user detail response

`GET /api/v1/users/:id` คง managed-user edit shape แบบ flat เพื่อไม่ทำให้หน้าจัดการสิทธิ์เดิมพัง และเพิ่ม `accountType`, `identityProvider`, `roleCodes` แบบ additive. Canonical nested `name`/`officerProfile` ใช้กับ `/auth/login` และ `/auth/me` ในรอบนี้:

```json
{
  "user": {
    "accountType": "api",
    "identityProvider": "diw_dpis",
    "username": "U100",
    "userType": "officer",
    "fullName": "นายตัวอย่าง ผู้ใช้งาน",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "diw_central",
    "roleCodes": [
      "diw_central"
    ],
    "isActive": true,
    "source": "api"
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    }
  }
}
```

`GET /api/v1/users` เป็น table summary จึงส่งอย่างน้อย `id`, `accountType`, `identityProvider`, `username`, `fullName`, department display name, `lineNameTh`, `levelNameTh`, `roleCodes` และ `isActive`. ห้ามส่ง `externalId` แยกจาก username.

### Create POMS account request

`POST /api/v1/users/local-accounts` เป็น endpoint เฉพาะ POMS จึงไม่รับ `accountType`, `identityProvider`, `externalId` หรือ `source` จาก client:

```json
{
  "user": {
    "fullName": "นายตัวอย่าง ผู้ใช้ POMS",
    "username": "local_officer",
    "password": "<new-password>",
    "userType": "officer",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการอุตสาหกรรม",
    "levelNameTh": "ชำนาญการ",
    "roleCodes": [
      "diw_central"
    ],
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    }
  }
}
```

Backend สร้าง `identity_provider=local` และตั้ง `external_id=username` ภายใน transaction เดียว. `fullName`, department/line/level เป็น input สำหรับฟอร์ม; response หลังบันทึกต้อง normalize กลับเป็น canonical nested user shape.

### Update POMS account request

`PATCH /api/v1/users/:id` สำหรับ `accountType=poms`:

```json
{
  "user": {
    "fullName": "นายตัวอย่าง ผู้ใช้ POMS",
    "username": "local_officer",
    "password": "",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการอุตสาหกรรม",
    "levelNameTh": "ชำนาญการ",
    "roleCodes": [
      "diw_central"
    ],
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    }
  }
}
```

empty password หมายถึงไม่เปลี่ยนรหัสผ่าน. Backend ต้องตรวจ uniqueness ของ username ภายใน provider `local` เท่านั้น.

### Update API account request

`PATCH /api/v1/users/:id` สำหรับ `accountType=api` รับเฉพาะ field ที่ไม่ใช่ external identity/profile:

```json
{
  "user": {
    "roleCodes": [
      "diw_central"
    ],
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    }
  }
}
```

API-account PATCH แบบ canonical จะ reject เมื่อพยายามเปลี่ยน identity, password, name หรือ officer profile. เพื่อรองรับ frontend เดิมชั่วคราว response-shaped payload ที่ระบุ `source: "api"` และ echo ค่าเดิมกลับมาจะถูก validator ตัด field ที่ provider เป็นเจ้าของออกก่อน update; frontend ใหม่ควรส่งเฉพาะ `isActive`, `roleCodes` และ permission overrides.

## Test plan

### Backend unit/integration

- [x] POMS, DPIS และ i-Industry ใช้ user response builder เดียวกัน.
- [x] operator/citizen คืน `accountType` จาก provider และยังคง `ownedFactoryIds` behavior เดิม.
- [x] `accountType=poms` ไม่เรียก external API.
- [x] `accountType=api` ไม่ตรวจ local password.
- [x] request ที่ไม่ส่ง `accountType` และ local credential ผ่านต้องเข้า POMS โดยไม่เรียก external API.
- [x] request ที่ไม่ส่ง `accountType` และ local credential ไม่ผ่านต้อง fallback ไป API.
- [ ] DPIS `U...` และ i-Industry เลข 13 หลักที่ upstream คืน `percardno` เดียวกันสร้างคนละ `users.id`.
- [ ] สอง account ข้างต้นมี role, permission override และ audit history แยกกัน.
- [x] local กับ API ใช้ provider-scoped lookup; request ใหม่ไม่ต้องเลือก account ด้วย `accountType`.
- [x] managed-user รองรับ `roleCodes` และ reject canonical identity/profile update ของ API account; `source` ยังรับชั่วคราวเพื่อ compatibility.
- [x] managed-user admin response มี `identityProvider` แต่ `/auth/login` และ `/auth/me` ไม่มี field นี้.
- [ ] `/auth/me` คืน user/permissions เดียวกับ login โดยไม่มี accessToken.
- [x] auth response ไม่มี internal provider, externalId, percardno, divisionId หรือ internal user id.
- [ ] organization IDs ยังคงเป็น string และ preserve leading zero.
- [ ] empty upstream strings เป็น `null`; display names trim whitespace.
- [ ] permission grouping และ JWT authorization middleware ไม่เปลี่ยน behavior.
- [ ] log ไม่มี password, client ID, full username เลข 13 หลัก หรือ upstream raw `msg`.

### Migration tests

- [ ] schema migration up/down ทำงานบน MSSQL.
- [ ] unique `(identity_provider, external_id)` ป้องกัน account key ซ้ำใน provider เดียว.
- [ ] username เดียวกันอยู่คนละ provider ได้และได้คนละ `users.id`.
- [ ] ambiguous legacy officer rows ถูก report/skip ไม่ถูก merge.
- [x] division-name backfill ไม่ overwriteชื่อที่มีอยู่; unresolved-row report ยังเป็นงานก่อน deploy.
- [ ] contract migration drop index ก่อน drop `division_id`.

### Frontend

- [ ] login ได้ทั้ง POMS, DPIS และ i-Industry.
- [ ] app bar แสดง fullName และไม่ crash จาก nested `name` object.
- [ ] role/menu ใช้ `roleCodes` และ grouped permissions ถูกต้อง.
- [ ] refresh/reload อ่าน auth storage เวอร์ชันใหม่ได้.
- [ ] Permission Management แสดง `poms`/`api` ถูกต้อง.
- [ ] API username เป็น read-only; POMS username/password แก้ได้ตาม policy.
- [ ] list/detail/edit round-trip แล้ว role และ permissions ไม่หาย.

### E2E security scenarios

- [ ] มี local `U100` และ API `U100` พร้อมกัน แล้วแต่ละ account login/ได้สิทธิ์ของตนเอง.
- [ ] API สอง provider คืน person number เดียวกันแต่ไม่มีการแชร์ user ID หรือสิทธิ์.
- [ ] legacy `accountType` route hint ไม่ทำให้ bypass password หรือ fallback ข้าม provider.
- [ ] request ไม่มี `accountType` ใช้ POMS เมื่อ local credential ผ่าน และใช้ API เมื่อ local credential ไม่ผ่าน.
- [ ] suspend account หนึ่งไม่กระทบ account อื่นของบุคคลเดียวกัน.

## Deployment order

1. ตรวจ inventory, backup และ ambiguous legacy report.
2. ตรวจ/apply schema organization-name expand และ backfill division names.
3. Deploy backend provider-scoped account-key flow และ additive response aliases.
4. ปล่อยให้ login ใหม่ provision account ใหม่ตาม provider; legacy row ยังไม่ถูก merge หรือย้ายสิทธิ์อัตโนมัติ.
5. Deploy/ยืนยัน frontend ที่ไม่ส่ง accountType และอ่าน derived accountType จาก response.
6. Monitor login success/failure แยก provider ด้วย aggregate metrics ที่ไม่มี PII.
7. หลัง client ทุกตัวพร้อม ให้ประกาศ deprecation ของ request `accountType`/`provider`; การลบจริงทำใน API version ที่ประกาศไว้.
8. ตัด legacy response aliasesใน API version/release ที่ประกาศไว้.
9. หยุดใช้แล้วจึง drop division index/column; ตรวจและ suspend เฉพาะ legacy `officer_dpis` rows ที่ admin ยืนยันแล้ว โดยคง identity columns ของ `users` เป็น model หลัก.

Rollback application ให้กลับไปใช้ legacy flow ได้เฉพาะช่วง compatibility. Account ที่ provision ด้วย provider ใหม่ต้องคงเป็นคนละ row; ห้าม rollback ด้วยการเปลี่ยน provider/account key หรือรวมข้อมูลกลับตามเลขบุคคล.

## Acceptance criteria ก่อนถือว่าเสร็จ

- [x] บัญชีทั้งสามช่องทางใช้ auth response builder/pattern เดียวกันใน backend.
- [x] Frontend ไม่ส่ง `accountType` และไม่รู้ internal provider.
- [x] U-prefixed DPIS กับเลข 13 หลักใช้ provider + submitted login key คนละชุด ไม่ใช้ person number.
- [x] POMS local account แยกจาก API account ด้วย provider-scoped lookup แม้ username ตรงกัน.
- [x] application ไม่รับ/อ่าน/เขียน `division_id` แล้ว; column และ index เดิมคงอยู่ชั่วคราวเพื่อให้ migration `0072` backfill legacy display names ก่อน drop ในรอบถัดไป.
- [ ] role/permission/audit ยึด internal `users.id` ของแต่ละ account.
- [ ] migration ไม่มี destructive schema change ก่อน application cutover.
- [ ] legacy ambiguous users มี report และ manual decision; ไม่มี auto-merge.
- [ ] Backend tests, typecheck และ frontend contract/E2E tests ผ่านตาม scope.
- [ ] ไม่มี credential หรือเลขประจำตัวจริงใน source code, test fixtures, docs และ logs.

## เอกสารที่ต้องอัปเดตเมื่อเริ่ม implementation จริง

- `docs/API.md` — auth และ managed-user contract หลัก
- `docs/APIDoc/live-api-responses/01-auth-and-root.md` — response snapshot หลัง deploy/test จริง
- `docs/APIDoc/DERIVED_FIELD_LOGIC.md` — accountType, username, roleCodes และ organization/profile mapping
- `docs/user-auth-permission/04-data-dictionary-er.html` — semantics ของ provider/account key และ division schema หลัง cleanup
- `docs/user-auth-permission/01-role-permission-summary.html` — roleCodes และ response fields
- `frontend/src/pages/ApiDocumentationPage.jsx` — ทำเมื่อได้รับคำสั่งให้แก้ frontend โดยตรง

เอกสารนี้เป็น frontend handoff และสถานะ implementation ใน local worktree ไม่ใช่หลักฐานว่า migration หรือ contract ใหม่ถูก deploy แล้ว.