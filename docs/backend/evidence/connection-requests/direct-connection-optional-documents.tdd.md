# หลักฐาน TDD: Direct Connection ไม่บังคับเอกสารหรือรูปภาพ

เอกสารนี้สนับสนุน contract [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md) และไม่ใช้แทน API contract.

## User journey

เจ้าหน้าที่สามารถเชื่อมต่อจุด CEMS ผ่าน `POST /api/v1/cems-wpms-requests/direct-connections` ได้โดยไม่ต้องส่ง `measurementPoints[0].documentsAndImages`; backend ต้อง normalize ค่าที่ไม่ส่งเป็น `[]`.

## RED → GREEN evidence

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts` | FAIL: 1 test, PASS: 4 tests | CEMS payload ที่ไม่ส่ง `documentsAndImages` ได้ `result.success = false` |
| GREEN | คำสั่งเดียวกับ RED | PASS: 5 tests | Direct Connection schema ยอมรับ payload และ normalize เป็น `documentsAndImages: []` |
| Focused regression | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.direct-connections.route.test.ts tests/unit/connection-requests.direct-connections.integration.test.ts` | PASS: 3 suites, 15 tests | Validator, HTTP route และ integration flow ของ Direct Connection ผ่าน |
| Typecheck | `npm run typecheck` | PASS | TypeScript contract ยัง compile ได้ |
| Lint | `npx eslint src/modules/connection-requests/connection-requests.validator.ts tests/unit/connection-requests.direct-connections.validator.test.ts tests/unit/connection-requests.direct-connections.integration.test.ts` | PASS | ไฟล์ production และ tests ที่แก้ผ่าน lint |
| Focused coverage | `npm run test:coverage -- --runInBand tests/unit/connection-requests.direct-connections.validator.test.ts` | PASS: 1 suite, 5 tests | Regression test ใหม่ถูกรันภายใต้ coverage instrumentation |
| Full backend | `npm test -- --runInBand` | FAIL: 1 suite; PASS: 99 suites | 3 tests ของ `officer-notification-email-recipients.route.test.ts` timeout จากการเชื่อม SQL Server `172.16.31.184:1433`; ไม่เกี่ยวกับ Direct Connection |

## Test specification

| # | สิ่งที่รับประกัน | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Direct Connection แบบ CEMS ไม่บังคับ `documentsAndImages` | `connection-requests.direct-connections.validator.test.ts` | Validator unit | PASS |
| 2 | ถ้าไม่ส่งฟิลด์ backend ส่งต่อค่า `[]` จนถึง repository | `connection-requests.direct-connections.validator.test.ts`, `connection-requests.direct-connections.integration.test.ts` | Unit + HTTP integration | PASS |
| 3 | กฎอื่นของ Direct Connection เช่น 1 จุดต่อ request และ `pointCode` ยังทำงาน | focused regression command | Unit + integration | PASS |

## Coverage and known gaps

Focused coverage ของ validator ผ่าน 5 tests. การรัน coverage ที่รวม HTTP tests ไม่สำเร็จใน sandbox เพราะ local listener ถูกปฏิเสธด้วย `EPERM 0.0.0.0`. Full repository coverage จึงไม่ถูกอ้างว่าผ่าน 80% ในงานนี้.

ไม่ได้สร้าง checkpoint commit เพราะ worktree มีไฟล์ของผู้ใช้ที่กำลังแก้อยู่นอก scope งานนี้.
