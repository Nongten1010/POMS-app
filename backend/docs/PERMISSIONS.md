# POMS — สิทธิ์การใช้งาน & User Types

> สรุปจาก `ข้อมูลระบบ.xlsx` (sheet: สิทธิ์การใช้งาน) + ไฟล์ตัวอย่าง login response
> ใช้เป็น single source of truth สำหรับ implement RBAC ใน backend

---

## 1. บริบทระบบ

**POMS** (Pollution Online Monitoring System) — ระบบมอนิเตอร์มลภาวะจากโรงงานอุตสาหกรรม
หน่วยงาน: **กรมโรงงานอุตสาหกรรม** (กรอ.) / กระทรวงอุตสาหกรรม

### Sensor types & parameters
| Type    | Description                              | # Parameters |
| ------- | ---------------------------------------- | -----------: |
| CEMS    | Continuous Emissions Monitoring (อากาศจากปล่อง)     |       21 |
| WPMS    | Water Pollution Monitoring (น้ำเสีย)                |        5 |
| Mobile  | Mobile air monitoring (ตรวจวัดอากาศแบบเคลื่อนที่)    |      129 |
| Station | Fixed air monitoring station                       |      126 |

> Parameter list เต็มอยู่ใน `ข้อมูลระบบ.xlsx` (sheet: Parameter) — จะ seed เข้า table `parameters` ตอนเฟส sensor

---

## 2. User Types

ระบบมี **3 ตระกูล** ของ user แต่ละตระกูลมี **identity provider / login flow** ต่างกัน

### 2.1 ประชาชน (Citizen)
- **ไม่ login** — public anonymous (เห็นแค่หน้าหลักข้อมูลปัจจุบัน)
- **login** — citizen ที่สมัครใช้ระบบทั่วไป

### 2.2 ผู้ประกอบการ (Operator / Business)
- Login response ส่งกลับโครงสร้าง:
  ```
  citizen_id, userCode, userFirstName, userLastName, userPhone, userEmail
  JuristicList[]                  ← นิติบุคคล (บริษัท) ที่ผู้ใช้นี้เป็นตัวแทน
    └── JuristicID, JuristicNameTh, JuristicNameEn
        FactoryList[]             ← โรงงานของแต่ละนิติบุคคล
          └── fid, code, fname, system_id, verify_status,
              authorize_start, authorize_end, juristic_start, verify_date
  ```
- 1 user → many juristics → many factories (lookup ผ่าน citizen_id)
- `verify_status` (0/1) + `authorize_start/end` คือ effective window ที่ user เข้าถึงโรงงานนั้นได้

### 2.3 เจ้าหน้าที่ (Government Officer)
- Login response ส่งกลับ:
  ```
  per_cardno, prename_th, per_name, per_surname,
  pos_no, pertype, positiontype_th, line_id, linename_th, level_id, levelname_th,
  organize_id, organize_th, division_id, division,
  department_id, department, ministry_id, ministry,
  province_id, province_th, per_status, relocation_type, relocation_name
  ```
- มี **hierarchy 5 ชั้น**: ministry → department → division → organize → person
- `province_id` ใช้ scope สิทธิ์ของ **สอจ.** (สำนักงานอุตสาหกรรมจังหวัด)
- `department_id`, `division_id` ใช้แยก **กรอ.** / **กฝม.** / **กวภ.** / **5 ศูนย์ภูมิภาค**

> Login endpoint backend ควร return shape เดียวกัน (`{ userType, profile, scopes, permissions }`) แล้วให้ frontend handle จาก `userType` — ไม่ใช่ส่ง raw shape ต่างกัน

---

## 3. Role catalog (13 roles)

| # | Role code              | Thai label                             | English / scope                                                  |
| - | ---------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| 1 | `public_anonymous`     | ประชาชน ไม่ login                     | Public, no auth                                                  |
| 2 | `public_user`          | ประชาชน login                          | Logged-in citizen                                                |
| 3 | `factory_operator`     | โรงงาน (ผู้ประกอบการ)                  | Operator — scope: **โรงงานของตัวเอง**                            |
| 4 | `diw_central`          | กรอ.                                   | Department of Industrial Works HQ — scope: **ทั้งหมด**           |
| 5 | `provincial_office`    | สอจ.                                   | Provincial Industrial Office — scope: **ในจังหวัดของตัวเอง**     |
| 6 | `industrial_estate`    | กนอ.                                   | Industrial Estate Authority — scope: **ในการนิคมของตัวเอง**      |
| 7 | `monitoring_kpm`       | เจ้าหน้าที่ศูนย์เฝ้า (กฝม.)             | Pollution Monitoring Division officer — scope: **ทั้งหมด**       |
| 8 | `monitoring_5_centers` | เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์ภูมิภาค)    | Regional Center officer — scope: **ทั้งหมด**                     |
| 9 | `center_director`      | ผอ.ศูนย์                                | Center Director                                                  |
| 10 | `kpm_director`        | ผอ.กฝม.                                | Director of Pollution Monitoring Division                        |
| 11 | `kwp_director`        | ผอ.กวภ.                                | Director of กวภ.                                                 |
| 12 | `admin`               | Admin                                  | Super admin — เพิ่ม/แก้ทุก permission + จัดการสิทธิ์              |

> **เทคนิคการ implement:** 1 user สามารถมีหลาย role ได้ (เช่น user เดียวเป็น operator ของ 2 โรงงาน). Permission ของ user = **union** ของทุก role × scope ที่ตัวเองมี

---

## 4. Scope concept (สำคัญมาก!)

สิทธิ์ไม่ใช่ "True/False" อย่างเดียว — แต่มี **scope** ติดมาด้วย:

| Scope keyword     | Meaning                                          | Resolve เป็น                                       |
| ----------------- | ------------------------------------------------ | -------------------------------------------------- |
| `ALL`             | ทั้งหมด                                          | ไม่ filter — เข้าได้ทุกโรงงาน                       |
| `OWN_FACTORY`     | โรงงานตัวเอง                                     | `factory.id IN user.factory_ids`                   |
| `IN_PROVINCE`     | ในจังหวัด (ของ user)                              | `factory.province_id = user.province_id`           |
| `IN_ESTATE`       | ในการนิคม (ของ user)                              | `factory.industrial_estate_id = user.estate_id`    |
| `NONE`            | ไม่มีสิทธิ์เลย                                    | block                                              |

**Backend implementation pattern:**
```ts
// permission record (in DB)
{ role_id, permission_code, scope }
// e.g. { role_id: 'provincial_office', permission_code: 'factories:read', scope: 'IN_PROVINCE' }

// service layer applies scope to query
const factories = await factoriesRepo.list({
  filterByScope: req.user.scopes['factories:read'], // 'IN_PROVINCE'
  userContext: { provinceId: req.user.provinceId },
});
```

---

## 5. Feature / Permission matrix

### 5.1 หน้าหลัก (Dashboard)

| Sub-feature                           | Public no-login | Public login | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| ------------------------------------- | :-------------: | :----------: | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| View dashboard (scope)                | ALL             | ALL          | OWN    | ALL  | PROV | EST  | ALL  | ALL    | ALL      | ALL     | ALL     | ALL   |
| หน้าหลักข้อมูลปัจจุบัน                 | ✅               | ✅            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| ติดดาวแจ้งเตือน                       | —               | ✅            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| หน้าค้นหา                             | —               | —            | —      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| ค้นหาขั้นสูง                          | —               | —            | —      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| หน้าสถิติข้อมูล / ส่งออกข้อมูล         | —               | —            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |

### 5.2 ข้อมูลพื้นฐาน (Factory basic info)

| Action            | Public | Citizen | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| ----------------- | :----: | :-----: | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| View (scope)      | —      | —       | OWN    | ALL  | PROV | EST  | ALL  | ALL    | ALL      | ALL     | ALL     | ALL   |
| Edit              | —      | —       | ✅      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |
| Approve           | —      | —       | —      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |

### 5.3 ขอเชื่อมต่อระบบ CEMS / WPMS

| Action       | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| ------------ | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| View (scope) | OWN    | —    | —    | —    | ALL  | ALL    | ALL      | ALL     | ALL     | ALL   |
| Edit         | ✅      | —    | —    | —    | ✅    | —      | —        | —       | —       | ✅     |
| Approve      | —      | —    | —    | —    | ✅    | —      | —        | —       | —       | ✅     |

Implemented endpoint group:

```text
/api/v1/cems-wpms-requests
/api/v1/cems-wpms-requests/measurement-points
/api/v1/cems-wpms-requests/parameters
/api/v1/cems-wpms-requests/:id/form
/api/v1/cems-wpms-requests/:id/status
/api/v1/cems-wpms-requests/:id/device-configs
/api/v1/device-connections
/api/v1/parameter-values
```

Payload เต็มและ field mapping ของ CEMS/WPMS อยู่ที่ `../../docs/APIDoc/CEMS_WPMS_REQUEST_APIS.md`.

Workflow status:

| Status | Thai label | Owner action |
| --- | --- | --- |
| `PENDING_DESIGN_REVIEW` | รอพิจารณา | ผู้ประกอบการส่งฟอร์ม |
| `WAITING_FACTORY_REVISION` | รอโรงงานแก้ไข | เจ้าหน้าที่ขอให้แก้ไข |
| `REVISED_PENDING_DESIGN_REVIEW` | แก้ไขแล้ว/รอพิจารณา | ผู้ประกอบการส่งแบบที่แก้ไขแล้ว |
| `WAITING_CONNECTION` | รอเชื่อมต่อ | เจ้าหน้าที่อนุมัติแบบและระบบออกเลข `pointCode`, หรือเจ้าหน้าที่ส่งกลับให้แก้ config หลังผู้ประกอบการยืนยันแล้ว โดยใช้ deadline เดิมจาก `connectionDueAt` |
| `CONNECTION_CONFIRMED` | ยืนยันการเชื่อมต่อ | ผู้ประกอบการยืนยันว่าส่งค่าเข้าระบบได้แล้ว |
| `CONNECTED` | เชื่อมต่อแล้ว | เจ้าหน้าที่ตรวจค่าในระบบแล้ว |
| `CANCELED` | ยกเลิก | คำขอถูกยกเลิกและหยุดนับระยะเวลา; backend เปลี่ยนอัตโนมัติเมื่อครบ deadline แล้วค้าง `WAITING_CONNECTION` หรือเมื่อส่งกลับหลัง deadline หมดแล้ว |

Security behavior:
- `cems_wpms_requests:edit` ใช้สำหรับผู้ประกอบการสร้าง/แก้ไข/ยืนยัน request ของตัวเอง
- `cems_wpms_requests:edit` ใช้สำหรับสร้าง config และ mock test connection อุปกรณ์ตรวจวัด
- `cems_wpms_requests:approve` ใช้สำหรับเจ้าหน้าที่พิจารณาแบบ, ส่งกลับแก้ config ด้วย `RETURN_TO_WAITING_CONNECTION`, และ verify การเชื่อมต่อ
- request workflow list/detail ใช้ scope จาก `cems_wpms_requests:view`; scope `ALL` เห็นทั้งหมด, scope อื่นเห็นเฉพาะรายการที่ตัวเองสร้าง
- `/device-connections` GET ไม่ต้องใช้ token เพราะอุปกรณ์ client login ไม่ได้; `GET /device-connections` ต้องส่ง `stationId`
- `/device-connections` POST ยังใช้ `cems_wpms_requests:edit` สำหรับ create/test
- `/parameter-values` GET ใช้ token และ permission `cems_wpms_requests:view`; scope `ALL` เห็น station ที่มีใน `cems_wpms_measurement_points`, scope อื่นเห็นเฉพาะ station ของโรงงาน/นิติบุคคลตัวเองก่อนอ่านจาก `PARAMETER_DB_SCHEMA` เช่น `ingest.S0001_data_real`

### 5.4 แจ้งแบบ กวภ. 01 - กวภ. 05

| Action       | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| ------------ | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| View (scope) | OWN    | ALL  | PROV | EST  | ALL  | ALL    | ALL      | ALL     | ALL     | ALL   |
| Edit         | ✅      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |
| Approve      | —      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |

### 5.5 รายงานค่าความคลาดเคลื่อน BOD/COD Online

| Action       | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| ------------ | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| View (scope) | OWN    | ALL  | PROV | EST  | ALL  | ALL    | ALL      | ALL     | ALL     | ALL   |
| Edit         | ✅      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |
| Approve      | —      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |

### 5.6 การแจ้งเตือน (Notifications)

| Action               | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| -------------------- | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| View (scope)         | OWN    | ALL  | PROV | EST  | ALL  | ALL    | ALL      | ALL     | ALL     | ALL   |
| View สถานะแจ้งเตือน    | —      | —    | —    | —    | —    | —      | —        | —       | —       | ✅     |
| Edit                 | —      | —    | —    | —    | —    | —      | —        | —       | —       | ✅     |
| Approve              | —      | —    | —    | —    | —    | —      | —        | —       | —       | ✅     |

### 5.7 Cross-cutting features (everyone in scope)

| Feature                              | Public no-login | Public login | โรงงาน | กรอ. | สอจ. | กนอ. | กฝม. | 5 ศูนย์ | ผอ.ศูนย์ | ผอ.กฝม. | ผอ.กวภ. | Admin |
| ------------------------------------ | :-------------: | :----------: | :----: | :--: | :--: | :--: | :--: | :----: | :------: | :-----: | :-----: | :---: |
| สถิติข้อมูล                          | —               | —            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| การสืบค้นข้อมูลแบบมีเงื่อนไข           | —               | —            | —      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| แจ้งขอความช่วยเหลือ                   | —               | —            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| ข้อเสนอแนะ                            | —               | ✅            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| กฎหมายที่เกี่ยวข้อง (View)             | ✅               | ✅            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| กฎหมายที่เกี่ยวข้อง (Edit)             | —               | —            | —      | —    | —    | —    | —    | —      | —        | —       | —       | ✅     |
| คำถามที่พบบ่อย (View)                  | ✅               | ✅            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | ✅     |
| คำถามที่พบบ่อย (Edit)                  | —               | —            | —      | —    | —    | —    | —    | —      | —        | —       | —       | ✅     |
| Chat — Question                      | —               | ✅            | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅        | ✅       | ✅       | —     |
| Chat — Answer                        | —               | —            | —      | —    | —    | —    | ✅    | ✅      | —        | —       | —       | ✅     |
| จัดการสิทธิ์การใช้งาน                  | —               | —            | —      | —    | —    | —    | —    | —      | —        | —       | —       | ✅     |

> Legend: ✅ = อนุญาต, — = ไม่อนุญาต, ALL/PROV/EST/OWN = scope ดูข้อ 4

---

## 6. Permission code convention (สำหรับ backend)

ใช้รูปแบบ `<resource>:<action>` เพื่อให้ enforce ใน middleware ได้ง่าย:

| Resource             | Actions                    | Example codes                                         |
| -------------------- | -------------------------- | ----------------------------------------------------- |
| `dashboard`          | view                       | `dashboard:view`                                      |
| `dashboard.alerts`   | view, star                 | `dashboard.alerts:view`, `dashboard.alerts:star`      |
| `dashboard.search`   | basic, advanced            | `dashboard.search:basic`, `dashboard.search:advanced` |
| `dashboard.stats`    | view, export               | `dashboard.stats:view`, `dashboard.stats:export`      |
| `factories`          | view, edit, approve        | `factories:view`, `factories:edit`, `factories:approve` |
| `cems_wpms_requests` | view, edit, approve        | `cems_wpms_requests:view`, ...                        |
| `device_connections` | public read, edit          | GET ไม่ใช้ token, POST ใช้ `cems_wpms_requests:edit` ชั่วคราว     |
| `kwp_forms`          | view, edit, approve        | `kwp_forms:view`, ...                                 |
| `bod_cod_errors`     | view, edit, approve        | `bod_cod_errors:view`, ...                            |
| `notifications`      | view, view_status, edit, approve | `notifications:view`, `notifications:view_status`, ... |
| `helpdesk`           | submit, view, answer       | `helpdesk:submit`, ...                                |
| `feedback`           | submit, view               | `feedback:submit`, `feedback:view`                    |
| `laws`               | view, edit                 | `laws:view`, `laws:edit`                              |
| `faq`                | view, edit                 | `faq:view`, `faq:edit`                                |
| `chat`               | ask, answer                | `chat:ask`, `chat:answer`                             |
| `permissions`        | manage                     | `permissions:manage`                                  |
| `eligible_factories` | manage                     | `eligible_factories:manage`                           |
| `api_documentation`  | view                       | `api_documentation:view`                              |

**DB schema** (preview สำหรับเฟสถัดไป):
```sql
-- 1 permission อาจมีหลาย scope ใน different role
CREATE TABLE role_permissions (
  role_id            BIGINT NOT NULL,
  permission_code    VARCHAR(64) NOT NULL,
  scope              VARCHAR(16) NOT NULL  -- 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | 'NONE'
                                            -- (NULL ก็ได้ ถ้า action เป็น boolean ไม่มี scope)
  PRIMARY KEY (role_id, permission_code)
);
```

---

## 7. Approval workflow (สำคัญ — multi-feature)

ฟีเจอร์ที่มี action **Approve** จะใช้ approval workflow ร่วมกัน:
- ข้อมูลพื้นฐาน
- ขอเชื่อมต่อระบบ CEMS / WPMS
- แจ้งแบบ กวภ. 01-05
- รายงานค่าความคลาดเคลื่อน BOD/COD
- การแจ้งเตือน (Admin)

แนะนำให้แยกเป็น **`approvals/` module กลาง** ที่ feature อื่นเรียกใช้:
```
src/modules/approvals/
├── approvals.routes.ts        # GET /approvals?status=pending&type=factory_info
├── approvals.service.ts       # state machine: submitted → approved/rejected
├── approvals.repository.ts
└── approvals.types.ts         # ApprovalStatus, ApprovalType, etc.
```

State machine:
```
DRAFT ──submit──> SUBMITTED ──review──┬──approve──> APPROVED
                                       └──reject───> REJECTED ──resubmit──> SUBMITTED
```

---

## 8. Implementation checklist

ลำดับ implement ใน backend:

- [ ] Migration: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- [ ] Migration: `juristics`, `factories`, `provinces`, `industrial_estates`, `user_juristics`
- [ ] Migration: `organize_units` (ministry → department → division → organize hierarchy)
- [ ] Seed: 13 roles + permission codes + default scope mapping (ตามตารางข้อ 5)
- [ ] Seed: default admin user
- [ ] Auth module: login (3 flows: citizen, operator, officer), refresh, logout
- [ ] Middleware: `authenticate` (verify JWT, attach `req.user` พร้อม scopes)
- [ ] Middleware: `authorize(permissionCode)` + `applyScope(repo, permissionCode)`
- [ ] Approvals module (shared) — state machine + audit trail
- [ ] แต่ละ feature module ใช้ middleware + scope helper

---

## 9. Local account creation API

สำหรับ admin/เจ้าหน้าที่ที่มี `users:edit` หรือ `permissions:manage` ใช้สร้าง user แบบเก็บรหัสผ่านใน POMS เอง:

```http
POST /api/v1/users/local-accounts
Authorization: Bearer <admin-token>
Content-Type: application/json
```

Request:
```json
{
  "fullName": "สมชาย ทดสอบ",
  "username": "local_officer",
  "password": "StrongerPass123",
  "roleCodes": ["diw_central"],
  "permissionOverrides": [
    { "code": "chat:ask", "effect": "allow" }
  ]
}
```

Rules:
- ชื่อและสกุลรวมใน `fullName` ช่องเดียว
- ไม่รับ `email` และ `phone`
- `password` ถูก hash ด้วย bcrypt แล้วเก็บใน `users.password_hash`
- `roleCodes` ใช้ role catalog เดิม เช่น `diw_central`, `provincial_office`, `kpm_director`
- `permissionOverrides` ใช้เพิ่ม/ตัดสิทธิ์ราย user เมื่อ role ยังไม่พอ
- user ที่สร้างด้วย endpoint นี้ login ด้วย `POST /api/v1/auth/login` โดยส่ง `provider: "local"`

Local login:
```json
{
  "userType": "officer",
  "provider": "local",
  "username": "local_officer",
  "password": "StrongerPass123"
}
```

---

_Last updated from `ข้อมูลระบบ.xlsx` — ถ้ามีการแก้ใน xlsx ให้ regenerate ไฟล์นี้ใหม่_
