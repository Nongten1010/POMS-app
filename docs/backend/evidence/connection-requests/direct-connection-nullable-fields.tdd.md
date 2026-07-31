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
| Regression | focused Direct Connection suites บน temporary worktree จาก `origin/main` | PASS: 7 suites, 35 tests | eligibility/scope lookup, canonical factory identity, repository transaction และ duplicate point-code conflict ยังทำงาน |
| Type safety | `npm run typecheck` | PASS | request schema ที่ normalize แล้วเข้ากับ service/repository types |
| Coverage | `npm run test:coverage -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.validator.test.ts tests/unit/connection-request-form-enhancements.validator.test.ts --collectCoverageFrom=src/modules/connection-requests/connection-requests.validator.ts` | PASS: 3 suites, 92 tests; statements 88.92%, branches 86.05%, functions 97.39%, lines 91.26% | validator ที่เปลี่ยนมี coverage ทุก metric มากกว่า 80% |
| Full suite | `npm test -- --runInBand` บน temporary `origin/main` worktree ด้วย placeholder environment | 93/97 suites และ 835/847 tests ผ่าน; 12 failures อยู่นอก Direct Connection และเกิดจากค่า `PUBLIC_BASE_URL`/parameter schema ต่างจาก test fixture รวมถึงไม่มี local SQL Server | focused Direct Connection regression และ typecheck ยังผ่านทั้งหมด |

## Test specification

| # | What is guaranteed | Test file | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | optional Direct Connection fields ทุกส่วนรับ `null` และ backend derive `pointName`/`pointType` | `backend/tests/unit/connection-requests.direct-connections.validator.test.ts` | unit | PASS |
| 2 | ต้องมี `factoryId` หรือ `factoryRegistrationNo` อย่างน้อยหนึ่งค่า | `backend/tests/unit/connection-requests.direct-connections.validator.test.ts` | unit | PASS |
| 3 | HTTP endpoint รับ minimal nullable payload และส่ง normalized payload เข้า service | `backend/tests/unit/connection-requests.direct-connections.route.test.ts` | HTTP integration | PASS |
| 4 | `systemType` และ non-empty `measurementPoints[0].pointCode` ยัง required | validator และ route tests | unit + HTTP integration | PASS |
| 5 | active `pointCode` ซ้ำยังตอบ `409 Conflict` พร้อม field path | route และ repository conflict tests | HTTP integration + repository | PASS |

## Coverage and known gaps

`connection-requests.validator.ts` มี statements 88.92%, branches 86.05%, functions 97.39% และ lines 91.26%. Full suite ใน isolated worktree ไม่ clean เพราะไม่มี environment/SQL Server ของ workspace หลัก; failures ไม่อยู่ใน Direct Connection path. ไม่มี browser E2E เพราะการเปลี่ยนครั้งนี้จำกัดเฉพาะ backend API และไม่ได้รับอนุญาตให้แก้ frontend.

## Merge evidence

RED/GREEN แยกยืนยันด้วยคำสั่งเดียวกัน จากนั้นย้ายเฉพาะไฟล์ใน scope ไปสร้าง commit ใหม่บนฐาน `origin/main` เพื่อไม่รวม commit และไฟล์ค้างอื่นจาก working branch.
