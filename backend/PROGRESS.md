# POMS Backend — Progress Log

ไฟล์นี้ใช้บันทึก **dev session** ทุกครั้งที่มีการเปลี่ยนแปลงโครงสร้าง/ตัดสินใจสำคัญ
รูปแบบ: `## YYYY-MM-DD — หัวข้อสั้น ๆ` แล้วใส่หัวข้อย่อย "What was done", "Decisions", "Next"

---

# 2026-05-27 — Device connection config API

**Added API for “ตั้งค่า connection อุปกรณ์ตรวจวัด”** ✅
- Added route group `POST|GET /api/v1/device-connections`
- Added mock connection test endpoint `POST /api/v1/device-connections/test-connection`
- Supported protocols:
  - `MODBUS_RTU`
  - `MODBUS_TCP`
  - `MSSQL`
  - `MYSQL`

**Contract decision** ✅
- All 4 protocols use the same shape:
  - `settings` = 1 connection point
  - `channels` = many measurement devices/channels under that connection point
- Mock behavior is selected by endpoint: `POST /device-connections/test-connection`
- Real config payload does not include a mock flag; `POST /device-connections` stores the real-ready config shape
- `GET /device-connections?stationId=STATION_001` returns fallback mock configs when DB has no real configs yet

**Database migration added** ✅
- `0020_create_device_connection_configs.ts`
- Tables:
  - `device_connection_configs`
  - `device_measurement_channels`

**Security and validation** ✅
- Public GET for device clients that cannot login; list requires `stationId`
- Uses existing permission `cems_wpms_requests:edit` for create/test
- Zod schemas reject unknown fields
- Validates IPv4, positive ports, positive COM/slave/quantity, `addressId >= 40001`
- Validates range objects with `min <= max`
- Prevents duplicate `addressId` inside one config
- Masks `settings.dbPass` as `********` in API responses

**Docs/tests updated** ✅
- Updated `README.md`
- Updated `docs/FRONTEND_HANDOFF.md`
- Updated `docs/API_TESTING.md`
- Updated `docs/PERMISSIONS.md`
- Updated `docs/SCHEMA.md`
- Updated `docs/WINDOWS_DEPLOYMENT.md`
- Updated `tests-manual.http`
- Added unit tests for validator and service mock connection behavior

**Verification**

```bash
npm test -- --runTestsByPath tests/unit/device-connections.service.test.ts tests/unit/device-connections.validator.test.ts
npm run typecheck
npm test
npm run build
```

Notes:
- `npm run lint` still fails because the repo has ESLint v10 but no `eslint.config.*`; this is pre-existing project config work.

---

# 2026-05-27 — CEMS/WPMS connection request API

**Added request form workflow for “ขอเชื่อมต่อ / เพิ่มจุดตรวจวัด”** ✅
- Added route group `POST|GET /api/v1/cems-wpms-requests`
- Added form resubmission endpoint `PUT /api/v1/cems-wpms-requests/:id/form`
- Added officer review endpoint `POST /api/v1/cems-wpms-requests/:id/review`
- Added operator confirmation endpoint `POST /api/v1/cems-wpms-requests/:id/confirm-connection`
- Added officer verification endpoint `POST /api/v1/cems-wpms-requests/:id/verify-connection`

**Status workflow implemented** ✅
- Case 1: `PENDING_DESIGN_REVIEW` → `WAITING_CONNECTION` → `CONNECTION_CONFIRMED` → `CONNECTED`
- Case 2: `PENDING_DESIGN_REVIEW` → `WAITING_FACTORY_REVISION` → `REVISED_PENDING_DESIGN_REVIEW` → `WAITING_CONNECTION` → `CONNECTION_CONFIRMED` → `CONNECTED`
- Backend enforces 30-day confirmation window after officer approves the design

**Database migration added** ✅
- `0019_create_cems_wpms_connection_requests.ts`
- Tables:
  - `cems_wpms_connection_requests`
  - `cems_wpms_measurement_points`
  - `cems_wpms_request_status_history`

**Security and validation** ✅
- Uses existing permissions `cems_wpms_requests:view|edit|approve`
- Zod schemas reject unknown fields and invalid coordinates
- Operator-only owner checks for resubmit/confirm
- Officer-only approve/verify checks via permission middleware

**Docs/tests updated** ✅
- Updated `docs/FRONTEND_HANDOFF.md`
- Updated `docs/API_TESTING.md`
- Updated `docs/PERMISSIONS.md`
- Updated `docs/SCHEMA.md`
- Updated `docs/WINDOWS_DEPLOYMENT.md`
- Added unit tests for validator and service state transitions

**Verification**

```bash
npm test -- --runInBand
npm run typecheck
npm run build
npx prettier --check docs/FRONTEND_HANDOFF.md docs/API_TESTING.md docs/PERMISSIONS.md docs/SCHEMA.md docs/WINDOWS_DEPLOYMENT.md README.md PROGRESS.md
```

Notes:
- `npm run lint` still fails because the repo has ESLint v10 but no `eslint.config.*`; this is pre-existing project config work.
- Full `npm run format:check` still reports unrelated pre-existing formatting issues in older backend files.

---

# 2026-05-24 — Local account creation API (session #9)

**Added `POST /api/v1/users/local-accounts`** ✅
- สร้าง user ด้วย `fullName` ช่องเดียว + `username` + `password`
- ไม่รับ `email` / `phone`
- เก็บ password เป็น bcrypt hash ใน `users.password_hash`
- Assign `roleCodes` ตาม PERMISSIONS เช่น `diw_central`, `provincial_office`, `kpm_director`
- รองรับ per-user `permissionOverrides` เหมือน endpoint permission override เดิม

**Added local login support** ✅
- `POST /api/v1/auth/login`
- payload เพิ่ม `provider:"local"` สำหรับ user ที่สร้างใน POMS
- response shape ยังเป็น `{ accessToken, user, profile, roles, scopes, permissions }`

**Permissions/docs updated** ✅
- เพิ่ม `chat:ask` ให้กลุ่มเจ้าหน้าที่ที่ยังขาดสิทธิ์นี้ เพื่อให้มีสิทธิ์พื้นฐานเหมือนประชาชน login
- อัปเดต `docs/PERMISSIONS.md`
- อัปเดต `docs/API_TESTING.md`

---

## 2026-05-24 — User permission overrides (session #8)

### What was done

**1. Added `user_permissions` table** ✅
- Migration `0016_create_user_permissions.ts`
- Per-user permission override with:
  - `effect`: `allow` หรือ `deny`
  - `scope`: `ALL`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, หรือ `null`
  - `granted_by`, `granted_at`

**2. Added user permission APIs** ✅
- `GET /api/v1/users/:id/permissions`
- `PUT /api/v1/users/:id/permissions`
- Both require `permissions:manage`

**3. Login effective permissions now include overrides** ✅
- Role permissions are still the base
- `user_permissions.effect = deny` removes that permission from effective scopes
- `user_permissions.effect = allow` sets the user-specific scope directly
- User must login again / refresh token to receive updated JWT permissions

**4. Tests + handoff docs** ✅
- Added validator coverage for allow/deny overrides, duplicate permission codes, invalid scopes
- Updated `docs/FRONTEND_HANDOFF.md`
- Updated `tests-manual.http`

### Verification

```bash
npm run typecheck
npm test -- --runInBand
```

Result: 3 test suites passed, 18 tests passed

---

## 2026-05-24 — Login hardening (session #7)

### What was done

**1. Hardened `POST /api/v1/auth/login`** ✅
- เพิ่ม rate limit เฉพาะ login: 10 attempts / 15 นาที
- เมื่อเกิน limit ตอบ `429 RATE_LIMITED`
- Validation เข้มขึ้นด้วย Zod:
  - trim `username` และ `departmentID`
  - จำกัดความยาว `username`, `departmentID`, `password`
  - reject unknown request fields ด้วย `.strict()`

**2. Security/error handling** ✅
- ถ้า identity provider auth ผ่าน แต่ user ยังไม่ถูก provision ใน POMS → client เห็น generic `401 UNAUTHORIZED`
- ถ้า user ถูกระงับ (`is_active=false`) → client เห็น generic `401 UNAUTHORIZED`
- รายละเอียด provision/inactive ถูก log ฝั่ง server แทน ไม่ส่ง external id หรือ internal setup detail กลับ frontend
- ไม่ออก JWT และไม่ update `last_login_at` ให้ inactive account

**3. Tests** ✅
- เพิ่ม validator tests สำหรับ trim, missing officer `departmentID`, oversized payload, unknown fields
- เพิ่ม auth service tests สำหรับ:
  - provision missing ต้องเป็น generic unauthorized
  - inactive user ต้องถูก reject ก่อนออก token/update last login

### Frontend contract notes

Frontend ควร handle login errors ด้วย `error.code`:

| HTTP | `error.code` | Frontend action |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | แสดง field validation |
| 401 | `UNAUTHORIZED` | แจ้ง login ไม่สำเร็จแบบกลาง ๆ |
| 429 | `RATE_LIMITED` | แจ้งให้รอแล้วลองใหม่ภายหลัง |
| 500 | `INTERNAL_ERROR` | แสดงข้อความระบบขัดข้อง |

อย่า hardcode จาก `error.message`; ใช้ `error.code` เป็นหลัก

### Files changed

- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.validator.ts`
- `tests/unit/auth.validator.test.ts`
- `tests/unit/auth.service.test.ts`
- `docs/FRONTEND_HANDOFF.md`

### Verification

```bash
npm run typecheck
npm test -- --runInBand
```

Result: 3 test suites passed, 14 tests passed

---

## 2026-05-24 — Live MSSQL setup + end-to-end smoke test (session #5)

### What was done

**1. Docker MSSQL container** ✅
- `docker run --platform linux/amd64 ... mcr.microsoft.com/mssql/server:2022-latest`
- Note: Apple Silicon ต้องใช้ `--platform linux/amd64` (Rosetta) — Microsoft ยังไม่มี native arm64 image
- Container name: `poms-mssql`, port 1433, SA password supplied via local `SA_PASSWORD`
- `scripts/setup-mssql.sh` — one-shot setup script (idempotent)

**2. ตรวจสอบ migrations + seeds จริง**
- 15 migrations ✅ ผ่านหมดในเทคแรก
- 10 seeds — เจอ issue + fix:
  - ❌ Knex `.onConflict()` **ไม่ support MSSQL** → เปลี่ยน 2 ไฟล์ (`01_provinces.ts`, `03_industrial_estates.ts`) เป็น check-then-insert/update pattern แทน

**3. End-to-end login test สมจริง** ✅
| Test | Result |
| --- | --- |
| Officer `weekit` (admin) | 36 permissions, ALL scope, `user.id=1` (int) |
| Operator `ธนาภรณ์` | 17 permissions, OWN_FACTORY scope, 2 juristics + 7 factories ครบ |
| Provincial officer `officer_sng` | IN_PROVINCE scope, province=1019 |
| Wrong password | 401 UNAUTHORIZED |
| `/auth/me` with valid Bearer token | คืน scopes + permissions จาก JWT |

### Bugs ที่เจอและแก้

| # | Bug | Root cause | Fix |
| - | --- | ---------- | --- |
| 1 | Thai chars ใน `factories.code` กลายเป็น `??` (ตัวอย่าง: `3-106-33/50??` แทน `3-106-33/50สบ`) | Declared as `VARCHAR(50)` — ไม่ support Unicode | เปลี่ยน migration 0013 เป็น `NVARCHAR(50)` + reseed |
| 2 | `user.id` ใน response เป็น string `"1"` แทน number `1` | `mssql` driver คืน BIGINT เป็น string เพื่อกัน precision loss | Cast `Number(row.id)` ใน `toUserSummary()` (safe จนถึง 2^53) |
| 3 | `.onConflict()` ใน seeds 01, 03 → error | Knex MSSQL dialect ไม่ support `INSERT ... ON CONFLICT` | เปลี่ยนเป็น check-then-insert/update pattern (idempotent) |

### Lessons learned สำหรับเฟสถัด ๆ ไป

1. **Knex .string() = NVARCHAR** ใน MSSQL (Unicode), **`.specificType('VARCHAR(...)')` = ASCII-only**. ใช้ VARCHAR เฉพาะ field ที่แน่ใจว่า ASCII (codes, IDs); ทุกอย่างที่อาจมี Thai → NVARCHAR
2. **BIGINT cast pattern** — ต้องทำที่ boundary ของ service layer ไม่งั้น JSON ออกมาเป็น string
3. **Upsert ใน MSSQL** — ต้องเขียน manual (check-then-insert) หรือ raw `MERGE`. อย่าใช้ `.onConflict()`
4. **`SYSDATETIME()` (server-local Bangkok)** ทำงานถูกต้องผ่าน Knex `knex.raw('SYSDATETIME()')` ใน update statement

### Files created/changed

**Created:**
- `scripts/setup-mssql.sh` — automated Docker setup (idempotent)

**Modified:**
- `src/db/migrations/0013_create_factories.ts` — `code` เป็น NVARCHAR(50)
- `src/db/seeds/01_provinces.ts` — remove `.onConflict()`
- `src/db/seeds/03_industrial_estates.ts` — remove `.onConflict()`
- `src/modules/auth/auth.service.ts` — `toUserSummary` cast id to Number
- `.env` — `DB_PASSWORD` updated for local MSSQL container

### How to spin up environment from scratch

```bash
SA_PASSWORD='<local-dev-password>' ./scripts/setup-mssql.sh
cp .env.example .env            # แก้ DB_PASSWORD ให้ตรง
npm install
npm run db:migrate              # 15 tables created
npm run db:seed                 # 5 users, 7 factories, 12 roles, 36 permissions, 186 grants
npm run dev                     # server on http://localhost:3000
```

ทดสอบ:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","password":"demo1234"}'
```

### Mock credentials (สำหรับ frontend ทดสอบ)

| User type | Login payload | Roles |
| --------- | ------------- | ----- |
| Admin (officer) | `{userType:'officer', username:'weekit', password:'demo1234'}` | admin |
| Officer (กฝม.) | `{userType:'officer', username:'officer_kpm', password:'demo1234'}` | monitoring_kpm |
| Officer (สอจ.) | `{userType:'officer', username:'officer_sng', password:'demo1234'}` | provincial_office |
| Operator | `{userType:'operator', citizenId:'3191000135709', password:'demo1234'}` | factory_operator |
| Citizen | `{userType:'citizen', username:'citizen_demo', password:'demo1234'}` | public_user |

### Next session ideas

1. **Refresh token flow** — `POST /auth/refresh` + token rotation + revoke
2. **Factories CRUD module** — list/view/edit ด้วย scope filter จริง (verify RBAC pipeline)
3. **Users + Roles admin endpoints** — list/assign role (admin only)
4. **Audit logging middleware** — auto-log mutations to `audit_logs`
5. **Frontend kickoff** — frontend dev เริ่มได้แล้วเพราะมี API + mock data พร้อม

---

## 2026-05-24 — Phase 1 implementation (session #4)

### What was done

**1. Migration helper** ✅
- `src/db/migration-helpers.ts` — `addTimestamps`, `addSoftDelete`, `addAuditColumns`
- MSSQL-specific: `DATETIME2 NOT NULL DEFAULT SYSDATETIME()` (Asia/Bangkok)

**2. 15 Knex migrations** ✅ — `src/db/migrations/0001_*.ts` ถึง `0015_*.ts`
```
0001_create_users.ts                 0009_create_organizations.ts
0002_create_roles.ts                 0010_create_officer_profiles.ts
0003_create_permissions.ts           0011_create_operator_profiles.ts
0004_create_role_permissions.ts      0012_create_juristics.ts
0005_create_user_roles.ts            0013_create_factories.ts
0006_create_refresh_tokens.ts        0014_create_user_juristics.ts
0007_create_provinces.ts             0015_create_audit_logs.ts
0008_create_industrial_estates.ts
```

**3. Mock fixtures + 10 seed files** ✅
- `src/modules/auth/fixtures/mock-users.ts` — สมจริงจาก sample txt:
  - Officer: "วีกิจ ชมญาติ" (per_cardno=1102001567054, role=admin)
  - Officer: "officer_kpm", "officer_sng"
  - Operator: "ธนาภรณ์ ศรีอวบ" (citizen_id=3191000135709) + 2 บริษัท + 7 โรงงาน
  - Citizen: demo user
- Seeds 01-10 — provinces, organizations, industrial_estates, roles, permissions, role_permissions (matrix จาก PERMISSIONS.md), mock users/juristics/factories/links

**4. Identity provider (adapter pattern)** ✅
- `IdentityProvider` interface
- `MockIdentityProvider` — read จาก fixtures
- Factory `getIdentityProvider()` switch ผ่าน `IDENTITY_PROVIDER=mock|external` env

**5. JWT + Password utilities** ✅
- `src/shared/utils/jwt.ts` — sign/verify access token, refresh token hash, duration parser
- `src/shared/utils/password.ts` — bcrypt wrapper

**6. RBAC middlewares** ✅
- `authenticate` — verify Bearer JWT → populate `req.user`
- `authorize(...permissions)` — check user มี permission อย่างน้อย 1 อัน
- `getScope(req, permission)` — helper สำหรับ service layer ใช้ scope filter

**7. Auth module เต็ม** ✅
- `auth.routes.ts` — `POST /login`, `GET /me`
- `auth.controller.ts`
- `auth.service.ts` — 3 login flows (officer/operator/citizen) → unified response
- `auth.repository.ts` — user lookup, roles/permissions merge (priority: ALL > IN_PROVINCE > IN_ESTATE > OWN_FACTORY > null)
- `auth.validator.ts` — Zod schema

**8. Wired up + smoke test** ✅
- `src/app.ts` mount `/api/v1/auth`
- TypeScript type check: **0 errors**
- Boot test: HTTP server listen on 3000, error handler ทำงานถูกเมื่อ DB ไม่พร้อม

### Architectural Decisions

| # | Decision | Why |
| - | -------- | --- |
| 22 | **Scope priority merging** ใน `getRolesAndPermissions` (ALL > PROV > EST > OWN) | User อาจมีหลาย role ที่มี permission เดียวกันแต่ scope ต่างกัน → ให้ scope กว้างที่สุด |
| 23 | **Identity provider เป็น singleton** (`getIdentityProvider()`) | สลับ implementation ผ่าน env, ไม่ต้อง inject ทุกที่ |
| 24 | **password_hash เป็น VARBINARY** ใน MSSQL | Best practice — bcrypt ผลิต ASCII string แต่ store เป็น raw bytes ป้องกัน encoding issue |
| 25 | **/me ไม่ query DB** — return จาก JWT payload | Performance — `/me` เรียกบ่อย, ข้อมูลใน JWT พอเพียง refresh ทุก expire เท่านั้น |
| 26 | **Demo: ทุก mock user provision ใน DB ก่อน** | Login flow → upsert ไม่ได้ทำ — สมจริงตอน external API จะมี first-time login = create-or-update |

### Files created/changed in this session

**Created:**
- `src/db/migration-helpers.ts`
- `src/db/migrations/0001_*.ts` → `0015_*.ts` (15 files)
- `src/db/seeds/01_*.ts` → `10_*.ts` (10 files)
- `src/modules/auth/fixtures/mock-users.ts`
- `src/modules/auth/identity-provider/{interface,mock,index}.ts`
- `src/modules/auth/auth.{types,validator,repository,service,controller,routes}.ts`
- `src/shared/utils/{jwt,password}.ts`
- `src/shared/types/express.d.ts`
- `src/shared/middlewares/{authenticate,authorize}.ts`

**Modified:**
- `src/config/env.ts` — เพิ่ม `IDENTITY_PROVIDER`
- `src/app.ts` — mount `/api/v1/auth` routes
- `.env.example` — เพิ่ม `IDENTITY_PROVIDER=mock`

### How to run locally (เมื่อมี MSSQL พร้อม)

```bash
# 1. setup MSSQL — Docker เป็นวิธีง่าย:
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<local-dev-password>" \
  -p 1433:1433 --name poms-mssql -d mcr.microsoft.com/mssql/server:2022-latest

# 2. แก้ .env ให้ตรง DB
# DB_PASSWORD=<local-dev-password>

# 3. สร้าง DB
docker exec poms-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
  -P '<local-dev-password>' -C -Q "CREATE DATABASE POMS"

# 4. รัน migrations + seeds
npm run db:migrate
npm run db:seed

# 5. start dev
npm run dev

# 6. ทดสอบ
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","password":"demo1234"}'
```

### Next session ideas

หลัง demo login ผ่าน → เลือกได้:
1. **Users + Roles management module** — list, view, assign roles (admin only)
2. **Factories CRUD module** — list/view/edit ด้วย scope (factory_operator → OWN, สอจ → IN_PROVINCE, admin → ALL)
3. **Refresh token flow** — `POST /auth/refresh` + token rotation + revoke + httpOnly cookie
4. **Setup MSSQL locally** — Docker config + first migration run

---

## 2026-05-24 — Database schema design (session #3)

### What was done

**1. ตัดสินใจ architectural ก่อนออกแบบ schema** (จาก AskUserQuestion):
- **Federated auth** — POMS ไม่เก็บ password เอง, เรียก external IdP (กรอ. HR / ระบบผู้ประกอบการ). Cache profile + last_synced_at
- **Raw measurement retention ตลอดไป** — ใช้ MSSQL partitioned table by month + sliding window
- **Soft delete ทั้งหมด** — column `deleted_at NULL` ทุก entity table

**2. เขียน `docs/SCHEMA.md` ฉบับเต็ม** ✅
- 23 tables — identity (8), org/lookup (3), juristic/factory (3), sensor (4), workflow (3), audit (1) + mock fixtures section
- Mermaid ERD
- MSSQL-specific syntax (NVARCHAR, DATETIME2, IDENTITY, partition function)
- Migration order (1→23) + Seed order (1→11)

**3. Mock IdentityProvider design**
- Adapter pattern: `IdentityProvider` interface → `MockIdP` (ตอนนี้) / `ExternalIdP` (ภายหลัง)
- Switch ด้วย `IDENTITY_PROVIDER=mock|external` ใน .env
- Fixtures JSON file สร้างจาก sample txt ที่ user แนบมา
- Mock seed: 2 บริษัทตัวอย่าง + 7 โรงงาน + officer/operator demo users

**4. Unified login response shape** — backend return shape เดียวสำหรับทุก user type:
```
{ accessToken, user, profile, scopes, permissions }
```
ไม่ส่ง raw shape ต่างกันตาม external system

### Architectural Decisions (เพิ่มเติม)

| # | Decision | Why |
| - | -------- | --- |
| 15 | **Partition `measurements` by month** ตั้งแต่ต้น | Retention หลายปี → table จะใหญ่หลักร้อยล้าน row, partition pruning จำเป็นต่อ query performance |
| 16 | **Pre-aggregated tables** (`measurements_hourly`, `measurements_daily`) | Dashboard query รายชั่วโมง/วัน/เดือนถ้า scan raw จะช้ามาก — เติมด้วย scheduled job |
| 17 | **Polymorphic approvals** (1 ตาราง ครอบ 5 features) ผ่าน `target_type` + `target_id` | กัน duplicate approval logic 5 ครั้ง, history table กลาง |
| 18 | **`approval_events`** เก็บ history ทุก action | ต้อง audit ได้: ใครส่ง, ใครอนุมัติ, comment อะไร, before/after diff |
| 19 | **`refresh_tokens.family_id`** + `rotated_from_id` | Token-reuse detection — ถ้า refresh token เก่าถูกเรียกใช้ซ้ำ → revoke ทั้ง family (security) |
| 20 | **`audit_logs` ไม่ soft delete** (append-only) | Audit log แก้ไม่ได้ — retention ผ่าน partition/archive ทีหลัง |
| 21 | **UTC ใน DB** — convert Asia/Bangkok ใน app layer | กัน confusion เวลามี user ต่างจังหวัด/server timezone เปลี่ยน |

### Files

- `docs/SCHEMA.md` — ✅ schema เต็ม (รอ review)

### Open questions ที่ใส่ไว้ใน SCHEMA.md ข้อ 13

**Resolved:**
- ✅ Q6 Timezone → **Asia/Bangkok ใน DB** (`SE Asia Standard Time`, ไม่มี DST). Default ใช้ `SYSDATETIME()` ไม่ใช่ `SYSUTCDATETIME()`
- ✅ Q4 Notification delivery → **email only** (Phase 3 จะเพิ่ม `email_outbox` queue + SMTP config)

**Pending (deferred):**
1. API contract ของ external IdP (endpoint, auth method, error codes) — รอ API จริง
2. Sensor gateway POST shape — รอเฟส sensor
3. Threshold rule per parameter — รอเฟส sensor
5. MFA? — รอ requirement

### Phase scope (จาก AskUserQuestion ล่าสุด)

User เลือก **skip sensor/measurements ทั้งหมด** + workflow ในเฟสนี้

**Phase 1 (เริ่มเขียน migrations + code):**
- auth + users + roles + permissions + organizations + provinces + industrial_estates
- juristics + factories + user_juristics
- audit_logs

**Phase 2 (deferred):** parameters, sensors, measurements, measurements_hourly
**Phase 3 (deferred):** approvals, approval_events, notifications, email_outbox

### Next session — ลุย implementation

หลัง review SCHEMA.md เสร็จ:
1. เขียน Knex migration ทั้ง 23 ไฟล์
2. Seed scripts (provinces, organizations, roles, permissions, parameters, mock users/factories)
3. `src/modules/auth/identity-provider/` — interface + mock impl + fixtures.json
4. `src/modules/auth/` — controller + service + JWT
5. RBAC middleware
6. ทดสอบ login mock user → ได้ unified response shape

---

## 2026-05-24 — Requirements & permissions discovery (session #2)

### What was done

**1. วิเคราะห์ไฟล์ requirement ที่ user แนบมา**
- `ตัวอย่าการตอบกลับข้อมูล เจ้าหน้าที่ และผู้ประกอบการ/msg_return_authen_ผู้ประกอบการ.txt` → operator login response (Juristic → Factory hierarchy)
- `ตัวอย่าการตอบกลับข้อมูล เจ้าหน้าที่ และผู้ประกอบการ/msg_return_authen_เจ้าหน้าที่.txt` → officer login response (ministry → department → division → organize hierarchy)
- `ข้อมูลระบบ.xlsx` (sheet: สิทธิ์การใช้งาน) → role × feature × scope matrix
- `ข้อมูลระบบ.xlsx` (sheet: Parameter) → sensor parameter dictionary

**2. ค้นพบจริง ๆ ว่าระบบคืออะไร**
POMS = **Pollution Online Monitoring System** ของ **กรมโรงงานอุตสาหกรรม**
รับ sensor data จาก 4 ประเภท:
| Type    | # Parameters |
| ------- | -----------: |
| CEMS    | 21 (air emissions)   |
| WPMS    | 5 (water pollution)  |
| Mobile  | 129 (mobile air)     |
| Station | 126 (fixed air)      |

**3. สรุป permission matrix → `docs/PERMISSIONS.md`** ✅
- 13 user roles (public anonymous, public login, factory operator, กรอ., สอจ., กนอ., กฝม., 5 ศูนย์, ผอ.ศูนย์, ผอ.กฝม., ผอ.กวภ., admin)
- 14 main features × 3 actions (View/Edit/Approve)
- 5 scope types: `ALL`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, `NONE`
- Permission code convention: `<resource>:<action>` + scope ใน `role_permissions` table

**4. ตอบคำถาม folder structure**
User ถามว่าควรเป็น layer-based (controllers/, services/, repositories/) หรือไม่
**ตอบ: ไม่ — เก็บ feature-based เดิม** เพราะ:
- ระบบจะมี 14+ features → 50+ endpoints
- Layer-based = ทุก folder มี 20+ ไฟล์ ทำ 1 feature ต้องกระโดด 5 folder
- Feature-based = 1 folder ต่อ 1 feature isolation ดีกว่า ลบ feature ง่ายกว่า

### Architectural Decisions (เพิ่มเติม)

| # | Decision | Why |
| - | -------- | --- |
| 11 | **Polymorphic login response** — ทุก userType return shape เดียวกัน `{ userType, profile, scopes, permissions }` | Frontend handle ง่าย, backend logic ชัดเจน, ขยาย userType ใหม่ง่าย |
| 12 | **Scope-aware permissions** (ไม่ใช่แค่ True/False) | xlsx แสดงชัด: 1 role มี scope ต่างกัน (`OWN_FACTORY` vs `IN_PROVINCE` vs `ALL`) — ต้องเก็บใน `role_permissions.scope` |
| 13 | **Approvals = shared module** (ไม่ duplicate ใน 5 features) | 5 features มี Approve workflow เหมือนกัน → state machine กลาง + audit trail |
| 14 | **3 login flows** (citizen / operator / officer) แต่ unified output | ลด surface area ของ controller, branching อยู่ใน service |

### Identified modules (ทั้งหมดสำหรับ POMS)

ตอนนี้รู้ scope ของระบบทั้งหมดแล้ว → จะมี module เหล่านี้:

**Core / Auth phase (เฟสถัดไป):**
- `auth` — login (3 flows), refresh, logout
- `users` — internal user mgmt
- `roles`, `permissions` — RBAC
- `juristics` — นิติบุคคล
- `operators` — link user ↔ juristics ↔ factories
- `factories` — โรงงาน
- `organizations` — ministry/department/division/organize hierarchy + provinces + industrial_estates

**Sensor / Data phase (ภายหลัง):**
- `parameters` — dictionary (seed จาก xlsx)
- `sensors` — CEMS / WPMS / Mobile / Station
- `measurements` — sensor readings (heavy write)
- `cems_wpms_requests` — ขอเชื่อมต่อระบบ

**Workflow phase:**
- `approvals` — shared state machine
- `kwp_forms` — กวภ. 01-05
- `bod_cod_errors` — รายงานค่าความคลาดเคลื่อน
- `notifications` — แจ้งเตือน

**Misc:**
- `helpdesk`, `feedback`, `laws`, `faq`, `chat`, `stats`, `search`

### Files updated/created

- `docs/PERMISSIONS.md` ← single source of truth สำหรับ RBAC + login response shapes
- ลบโครง `src/modules/{auth,users,roles}/` placeholder — เฟสถัดไปจะเริ่มจริง

### Next session — เฟส Auth + Organizations

ลำดับงาน:
1. **DB schema (Knex migrations)** — `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `organizations`, `provinces`, `industrial_estates`, `juristics`, `factories`, `user_juristics`, `refresh_tokens`
2. **Seeds** — 13 roles, permission codes (จาก `docs/PERMISSIONS.md` ตารางข้อ 5), default admin
3. **Auth module** — implement 3 login flows + JWT + refresh token cookie
4. **RBAC middleware** — `authenticate` + `authorize(permission)` + `withScope(repo, ctx)`
5. **Unified login response** — `{ userType, profile, scopes: {...}, permissions: [...] }`

---

## 2026-05-24 — Project scaffolding (session #1)

### What was done

**1. Initialized npm project**
- `package.json` — `name: poms-backend`, `version: 0.1.0`, Node 20+ required
- Custom scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`, `test`, `db:migrate`, `db:seed`, etc.

**2. Installed dependencies**

Production:
| Package                    | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `express`                  | Web framework (v5)                       |
| `mssql`                    | MSSQL driver                             |
| `knex`                     | SQL query builder + migrations           |
| `bcrypt`                   | Password hashing                         |
| `jsonwebtoken`             | JWT auth                                 |
| `zod`                      | Schema validation                        |
| `dotenv`                   | .env loader                              |
| `helmet`, `cors`           | Security headers, CORS                   |
| `compression`              | Gzip response                            |
| `cookie-parser`            | Parse cookies (refresh token)            |
| `express-rate-limit`       | Rate limiting                            |
| `winston` + `winston-daily-rotate-file` | Logging with daily rotation |
| `http-status-codes`        | Named HTTP status constants              |
| `uuid`                     | Generate UUIDs                           |

Dev:
`typescript`, `tsx`, `ts-node`, `@types/*`, `eslint`, `@typescript-eslint/*`, `prettier`, `jest`, `ts-jest`, `supertest`, `rimraf`

**3. Created folder structure**

```
backend/
├── src/
│   ├── config/                 ✅ env.ts, logger.ts, database.ts
│   ├── shared/
│   │   ├── middlewares/        ✅ errorHandler.ts (errorHandler + notFoundHandler)
│   │   ├── errors/             ✅ AppError.ts + named subclasses
│   │   ├── utils/              (empty — to be filled later)
│   │   └── types/              (empty)
│   ├── modules/
│   │   ├── auth/               (empty — next session)
│   │   ├── users/              (empty)
│   │   └── roles/              (empty)
│   ├── db/
│   │   ├── migrations/         (empty)
│   │   └── seeds/              (empty)
│   ├── app.ts                  ✅ Express app config (middlewares + /health + /api/v1)
│   └── server.ts               ✅ Entry point (boot + graceful shutdown)
├── tests/{unit,integration}/   (empty)
├── docs/, logs/, scripts/      (empty)
├── tsconfig.json               ✅
├── jest.config.js              ✅
├── knexfile.ts                 ✅
├── .eslintrc.json              ✅
├── .prettierrc                 ✅
├── .editorconfig               ✅
├── .env.example                ✅
├── .gitignore                  ✅
├── README.md                   ✅
└── PROGRESS.md                 ✅ (this file)
```

**4. Verified boot**
- `npx tsc --noEmit` → ผ่าน 0 error
- `npx tsx src/server.ts` → boot สำเร็จ, HTTP listen ที่ port 3000
- DB connect ที่ localhost:1433 fail (ตามคาด — ยังไม่ได้ติดตั้ง MSSQL) — fallback ทำงานถูก
- Graceful shutdown (SIGTERM) ทำงานถูก

### Architectural Decisions

| # | Decision | Why |
| - | -------- | --- |
| 1 | **TypeScript** instead of JS | Type safety สำคัญสำหรับโปรเจคจะโตเรื่อย ๆ (sensor + users + factories + reports) |
| 2 | **mssql + Knex** แทน Prisma/TypeORM | คุมคุม SQL ได้เต็มที่ — เหมาะกับ MSSQL specific (stored procedure, table-valued parameter) และ heavy write จาก sensor |
| 3 | **Feature-based modular** (`src/modules/<feature>/`) แทน layer-based | จัดการ feature เป็น vertical slice — ง่ายต่อการขยาย, delete feature, และทำงานเป็นทีม |
| 4 | **Express 5** | Stable, mature, frontend dev คุ้นเคย เอกสารเยอะ |
| 5 | **Zod** สำหรับ validation | Type-safe → infer TS type จาก schema ได้, ไม่ต้อง maintain types สองที่ |
| 6 | **JWT access + refresh token** | Access token สั้น (15m), refresh token นาน (7d) เก็บใน httpOnly cookie |
| 7 | **Winston + daily rotate** | บน Windows server การ rotate log สำคัญ — กันไฟล์ log ใหญ่เกิน |
| 8 | **`env.ts` validate ด้วย Zod แล้ว exit ถ้าผิด** | Fail fast — ดีกว่า runtime error ทีหลัง |
| 9 | DB **fail = warn ไม่ exit** (dev เท่านั้น) | สะดวกตอนพัฒนาที่ยังไม่มี DB |
| 10 | Postpone real-time / sensor ingest | User ขอ focus auth + RBAC ก่อน |

### Next session (TODO)

ลำดับงานเฟส **Auth + RBAC**:

1. **Database schema design** — ออกแบบ table:
   - `users` (id, username, email, password_hash, full_name, is_active, created_at, updated_at)
   - `roles` (id, name, description)
   - `permissions` (id, code, description) เช่น `users:read`, `users:write`, `sensors:read`
   - `role_permissions` (role_id, permission_id) — many-to-many
   - `user_roles` (user_id, role_id) — many-to-many (user มีหลาย role ได้)
   - `refresh_tokens` (id, user_id, token_hash, expires_at, revoked_at) — เก็บ refresh token เพื่อ revoke ได้

2. **Migrations** — สร้าง Knex migration files สำหรับ tables ข้างต้น
3. **Seed** — สร้าง default roles (admin, manager, operator) + admin user เริ่มต้น
4. **Auth module** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
5. **Users module** — CRUD (admin only)
6. **Roles module** — list roles, assign permissions
7. **Middlewares**:
   - `authenticate` — verify JWT, attach `req.user`
   - `authorize(...permissions)` — RBAC guard
8. **Tests** — unit test ของ service + integration test ของ auth flow

### How to continue

```bash
# จาก clean clone
cd backend
npm install
cp .env.example .env       # แล้วแก้ DB credentials ให้ตรงกับ MSSQL ในเครื่อง

# dev
npm run dev                # tsx watch — hot reload
curl http://localhost:3000/health
curl http://localhost:3000/api/v1
```

---

<!-- เพิ่ม session ใหม่ด้านบน, ลำดับ chronological จากใหม่ -> เก่า -->
