# หลักฐาน TDD: Normalize อักขระซ่อนในอีเมลคำขอเชื่อมต่อ

เอกสารนี้สนับสนุน contract [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#email-normalization) และไม่ใช้แทน API contract.

## Source and user journey

ไม่มี source plan; user journey มาจากเหตุการณ์ที่ Direct Connection รับอีเมลซึ่งดูปกติใน UI แต่มี zero-width formatting character ติดจากการ copy/paste.

เจ้าหน้าที่ต้องส่งคำขอเชื่อมต่อที่มีอีเมลลักษณะดังกล่าวได้ โดย backend ต้องลบเฉพาะอักขระซ่อนที่กำหนดก่อน validation และต้องไม่ลบเครื่องหมาย `+` ที่ถูกต้องในอีเมล.

## RED → GREEN evidence

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.validator.test.ts` | FAIL: 2 tests, PASS: 44 tests | `contactPersons[].email`, legacy `contactEmail`, `notificationEmails[]` และ `officerNotificationEmails[]` ที่มี zero-width character ยังถูกปฏิเสธ |
| GREEN | คำสั่งเดียวกับ RED | PASS: 46 tests | shared email schema ลบ `U+200B`, `U+200C`, `U+200D`, `U+2060`, `U+FEFF` ก่อน email validation |
| Direct Connection regression | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.direct-connections.route.test.ts tests/unit/connection-requests.direct-connections.integration.test.ts` | PASS: 3 suites, 15 tests | validator, route และ integration flow ของ `OFFICER_DIRECT_API` ยังผ่าน |
| Typecheck | `npm run typecheck` | PASS | TypeScript compile ผ่าน |
| Lint | `npx eslint src/modules/connection-requests/connection-requests.validator.ts tests/unit/connection-requests.validator.test.ts` | PASS | production code และ regression tests ผ่าน lint |
| Focused coverage | `npm run test:coverage -- --runInBand tests/unit/connection-requests.validator.test.ts` | PASS: 1 suite, 46 tests | regression suite ถูกรันภายใต้ coverage instrumentation |
| Full backend | `npm test -- --runInBand --silent` | PASS: 100 suites, 873 tests | backend regression ทั้งหมดผ่าน |

## Test specification

| # | สิ่งที่รับประกัน | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Backend ลบอักขระซ่อนในอีเมลผู้ติดต่อ โรงงาน และเจ้าหน้าที่ก่อน validation | `connection-requests.validator.test.ts: removes invisible formatting characters from request email fields` | Validator unit | PASS |
| 2 | Legacy `contactEmail` ใช้ normalization เดียวกันและถูก map ไปยัง contact/notification arrays หลัง validation | `connection-requests.validator.test.ts: normalizes invisible formatting characters in legacy contact email fields` | Validator unit | PASS |
| 3 | เครื่องหมาย `+` ทั้งต้น local-part และ plus-addressing ไม่ถูกลบ | `connection-requests.validator.test.ts: preserves valid plus characters in request email fields` | Validator unit | PASS |
| 4 | Direct Connection behavior อื่นยังทำงาน | focused Direct Connection regression command | Unit + HTTP integration | PASS |

## Coverage and known gaps

Focused suite ผ่าน `46` tests แต่ Jest config เก็บ coverage ทั้ง backend ทำให้รายงานรวมของคำสั่ง focused เป็น statements `4.19%`; จึงไม่อ้างว่า full repository coverage ถึง `80%` จากคำสั่งนี้. Full backend suite ผ่าน `100` suites และ `873` tests.

ไม่ได้สร้าง TDD checkpoint commits เพราะ worktree มีการเปลี่ยนแปลงอื่นอยู่ก่อนแล้ว; RED/GREEN evidence จึงเก็บไว้ในเอกสารนี้และส่งเป็น final fix commit หลังตรวจ regression ครบถ้วน.
