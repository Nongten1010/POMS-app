# หลักฐาน TDD: โรงงานของผู้ประกอบการพร้อมสถานะ POMS

เอกสารนี้สนับสนุน canonical contract [หน้าหลัก](../../api/menus/home/README.md#get-apiv1operator-factories) และ runtime OpenAPI ของ `GET /api/v1/operator-factories`.

## Source and journey

ไม่มี plan file. Journey มาจากกรณีผู้ประกอบการ login แล้วเข้าใจว่าไม่มีโรงงาน เพราะ dashboard เดิมแสดงเฉพาะโรงงานที่เชื่อม POMS แล้ว.

ในฐานะผู้ประกอบการ ต้องเห็นโรงงานของตนเองทั้งหมดที่ sync ตอน login พร้อมสถานะว่าอยู่ใน POMS, อยู่ระหว่างเชื่อมต่อ หรือยังไม่เชื่อมต่อ โดยไม่ปะปน POMS membership กับ eligibility.

## RED → GREEN

| Stage | Command | Result | Evidence |
| ----- | ------- | ------ | -------- |
| RED: runtime | `npm test -- --runInBand tests/unit/connection-requests.operator-factories.route.test.ts tests/unit/connection-requests.service.test.ts` | EXPECTED FAIL | TypeScript ระบุว่า `listOperatorFactoryOverview` ยังไม่มีใน service; เป็น compile-time RED ของ endpoint ใหม่ |
| RED | `npm test -- --runInBand tests/unit/api-docs.openapi.test.ts` พร้อม test-only environment values | EXPECTED FAIL | `1 failed, 60 passed`; contract test หา `/operator-factories` ใน OpenAPI ไม่พบ |
| GREEN: focused | route/service/OpenAPI commands เดิมพร้อม test-only environment values | PASS | service `99/99`, route `14/14`, OpenAPI `61/61` |
| GREEN: full | `npm test -- --runInBand` พร้อม test-only environment values | PASS | `133 suites`, `1423 tests` ผ่านทั้งหมด |
| RED: remove unused request detail | `npm test -- --runInBand tests/unit/connection-requests.service.test.ts tests/unit/api-docs.openapi.test.ts` พร้อม test-only environment values | EXPECTED FAIL | `3 failed, 157 passed`; runtime และ OpenAPI ยังมี `latestConnectionRequest` |
| GREEN: remove unused request detail | command เดียวกับ RED รอบล่าสุด | PASS | `2 suites`, `160 tests` ผ่าน; row และ OpenAPI ไม่มี field/schema ดังกล่าว แต่ summary ยังผ่าน regression test |
| GREEN: full regression after removal | `npm test -- --runInBand` พร้อม test-only environment values | PASS | `133 suites`, `1423 tests` ผ่านทั้งหมด |
| Coverage: focused after removal | focused command เดิมพร้อม `--coverage --coverageReporters=text-summary` | PASS | `160 tests` ผ่าน; repository-wide collection ใน focused run ได้ statements `16.54%`, branches `19.39%`, functions `19.50%`, lines `16.78%` |

## Guarantees

| # | What is guaranteed | Test target | Type | Result |
| - | ------------------ | ----------- | ---- | ------ |
| 1 | Swagger มี `GET /operator-factories` และใช้ Bearer + `dashboard:view` | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 2 | Query ระบุ `systemType`, `favoriteOnly` และ `pomsMembershipStatus` พร้อม enum ที่ถูกต้อง | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 3 | Row แยก `IN_POMS`/`NOT_IN_POMS` โดยไม่คืน `latestConnectionRequest` หรือ schema รายละเอียดคำขอ | `api-docs.openapi.test.ts`, `connection-requests.service.test.ts` | Runtime/OpenAPI contract | PASS |
| 4 | Summary มี `all`, `inPoms`, `connectionInProgress` และ `notConnected` | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 5 | Endpoint registry และ Swagger ครอบคลุม 114 canonical endpoints / 123 operations | `api-docs.openapi.test.ts` | Registry parity | PASS |
| 6 | ผู้ประกอบการเห็นโรงงานของตนเองทั้งที่เชื่อมและยังไม่เชื่อม โดยใช้ `OWN_FACTORY` เสมอ | `connection-requests.service.test.ts` | Service authorization/regression | PASS |
| 7 | ผู้ใช้ที่ไม่ใช่ operator ถูกปฏิเสธ และ query ผิดตอบ validation error | `connection-requests.operator-factories.route.test.ts` | Route integration | PASS |

## Coverage and gaps

Full coverage suite ของ endpoint ตอนเพิ่มครั้งแรกผ่าน `133 suites / 1423 tests`; repository-wide coverage คือ statements `66.45%`, branches `64.67%`, functions `69.60%` และ lines `68.27%`. รอบถอด field นี้ full regression ปกติยังผ่าน `1423/1423` และ focused coverage ผ่าน `160/160`. การรัน full coverage รอบล่าสุดพบ flaky failures เดิม 3 รายการใน `kwp-form-submissions.route.test.ts` แต่ suite เดียวกันผ่าน `44/44` เมื่อรัน coverage แยก จึงไม่เกี่ยวกับไฟล์หรือ behavior ที่เปลี่ยน. ตัวเลขทั้ง repository ต่ำกว่าเป้าหมาย 80% เพราะรวม migration, repository และ integration modules เดิมที่ไม่มี coverage ครบ แต่ behavior ที่เปลี่ยนมี focused service และ OpenAPI tests โดยตรง.
