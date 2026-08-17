# หลักฐาน TDD: ฟอร์มเพิ่มจุดส่งสถานะไปพร้อม `POST /measurement-points`

เอกสารนี้สนับสนุน contract [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md) และ [Payload และ Validation ของคำขอเชื่อมต่อ](../../api/menus/connection-requests/request-payloads-and-validation.md) โดยไม่ใช้แทน API contract

## Source Plan

ไม่มี plan file แยก; journey และ acceptance criteria มาจากคำขอให้เจ้าหน้าที่เลือกสถานะ `รอโรงงานแก้ไข` หรือ `เชื่อมต่อแล้ว` ได้จากฟอร์มเพิ่มจุด และส่งค่ามาพร้อม `POST /api/v1/cems-wpms-requests/measurement-points`

## User Journeys

- ในฐานะเจ้าหน้าที่ ฉันต้องการส่งฟอร์มเพิ่มจุดแล้วเลือกให้คำขอเริ่มที่ `WAITING_FACTORY_REVISION` เพื่อส่งกลับให้โรงงานแก้ไขได้ทันที
- ในฐานะเจ้าหน้าที่ ฉันต้องการส่งฟอร์มเพิ่มจุดแล้วเลือกให้ระบบเชื่อมต่อทันที เพื่อไม่ต้องสลับไปใช้ endpoint อื่นเมื่อข้อมูลครบ
- ในฐานะผู้ประกอบการ ฉันต้องการให้ `POST /measurement-points` เดิมยังคงสร้าง `PENDING_DESIGN_REVIEW` เมื่อไม่ส่ง workflow field ใหม่

## Task Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.validator.test.ts tests/unit/connection-requests.create.route.test.ts tests/unit/connection-requests.service.test.ts` | FAIL | validator ปฏิเสธ `submissionAction` เป็น unrecognized key, route ยังส่งแค่ `actorUserId`, service signature รับได้เฉพาะ number |
| GREEN | `npm test -- --runInBand tests/unit/connection-requests.validator.test.ts tests/unit/connection-requests.create.route.test.ts tests/unit/connection-requests.service.test.ts` | PASS: 3 suites, 161 tests | `measurement-points` รับ `submissionAction`, route ส่ง actor context, service map ไป `WAITING_FACTORY_REVISION` หรือ `CONNECTED` ได้ |
| Permission hardening RED → GREEN | `npm test -- --runInBand tests/unit/connection-requests.service.test.ts -t 'rejects an operator that tries\|requires direct-connect permission when an officer'` | RED: 2 failed จาก eligible-factory lookup เกิดก่อน authorization; GREEN: 2 passed | ตรวจ actor/permission ก่อน lookup เพื่อไม่เปิดเผยหรือทำงานกับ factory data เมื่อ action ไม่มีสิทธิ์ |
| Direct-connection alias | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.direct-connections.route.test.ts tests/unit/connection-requests.direct-connections.service.test.ts tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts tests/unit/connection-requests.direct-connections.integration.test.ts` | PASS: 5 suites, 47 tests | `direct-connections` ยังคงใช้ `status` ได้ และรับ `submissionAction` alias เพิ่มเพื่อให้ contract เจ้าหน้าที่สอดคล้องกัน |
| OpenAPI | `npm test -- --runInBand tests/unit/api-docs.openapi.test.ts` | PASS: 1 suite, 58 tests | component schema ของทั้ง `measurement-points` และ `direct-connections` ตรงกับ runtime schema |
| Full regression | `npm test -- --runInBand` | PASS: 131 suites, 1389 tests | regression ทั้ง backend ผ่าน |
| Types | `npm run typecheck` | PASS | TypeScript compile ผ่าน |
| Build | `npm run build` | PASS | backend build ผ่าน |
| Lint | `npm run lint` | PASS: 0 errors, 334 warnings | ไม่มี lint error; repository-wide warnings เป็น formatting/legacy warnings |
| Focused coverage | `npm run test:coverage -- --runInBand <9 focused suites> --collectCoverageFrom=<validator,service,openapi>` | PASS: 9 suites, 272 tests; statements 86.55%, branches 78.81%, functions 96.58%, lines 90.40% | core contract/logic ที่เปลี่ยน behavior ผ่านเกณฑ์ statement/line/function 80% |

หมายเหตุ: coverage ที่รวม `supertest` route tests ต้อง rerun นอก sandbox เพราะ instrumentation เปิด local test server แล้ว sandbox ตอบ `listen EPERM` ในรอบแรก

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /measurement-points` รับ `submissionAction=CONNECT` และ normalize `pointCode` | `tests/unit/connection-requests.validator.test.ts` | validator unit | PASS | schema ใหม่ยอมรับ 1 point ที่มี code และคืน `requestType=ADD_MEASUREMENT_POINT` |
| 2 | `submissionAction=REQUEST_FACTORY_REVISION` ต้องมี `revisionReason` | `tests/unit/connection-requests.validator.test.ts` | validator unit | PASS | issue ชี้ที่ `revisionReason` |
| 3 | route ส่ง actor context, edit scope และ direct-connect scope ไป service | `tests/unit/connection-requests.create.route.test.ts` | HTTP route | PASS | officer tokenผ่าน `submissionAction=CONNECT` และ service ได้ context ครบ |
| 4 | operator flow เดิมยังสร้าง `PENDING_DESIGN_REVIEW` เมื่อไม่ส่ง `submissionAction` | `tests/unit/connection-requests.service.test.ts` | service unit | PASS | call เดิมยังเข้า `connectionRequestsRepository.create(..., PENDING_DESIGN_REVIEW)` |
| 5 | officer เลือก `REQUEST_FACTORY_REVISION` แล้ว service สร้างคำขอสถานะ `WAITING_FACTORY_REVISION` พร้อม `revisionReason`/`officerNote` | `tests/unit/connection-requests.service.test.ts` | service unit | PASS | repository ถูกเรียกด้วย initial status และ create options ใหม่ |
| 6 | officer เลือก `CONNECT` แล้ว service ใช้ direct-connect permission scope เพื่อ resolve eligible factory และสร้าง `CONNECTED` | `tests/unit/connection-requests.service.test.ts` | service unit | PASS | service map ไป `createDirectConnection` พร้อม canonical factory identity |
| 7 | `POST /direct-connections` รับ `submissionAction` alias เพิ่มโดยไม่ทำลาย legacy `status` | `tests/unit/connection-requests.direct-connections.validator.test.ts`, `tests/unit/connection-requests.direct-connections.route.test.ts` | validator + route | PASS | direct flow รับทั้ง action ใหม่และ status เดิม |
| 8 | OpenAPI contract สะท้อน `submissionAction` ของทั้ง `measurement-points` และ `direct-connections` | `tests/unit/api-docs.openapi.test.ts` | docs contract | PASS | example/runtime schema และ published request-body metadata ตรงกัน |
| 9 | operator ใช้ action ของเจ้าหน้าที่ไม่ได้ | `tests/unit/connection-requests.service.test.ts` | permission unit | PASS | service ตอบ `403 FORBIDDEN` และไม่เรียก repository create |
| 10 | `CONNECT` ต้องมี direct-connect permission | `tests/unit/connection-requests.service.test.ts` | permission unit | PASS | service ตอบ `403 FORBIDDEN` ก่อน lookup/create direct connection |

## Coverage And Known Gaps

- Focused core coverage: statements 86.55%, branches 78.81%, functions 96.58%, lines 90.40%
- ยังไม่ได้เพิ่ม browser/E2E เพราะ scope ที่ผู้ใช้อนุมัติคือ backend contract เท่านั้น
- `PUT /:id/form` ยังเป็น owner-only flow เดิม ดังนั้นคำขอที่เจ้าหน้าที่สร้างเป็น `WAITING_FACTORY_REVISION` ผ่าน endpoint ใดก็ตาม ยังไม่ให้สิทธิ์ผู้ใช้ของโรงงานแก้และ resubmit โดยอัตโนมัติ

## Merge Evidence

- RED: contract ใหม่ยังไม่มีใน validator/service/controller
- GREEN: `POST /measurement-points` รองรับ `submissionAction` สำหรับเจ้าหน้าที่ โดยคง operator flow เดิมไว้ และ `POST /direct-connections` รับ alias เดียวกันเพื่อให้ contract สอดคล้องกัน
- Docs: canonical Markdown และ generated OpenAPI ถูกอัปเดตให้ตรงกับ runtime behavior เดียวกัน
- ไม่สร้าง checkpoint commit เพราะผู้ใช้ไม่ได้ขอ commit และกติกา repository ให้หลีกเลี่ยงการ commit โดยไม่ได้รับคำสั่ง
