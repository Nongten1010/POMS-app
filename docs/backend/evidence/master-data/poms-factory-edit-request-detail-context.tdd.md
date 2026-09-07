# หลักฐาน TDD: รายละเอียดคำขอแก้ไขโรงงานแยกข้อมูลปัจจุบันและข้อมูลที่เสนอ

เอกสารนี้สนับสนุน canonical contract [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesedit-requestsid) และ runtime OpenAPI ของ `GET /api/v1/poms-factories/edit-requests/:id`

## Source and user journey

ไม่มี plan file; journey มาจากกรณี request ID `16` ซึ่ง response ไม่ส่งผู้ติดต่อ/อีเมลแจ้งเตือน และ `currentMeasurementPoints[].details.*Parameters` มีค่าเหมือน `proposedMeasurementPoints[].details.*Parameters` แม้มีการขอเปลี่ยนพารามิเตอร์

ในฐานะผู้ตรวจคำขอ เมื่อเปิดรายละเอียดคำขอแก้ไขจุดตรวจวัด ต้องเห็นข้อมูลผู้ติดต่อและอีเมลแจ้งเตือนครบ พร้อมเปรียบเทียบพารามิเตอร์ปัจจุบันกับพารามิเตอร์ที่เสนอได้ถูกต้อง

## RED -> GREEN

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| Baseline | `npm test -- --runInBand tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.repository.test.ts tests/unit/poms-factories.openapi.test.ts` | PASS | `3 suites, 63 tests` ผ่านก่อนเพิ่ม regression tests |
| RED: service | `npm test -- --runInBand tests/unit/poms-factories.service.test.ts -t "returns contacts and notification emails on edit-request detail\|separates current connected parameters from the proposed edit-request parameters"` | EXPECTED FAIL | 2 tests ล้ม: contact query ถูกเรียก 0 ครั้ง และ current details ยังคืน proposed parameter set |
| RED: OpenAPI | `npm test -- --runInBand tests/unit/poms-factories.openapi.test.ts -t "documents contacts and distinct current/proposed parameters on edit-request detail"` | EXPECTED FAIL | GET detail ยังอ้าง `PomsFactoryEditRequestResponse` ซึ่งไม่มี detail fields ใหม่ |
| GREEN: regression | `npm test -- --runInBand tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.openapi.test.ts -t "returns contacts and notification emails on edit-request detail\|separates current connected parameters from the proposed edit-request parameters\|documents contacts and distinct current/proposed parameters on edit-request detail"` | PASS | `3 tests` ผ่าน |
| GREEN: focused | `npm test -- --runInBand tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.repository.test.ts tests/unit/poms-factories.route.test.ts tests/unit/poms-factories.openapi.test.ts` | PASS | `4 suites, 100 tests` ผ่าน |
| GREEN: full | `npm test -- --runInBand` | PASS | `182 suites, 1,915 tests` ผ่าน |

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Detail response คืน `contactPersons`, `notificationEmails`, `officerNotificationEmails` จาก source request ของระบบที่แก้ไข | `poms-factories.service.test.ts: returns contacts and notification emails on edit-request detail` | Service unit | PASS |
| 2 | current parameter groups derive จาก `currentMeasurementPoints[].parameters` และไม่ถูก proposed details ทับ | `poms-factories.service.test.ts: separates current connected parameters from the proposed edit-request parameters` | Regression unit | PASS |
| 3 | proposed parameter groups คง proposed snapshot ที่ผู้ใช้ส่ง | test เดียวกับข้อ 2 | Regression unit | PASS |
| 4 | HTTP route ส่ง fields ใหม่จาก service โดยไม่เปลี่ยน permission | `poms-factories.route.test.ts: gets edit-request detail before the factory-id route can capture the literal path` | Route contract | PASS |
| 5 | Runtime OpenAPI ใช้ detail response schema และอธิบาย source ของ current/proposed/contacts | `poms-factories.openapi.test.ts: documents contacts and distinct current/proposed parameters on edit-request detail` | OpenAPI contract | PASS |

## Verification, coverage, and security

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run lint`: PASS with `0 errors`; มี warning เดิมทั่ว repository `321` รายการ
- focused service coverage: statements `85.89%`, functions `87.5%`, lines `87.5%`, branches `75.3%`
- branch coverage รวมของ service ต่ำกว่า 80% จาก branches เดิมนอก scope; behavior ใหม่ครอบคลุมทั้ง contacts, current/proposed comparison และ HTTP/OpenAPI contract
- query ข้อมูลติดต่อทำหลัง scoped edit-request lookup ผ่าน `factories:view` และใช้ Knex parameter binding; ไม่มี raw SQL, secret หรือ input contract ใหม่
- การยืนยัน production หลัง deploy ใช้ GitHub Actions `Deploy POMS` และ public OpenAPI; ไม่บันทึกหรือคัดลอก production credential เข้า clean worktree
- การเรียก protected API สำหรับ request ID `16` ต้องใช้ credential ของผู้มีสิทธิ์ `factories:view` จึงแยกจาก automated release verification

## Regression: request 19 provider fields and admin-role review

สองอาการที่แจ้งคือ detail ไม่มีผู้ให้ข้อมูล/ผู้รับมอบอำนาจ และผู้ใช้ frontend ที่ได้รับ role admin เรียก review แล้วได้ 403

- Root cause ของ provider: query, mapper และ detail DTO ไม่ส่ง `informationProviderName`/`informationProviderPosition`; BASIC_INFO ไม่มี point snapshots จึงข้าม source lookup อีกชั้น
- Root cause ของ review: frontend และการจัดการผู้ใช้อนุญาต `userType=officer` พร้อม role `admin` แต่ controller/service บังคับ `userType=admin` ด้วย
- Fix: ยึด role `admin` จาก JWT ที่ผ่าน authentication ร่วมกับ permissions/scope เดิม และคง self-review guard ทั้ง createdBy และ submittedBy; ไม่แก้ userType หรือข้อมูลบัญชี
- Provider อ่านจาก source request เดียวกันผ่าน active connected point; BASIC_INFO ใช้ source ล่าสุดข้ามระบบ, MEASUREMENT_POINTS ใช้ระบบที่แก้ไข และคืน null เมื่อระบบกำกวมหรือไม่มีข้อมูล
- Factory form และ edit-request form คืน provider จาก source ของ systemType ที่เลือก; proposed point values ยังคงตามคำขอ
- Detail OpenAPI ใช้ shared schema รวม properties โดยตรง เพื่อให้ additionalProperties=false ไม่ปฏิเสธ fields ที่เพิ่ม

คำสั่ง RED ที่รันก่อนแก้ implementation (จาก backend):

```bash
npm test -- --runInBand --cacheDirectory=/private/tmp/poms-diagnosis-jest tests/unit/poms-factories.route.test.ts tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.repository.test.ts
```

ผล RED: 8 failed, 87 passed; ตรวจจับ officer/admin-role ได้ 403 แทน 200, query ไม่เลือก provider columns, mapper/response ทิ้งค่า และ BASIC_INFO ไม่เรียก source lookup

คำสั่ง GREEN รอบสุดท้าย:

```bash
npm test -- --runInBand --cacheDirectory=/private/tmp/poms-diagnosis-jest tests/unit/poms-factories.route.test.ts tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.repository.test.ts tests/unit/poms-factories.cancel.service.test.ts tests/unit/poms-factories.openapi.test.ts tests/unit/poms-measurement-point-edit-requests.service.test.ts tests/unit/poms-measurement-point-edit-requests.openapi.test.ts
```

ผล: 7 suites / 126 tests PASS รวม provider/null fallback, query หลัง scoped lookup, BASIC_INFO, mixed-system WPMS form, admin role, missing permissions, non-admin rejection, self-review และ cancellation; `npm run typecheck` PASS; ESLint เฉพาะ 10 ไฟล์ TypeScript ที่แตะมี 0 errors / 1 existing non-null-assertion warning ใน repository test; `git diff --check` PASS

ใช้ diagnosing-bugs เพื่อสร้าง RED/GREEN, backend-patterns เพื่อคงชั้น repository/service และตรวจสิทธิ์ที่ backend, api-design เพื่อกำหนด nullability/source และปรับ OpenAPI ให้ตรง response

- Docs impact: updated
- Canonical docs: [Factory edit requests](../../api/menus/master-data/factory-edit-requests.md)
- Reason: คืนข้อมูลผู้ให้ข้อมูลและแก้เงื่อนไข review ให้รองรับ role admin ของบัญชีเจ้าหน้าที่
- Client impact: อ่าน provider fields ระดับ data ได้; admin role ไม่ถูกปฏิเสธเพราะ userType=officer; ไม่มี input fields ใหม่หรือ migration
- Breaking change: no

ข้อจำกัดในรอบ implementation: ยืนยันกับโค้ดและข้อมูลจำลอง ไม่ได้ตรวจค่าจริงของ request 19 เพราะ SELECT จบด้วย ETIMEOUT; ไม่มี debug instrumentation ค้างใน source

Production release preflight: เตรียมเฉพาะ regression นี้บน clean worktree จาก `d5b6a3f` โดยคงงาน prefill/detail ที่เผยแพร่แล้ว; focused 7 suites / 126 tests, typecheck และ build ผ่านซ้ำ ใช้ dummy environment โดยไม่มี production credentials ใน worktree ไม่เพิ่ม migration และไม่แก้ frontend; การตรวจหลังเผยแพร่ใช้ workflow health check และ public OpenAPI โดยไม่ POST review เพื่อเปลี่ยนสถานะคำขอจริง
