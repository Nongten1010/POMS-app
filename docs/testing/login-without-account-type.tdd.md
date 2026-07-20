# Login without accountType — TDD evidence

วันที่: 2026-07-20

## Source plan

User journeys และ acceptance criteria มาจากแผนที่ตกลงในบทสนทนา ไม่มีไฟล์ `*.plan.md` ภายนอก.

## User journeys

- ผู้ใช้ POMS login ได้โดยไม่ต้องส่ง `accountType` และระบบไม่เรียก external provider เมื่อ local credential ผ่าน.
- ผู้ใช้ API login ได้โดยไม่ต้องส่ง `accountType` แม้มี POMS account ที่ใช้ username เดียวกันแต่ local credential ไม่ผ่าน.
- Client รุ่นเก่าที่ยังส่ง `accountType` หรือ `provider=local` ยังคงใช้ strict route เดิมระหว่าง compatibility window.
- Client อ่าน `user.accountType` จาก response ซึ่ง derive จาก persisted identity provider ไม่ใช่ request.

## RED/GREEN report

| Task | Test target | RED evidence | GREEN evidence |
| --- | --- | --- | --- |
| Fallback จาก local ไป API เมื่อไม่ส่ง `accountType` | `auth.service.test.ts: falls back to an API account when an accountType-less local password does not match` | `npm test -- --runInBand tests/unit/auth.service.test.ts` รัน test ใหม่แล้วล้มด้วย `UnauthorizedError: Invalid credentials` ที่ `completeLocalLogin` (1 failed, 14 passed) | คำสั่งเดิมผ่าน 15/15 tests หลัง `tryLoginLocalFirst` fallback เฉพาะ `UnauthorizedError` |
| Local credential ที่ถูกต้องต้องมีลำดับก่อน | `auth.service.test.ts: checks local accounts before requiring officer departmentID` | Behavior เดิมมีอยู่แล้ว; เพิ่ม assertion ว่า `getIdentityProvider` ไม่ถูกเรียก | รวมอยู่ใน targeted GREEN 15/15 tests |
| Legacy explicit routing ยังคงทำงาน | tests ของ explicit `accountType=poms` และ `accountType=api` ใน `auth.service.test.ts` / `auth.validator.test.ts` | Existing regression guarantees | Focused auth run ผ่าน 27/27 tests |
| Request/response documentation | `docs/API.md`, `APIDoc/01-auth.md`, auth handoff และ derived-field logic | เอกสารเดิมขัดกัน โดยบางจุดบังคับให้ frontend ส่ง `accountType` | เอกสารหลักระบุ request ใหม่ไม่ส่ง field นี้, legacy hint ยังรับชั่วคราว และ response ยังคืน derived `user.accountType` |

## Test specification

| # | What is guaranteed | Test file or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | local password ไม่ผ่านแล้ว backend ลอง API account ที่ username เดียวกัน | `backend/tests/unit/auth.service.test.ts` accountType-less fallback test | Unit | PASS |
| 2 | local credential ผ่านแล้วไม่เรียก external provider | `backend/tests/unit/auth.service.test.ts` local officer test | Unit | PASS |
| 3 | explicit API login ไม่ fallback ไป local | `backend/tests/unit/auth.service.test.ts` explicit API test | Unit | PASS |
| 4 | validator รับ request ที่ไม่ส่ง `accountType` | `backend/tests/unit/auth.validator.test.ts` | Unit | PASS |
| 5 | backend compiles and typechecks | `npm run build`, `npm run typecheck` | Static | PASS |
| 6 | changed behavior has focused coverage above 80% lines | focused Jest coverage | Coverage | PASS |

## Verification results

- Backend targeted GREEN: 1 suite, 15 tests passed.
- Focused auth coverage: 2 suites, 27 tests passed; `auth.service.ts` line coverage 84.89%, `auth.validator.ts` 90%.
- Backend build: passed.
- Backend typecheck: passed.
- Backend lint: 0 errors; 175 pre-existing warnings outside changed auth service/test lines.
- Backend full regression: 55/56 suites and 600/602 tests passed. Two failures are in `connection-requests.create.route.test.ts`, which receives HTTP 501 instead of expected 201/400 and does not touch auth code.
- Backend `npm audit --audit-level=high`: 0 vulnerabilities.
- Frontend test: 4/4 passed.
- Frontend lint: passed.
- Frontend build: blocked because workspace `node_modules` cannot resolve declared dependency `@pdf-lib/fontkit`; no frontend source or dependency file was changed in this task.
- `git diff --check`: passed.
- Secret-pattern scan over changed files: no matches.

## Coverage and known gaps

- Jest configuration collects the entire backend source tree even for focused runs, so global focused-run coverage is not meaningful; the changed auth service and validator both exceed 80% line coverage.
- No live external-provider E2E was run because it requires provisioned test credentials and an available DIW environment. Unit tests mock the provider boundary and full backend regression exercises the surrounding application.
- Frontend already omitted `accountType` before this change, so no frontend application code was modified. A clean dependency install is required before its production build can be re-verified.

## Merge evidence

- RED checkpoint: `88a674c test: add login account routing reproducer`.
- GREEN checkpoint: `51e9e90 fix: resolve login account without account type`.
