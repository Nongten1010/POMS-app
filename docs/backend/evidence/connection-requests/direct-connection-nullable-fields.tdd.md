# TDD Evidence: Direct Connection รับ optional fields เป็น null

## Source

ไม่มีไฟล์แผนแยก; user journey และ acceptance criteria มาจากคำขอให้ปรับเฉพาะ `POST /api/v1/cems-wpms-requests/direct-connections`.

Canonical contract: [`connection-requests`](../../api/menus/connection-requests/README.md#เชื่อมต่อโดยเจ้าหน้าที่โดยตรง)

## User journey

เจ้าหน้าที่ต้องการเชื่อมต่อโรงงานเข้าข่ายโดยส่งชนิดระบบ รหัสจุดตรวจวัด และ identifier โรงงานที่ใช้ resolve เพียงหนึ่งค่า โดย field อื่นไม่ต้องกรอกหรือส่ง `null` ได้ เพื่อให้ frontend ใช้ฟอร์มขั้นต่ำโดยไม่ถูกบังคับด้วย validation ของคำขอแบบปกติ.

## Task report

| Stage | Command | Result | Guarantee |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.direct-connections.route.test.ts` | FAIL: 2 suites, 2 tests; minimal nullable payload ได้ `400` และ schema parse ไม่ผ่าน | tests เรียก path ของ endpoint/schema เดิมจริงและจับ required fields ส่วนเกินได้ |
| GREEN | command เดียวกับ RED | PASS: 2 suites, 17 tests | Direct Connection รับ optional fields เป็น `null`, normalize ค่า DB-required และยังคง validation/authorization/error contract เดิม |
| Regression + refactor | focused Direct Connection suites บน temporary worktree จาก `origin/main` | PASS: 9 suites, 40 tests | schema ที่ลดความซ้ำซ้อนยังรักษา eligibility/scope lookup, canonical factory identity, repository transaction และ duplicate point-code conflict |
| Type safety | `npm run typecheck` | PASS | request schema ที่ normalize แล้วเข้ากับ service/repository types |
| Coverage | `npm run test:coverage -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.validator.test.ts tests/unit/connection-request-form-enhancements.validator.test.ts --collectCoverageFrom=src/modules/connection-requests/connection-requests.validator.ts` | PASS: 3 suites, 92 tests; statements 89.13%, branches 86.21%, functions 97.39%, lines 91.28% | validator ที่ refactor มี coverage ทุก metric มากกว่า 80% |
| Full suite | `npm test -- --runInBand` บน temporary `origin/main` worktree ด้วย placeholder environment | 94/98 suites และ 842/855 tests ผ่าน; 13 failures อยู่นอก Direct Connection โดย 10 tests ผ่านเมื่อ rerun ด้วย `PUBLIC_BASE_URL`/`PARAMETER_DB_SCHEMA` ตาม fixture และอีก 3 tests ต้องใช้ local SQL Server | focused Direct Connection regression และ typecheck ยังผ่านทั้งหมด |

## Test specification

| # | What is guaranteed | Test file | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | optional Direct Connection fields ทุกส่วนรับ `null` และ backend derive `pointName`/`pointType` | `backend/tests/unit/connection-requests.direct-connections.validator.test.ts` | unit | PASS |
| 2 | ต้องมี `factoryId` หรือ `factoryRegistrationNo` อย่างน้อยหนึ่งค่า | `backend/tests/unit/connection-requests.direct-connections.validator.test.ts` | unit | PASS |
| 3 | HTTP endpoint รับ minimal nullable payload และส่ง normalized payload เข้า service | `backend/tests/unit/connection-requests.direct-connections.route.test.ts` | HTTP integration | PASS |
| 4 | `systemType` และ non-empty `measurementPoints[0].pointCode` ยัง required | validator และ route tests | unit + HTTP integration | PASS |
| 5 | active `pointCode` ซ้ำยังตอบ `409 Conflict` พร้อม field path | route และ repository conflict tests | HTTP integration + repository | PASS |

## Coverage and known gaps

`connection-requests.validator.ts` มี statements 89.13%, branches 86.21%, functions 97.39% และ lines 91.28%. Full suite ใน isolated worktree ไม่ clean เพราะ environment เริ่มต้นต่างจาก fixture และไม่มี local SQL Server; 10 config-sensitive tests ผ่านเมื่อ rerun ด้วยค่าตาม fixture ส่วน 3 notification-recipient tests ยังเชื่อมต่อ `localhost:1433` ไม่ได้. Failures ไม่อยู่ใน Direct Connection path. ไม่มี browser E2E เพราะการเปลี่ยนครั้งนี้จำกัดเฉพาะ backend API และไม่ได้รับอนุญาตให้แก้ frontend.

## Merge evidence

behavior เดิมอยู่ใน commit `71f7633`; refactor ลดความซ้ำซ้อนรอบนี้ยืนยันด้วย focused regression, typecheck, lint, format และ coverage ก่อนสร้าง commit ต่อจาก `origin/main` ล่าสุด โดยไม่รวมไฟล์ค้างอื่นจาก working branch.
