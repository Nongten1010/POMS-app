# หลักฐาน TDD: POMS factory form คืนข้อมูลผู้ติดต่อและอีเมลแจ้งเตือน

เอกสารนี้สนับสนุน canonical contract [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesfactoryidform) และ runtime OpenAPI ของ `GET /api/v1/poms-factories/:factoryId/form`.

## Source and journey

ไม่มี plan file. Journey มาจากกรณีผู้ประกอบการเปิดฟอร์ม `MEASUREMENT_POINTS` ของโรงงาน current/live แล้ว API ไม่ส่งผู้ติดต่อประสานงาน อีเมลแจ้งเตือนโรงงาน และอีเมลแจ้งเตือนเจ้าหน้าที่กลับมา prefill.

ในฐานะผู้ประกอบการ เมื่อเปิดฟอร์มจุดตรวจวัดของระบบ CEMS หรือ WPMS ต้องได้รับ `contactPersons`, `notificationEmails` และ `officerNotificationEmails` จากคำขอเชื่อมต่อต้นทางล่าสุดที่ผูกกับ active point ของระบบที่เลือก เพื่อไม่ต้องกรอกข้อมูลเดิมซ้ำ.

## RED → GREEN

| Stage | Command | Result | Evidence |
| ----- | ------- | ------ | -------- |
| RED: service seam | `npm test -- --runInBand tests/unit/poms-factories.service.test.ts` | EXPECTED FAIL | TypeScript `TS2339`: repository ยังไม่มี `findFactoryFormContacts`; test จึงยืนยันว่า form service ยังไม่มีทางโหลด 3 กลุ่มข้อมูล |
| RED: OpenAPI | `npm test -- --runInBand tests/unit/poms-factories.openapi.test.ts` | EXPECTED FAIL | `1 failed, 10 passed`; operation description ยังไม่ระบุ `source_request_id` ของข้อมูล prefill |
| GREEN: focused | `npm test -- --runInBand tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.repository.test.ts tests/unit/poms-factories.openapi.test.ts` | PASS | `3 suites, 60 tests` ผ่าน รวม source-request, empty และ legacy fallback |
| GREEN: typecheck | `npm run typecheck` | PASS | `tsc --noEmit` ผ่าน |
| Flake triage | `npm test -- --runInBand tests/unit/eligible-factories.route.test.ts` | PASS | intermediate full run พบ unrelated `501` หนึ่งครั้ง; suite ที่ล้มผ่านแยก `15/15` |
| GREEN: full regression | `npm test -- --runInBand` | PASS | final rerun ผ่าน `182 suites, 1909 tests` |
| Coverage: focused | `npm run test:coverage -- --runInBand tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.repository.test.ts tests/unit/poms-factories.openapi.test.ts --collectCoverageFrom=src/modules/poms-factories/poms-factories.service.ts --collectCoverageFrom=src/modules/poms-factories/poms-factories.repository.ts --collectCoverageFrom=src/modules/api-docs/poms.openapi.ts` | PASS | `60 tests`; statements `68.02%`, branches `61.86%`, functions `64.70%`, lines `69.26%` |

## Guarantees

| # | What is guaranteed | Test target | Type | Result |
| - | ------------------ | ----------- | ---- | ------ |
| 1 | Query เลือกเฉพาะ active connected point ของ `eligibleFactoryId` และ `systemType` ที่เปิดอยู่ | `poms-factories.repository.test.ts: reads form contacts from the latest source request for the selected system` | Repository contract | PASS |
| 2 | Query join `cems_wpms_connection_requests` ผ่าน `source_request_id` และเลือกคำขอล่าสุดแบบ deterministic | test เดียวกับข้อ 1 | Repository contract | PASS |
| 3 | API คืน `contactName`, `contactPhone`, `contactEmail`, `contactPersons`, `notificationEmails` และ `officerNotificationEmails` จาก source request | `poms-factories.service.test.ts: prefills contacts and notification emails from the source request for the selected system` | Service regression | PASS |
| 4 | เมื่อ JSON รุ่นใหม่ไม่มีค่า จะ fallback ผู้ติดต่อและอีเมลโรงงานจาก legacy fields โดยไม่สร้างอีเมลเจ้าหน้าที่ | `poms-factories.repository.test.ts: falls back to legacy contact fields when contact and factory-email JSON are empty` | Compatibility unit | PASS |
| 5 | เมื่อ active point ไม่มี source request response ยังคงส่ง `contactPersons` และ email arrays เป็น `[]` | `poms-factories.service.test.ts: builds a POMS form with the exact connection-request field names and live values` | Service fallback | PASS |
| 6 | Runtime OpenAPI ระบุ source และ fallback ของ 3 กลุ่มข้อมูล | `poms-factories.openapi.test.ts` | OpenAPI contract | PASS |

## Coverage and known gaps

Focused service coverage ผ่านเกณฑ์ 80% ที่ statements `83.58%` และ lines `85.36%`; OpenAPI ได้ statements `97.85%` และ lines `98.47%`. ตัวเลขรวมต่ำกว่า 80% เพราะ `poms-factories.repository.ts` เป็นไฟล์เดิมขนาดใหญ่และ focused run ไม่ได้ขับทุก workflow ในไฟล์นั้น (statements `41.66%`, lines `42.50%`). Behavior ที่เพิ่มมี query-shape, mapping, legacy fallback, service output และ OpenAPI tests โดยตรง แต่ยังไม่มี integration test กับฐานข้อมูลจริง.

ไม่มี checkpoint commit ในรอบนี้ เพราะผู้ใช้ไม่ได้อนุญาตให้ commit; หลักฐาน RED/GREEN ถูกเก็บในเอกสารนี้แทน.
