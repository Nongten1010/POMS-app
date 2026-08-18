# หลักฐาน TDD: โรงงานของผู้ประกอบการพร้อมสถานะ POMS

เอกสารนี้สนับสนุน canonical contract [หน้าหลัก](../../api/menus/home/README.md#get-apiv1operator-factories) และ runtime OpenAPI ของ `GET /api/v1/operator-factories`.

## Source and journey

ไม่มี plan file. Journey มาจากกรณีผู้ประกอบการ login แล้วเข้าใจว่าไม่มีโรงงาน เพราะ dashboard เดิมแสดงเฉพาะโรงงานที่เชื่อม POMS แล้ว.

ในฐานะผู้ประกอบการ ต้องเห็นโรงงานของตนเองทั้งหมดที่ sync ตอน login พร้อมสถานะว่าอยู่ใน POMS, อยู่ระหว่างเชื่อมต่อ หรือยังไม่เชื่อมต่อ โดยไม่ปะปน POMS membership กับ eligibility.

## RED → GREEN

| Stage | Command | Result | Evidence |
| ----- | ------- | ------ | -------- |
| RED | `npm test -- --runInBand tests/unit/api-docs.openapi.test.ts` พร้อม test-only environment values | EXPECTED FAIL | `1 failed, 60 passed`; contract test หา `/operator-factories` ใน OpenAPI ไม่พบ |
| GREEN | command เดิม | PASS | `61 passed`; path, query, bearer permission, response schema, latest request และ summary ตรง contract |

## Guarantees

| # | What is guaranteed | Test target | Type | Result |
| - | ------------------ | ----------- | ---- | ------ |
| 1 | Swagger มี `GET /operator-factories` และใช้ Bearer + `dashboard:view` | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 2 | Query ระบุ `systemType`, `favoriteOnly` และ `pomsMembershipStatus` พร้อม enum ที่ถูกต้อง | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 3 | Row แยก `IN_POMS`/`NOT_IN_POMS` และมี latest `NEW_CONNECTION` request แบบ nullable | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 4 | Summary มี `all`, `inPoms`, `connectionInProgress` และ `notConnected` | `api-docs.openapi.test.ts` | OpenAPI contract | PASS |
| 5 | Endpoint registry และ Swagger ครอบคลุม 114 canonical endpoints / 123 operations | `api-docs.openapi.test.ts` | Registry parity | PASS |

## Coverage and gaps

Focused OpenAPI suite ผ่านครบ 61 tests. งานนี้ไม่ได้รัน coverage แยกสำหรับไฟล์เอกสาร; route/service behavior อยู่ใน unit tests ของ connection requests และต้องผ่านร่วมกับ backend verification ก่อน merge.

