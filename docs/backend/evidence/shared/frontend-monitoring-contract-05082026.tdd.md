# TDD Evidence: Frontend monitoring contract 05082026

เอกสารนี้สนับสนุน canonical contract ของ [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#frontend-measurement-point-handoff) และ [โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md) โดยไม่ใช้แทน API contract ดังกล่าว

## Source และ scope

- Acceptance criteria มาจาก frontend handoff `frontend/md/fixed-05082026.md`; ไฟล์นั้นเป็น input ของงาน ไม่ใช่ canonical backend documentation และไม่ได้ถูกแก้ในงานนี้
- Backend รองรับ CEMS fuel percentage ที่เป็น `null`, single regulation clause และช่อง `อื่นๆ` ในคำขอเพิ่มจุด/เชื่อมต่อโดยตรง/ส่งแบบซ้ำ
- Monitoring-point form รับและคืน `timeSharingParameters`, `sharedStackCode`, `monitoringPointStatus` ที่ระดับ `points[]` โดยเก็บใน `details_json` เดิม จึงไม่ต้องเพิ่ม migration
- รายการโรงงานเข้าข่ายคืน summary ของ CEMS/WPMS เสมอ โดย derive จากสถานะรายจุดใน monitoring form; candidates contract ไม่เปลี่ยน

## RED / GREEN

| Stage | Command/target | Result | Guarantee |
| --- | --- | --- | --- |
| RED: connection request | `connection-request-form-enhancements.validator`, `connection-requests.create.route`, `connection-requests.direct-connections.validator` | 7 tests ล้มจาก 75 tests เพราะ schema เดิมยังไม่รับ single clause/new Other contract ครบ | tests จับ request shape ของ operator, direct connection และ resubmit |
| RED: monitoring form | `monitoring-point-forms.validator`, `monitoring-point-forms.repository`, `monitoring-point-forms.route` | 7 tests ล้มจาก 27 tests เพราะ strict schema/repository เดิมยังไม่รับหรือ project 3 fields ใหม่ | tests จับ validation, persistence และ HTTP response |
| RED: eligible summary | `eligible-factories.repository`, `eligible-factories.service`, `eligible-factory-status-summary` | helper ที่วางแผนยังไม่มี และ response/repository ยังไม่มี fields ใหม่ | tests ล็อกกติกา empty/mixed/all-connected/all-exempted |
| GREEN | 9 focused suites เดิม | PASS: 121 tests | contract หลักทั้งสามกลุ่มทำงานร่วมกัน |
| Reviewer RED | `connection-request-form-enhancements.validator.test.ts` | FAIL เฉพาะ 2 regression ใหม่จาก 48 tests: legacy single-item array และข้อความ `อื่นๆ` เกิน 500 ตัวอักษร | ยืนยัน compatibility และ input bound ก่อนแก้ production code |
| Reviewer GREEN | command เดียวกับ Reviewer RED | PASS: 48 tests; connection group PASS 77/77 | legacy array หนึ่งค่า normalize เป็น string, multi-value array ถูกปฏิเสธ และ Other จำกัด 500 ตัวอักษร |
| Placement RED | `monitoring-point-forms.validator.test.ts` | FAIL 3 tests ใหม่; schema เดิมยอมรับ typed fields ที่วางผิดใต้ `details` | จับ silent data loss จาก field placement ที่ผิด contract |
| Placement GREEN | command เดียวกับ Placement RED | PASS: 21/21 tests | misnested `timeSharingParameters`, `sharedStackCode`, `monitoringPointStatus` ถูกปฏิเสธพร้อม field path |

TDD checkpoints:

- `356b7a2 test: add RED coverage for frontend monitoring contracts`
- `9a20a0d feat: support frontend monitoring contracts`
- `011b3da test: add clause compatibility regressions`
- `4c76a90 fix: harden regulation clause compatibility`
- `fb823e4 test: reject misnested monitoring fields`
- `cb406a3 fix: reject misnested monitoring fields`

## Test specification

| Behavior | Test evidence | Result |
| --- | --- | --- |
| `primaryFuelPercent` และ `secondaryFuelPercent` รับ `null`; `sharedStackCode` ใช้ key เดิม | connection validator/route/direct tests | PASS |
| canonical regulation clause เป็น supported string หรือ `null`; `อื่นๆ` บังคับข้อความไม่เกิน 500 ตัวอักษร | connection validator tests | PASS |
| legacy supported array หนึ่งค่า normalize เป็น string แต่ array หลายค่าถูกปฏิเสธ | resubmit/add-point validator tests | PASS |
| WPMS ปฏิเสธ regulation-clause fields ที่เป็น CEMS-only | direct connection tests | PASS |
| `ไม่มี` ใน time sharing ต้องอยู่ค่าเดียวและทำให้ shared stack เป็น `null` | monitoring validator/repository tests | PASS |
| status รายจุดต้องตรงหนึ่งใน 7 ค่า และ legacy/missing details คืน default ที่ปลอดภัย | monitoring validator/repository tests | PASS |
| 3 typed fields ต้องอยู่ใต้ `points[]` โดยตรง; การวางซ้ำใต้ `points[].details` ถูกปฏิเสธแทนการทิ้งค่าเงียบ ๆ | monitoring validator tests | PASS |
| summary แยก CEMS/WPMS และกรณีไม่มีจุด/สถานะผสมเป็น `ยังไม่แล้วเสร็จ` | eligible helper/service/repository tests | PASS |
| `GET /eligible-factories/candidates` ไม่ถูกเพิ่ม summary fields | existing candidate service contract/full suite | PASS |

## Verification และ coverage

- `npm run build`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS ด้วย `0` errors; repository เดิมยังมี `149` warnings นอก behavior ของงาน
- `npm test -- --runInBand`: PASS `106/106` suites, `947/947` tests
- Targeted coverage: PASS `10/10` suites, `196/196` tests
- Coverage ของ executable lines ที่เพิ่ม/แก้เทียบกับก่อน RED checkpoint: statements `74/76` (`97.37%`), branches `81/88` (`92.05%`), functions `20/20` (`100%`), lines `67/67` (`100%`)
- Coverage ของไฟล์ขนาดใหญ่ทั้งไฟล์อยู่ที่ statements `72.93%`, branches `64.28%`, functions `78.67%`, lines `75.13%`; ตัวเลขนี้รวม legacy paths นอก diff ขณะที่ changed-code coverage ผ่าน 80% ทุก metric
- `git diff --check`: PASS
- JSON examples และ relative links ใน canonical docs ที่แก้ผ่านการตรวจ; repository ยังไม่มี executable `docs:check` ตาม docs-guard specification จึงตรวจแบบ targeted
- Full-repository `npm run format:check` ยังไม่ผ่านจาก style debt เดิม 35 files; source/tests ที่แก้ผ่าน targeted Prettier ยกเว้น legacy formatting เดิมใน `eligible-factories.repository.ts` ซึ่ง lint จัดเป็น warning ไม่ใช่ error

## Security review

- enum ของ clause และ monitoring status ใช้ allowlist; text `อื่นๆ` ถูก trim และจำกัด 500 ตัวอักษร
- การเก็บ fields ใหม่ใช้ JSON serialization กับ Knex flow เดิม ไม่เพิ่ม raw SQL, credential, logging หรือ public route
- source diff scan ไม่พบ password, token, API key, private key หรือ debug logging ใหม่
- `npm audit --audit-level=high` พบ baseline dependency advisories 3 รายการ (`body-parser` ระดับ low, `brace-expansion` และ `ip-address` ระดับ high); งานนี้ไม่เปลี่ยน dependency หรือ lockfile
- `monitoringPointStatus` เป็นสถานะที่ผู้มี permission เดิม `cems_wpms_requests:edit` บันทึกใน monitoring form ไม่ใช่ verified/live connection state; canonical docs ระบุ source นี้ชัดเจน หากต้องการใช้เป็นสถานะรับรองอย่างเป็นทางการต้องออกแบบ approval/permission boundary แยกต่างหาก

## Known gaps

- ไม่มี browser E2E เพราะ scope นี้แก้ backend และ canonical backend docs เท่านั้น; frontend changes เป็นไฟล์ของผู้ใช้ที่มีอยู่ก่อนและไม่ได้รวมใน commit
- ไม่มี database migration เพราะใช้ `factory_monitoring_points.details_json` ที่มีอยู่
- ไม่รัน live-database integration; repository paths ทดสอบด้วย query-chain mocks และ full unit/integration suite ของ backend
