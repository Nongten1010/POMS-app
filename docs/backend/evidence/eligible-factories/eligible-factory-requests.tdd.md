# คำขอเพิ่มโรงงานเข้าข่าย

เอกสารนี้สนับสนุน canonical contract ของ [โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md#คำขอเพิ่มโรงงาน) และ runtime OpenAPI ของ:

- `POST /api/v1/eligible-factories/add-requests`
- `GET /api/v1/eligible-factories/add-requests`
- `POST /api/v1/eligible-factories/add-requests/:id/review`
- field `eligibilityRequest` และ `canRequestEligibility` ของ `GET /api/v1/cems-wpms-requests/operator-factories`

## User journeys

1. ผู้ประกอบการส่ง `factoryId` และ `reason` เพื่อแจ้งความประสงค์ให้โรงงานที่ตนมีสิทธิ์เข้าสู่การพิจารณา
2. เจ้าหน้าที่อ่านคำขอทุกสถานะแบบ scoped ใน response เดียว และใช้ optional `search` ได้โดยไม่มี status filter หรือ pagination
3. เจ้าหน้าที่อนุมัติหรือปฏิเสธคำขอที่ยัง `PENDING_REVIEW`; ทั้งสอง action เปลี่ยนเฉพาะ request state และ audit fields โดยไม่สร้าง ไม่ restore และไม่แก้ไข `eligible_factories`
4. หน้า `ขอเชื่อมต่อ` อ่านสถานะคำขอค้างจาก response แล้วไม่แสดงปุ่มส่งซ้ำ

## TDD guarantees

| What is guaranteed | Test target |
| --- | --- |
| Submit route ต้องมี `factories:view` และ `factories:edit`, รับเฉพาะ operator และ validate body แบบ strict | `backend/tests/unit/eligible-factories.route.test.ts` |
| List route ใช้ `eligible_factories:view`, strict query รับเฉพาะ optional `search` และส่ง scope ให้ service เพื่อคืนทุกสถานะโดยไม่แบ่งหน้า | `backend/tests/unit/eligible-factories.route.test.ts` |
| Review route ต้องมี `eligible_factories:view` และ `eligible_factories:approve`; REJECT บังคับ `officerNote` | `backend/tests/unit/eligible-factories.route.test.ts`, `backend/tests/unit/eligible-factories.service.test.ts` |
| Service ตรวจ owner scope, active eligible, open request ซ้ำ, self-review และ terminal state | `backend/tests/unit/eligible-factories.service.test.ts` |
| APPROVE เปลี่ยนสถานะเป็น `APPROVED`; REJECT เปลี่ยนเป็น `REJECTED`; ทั้งสองบันทึก `reviewedBy`, `reviewedAt`, `reviewNote` และไม่เขียน `eligible_factories`; repository regression ล็อก query แบบไม่ filter สถานะ/ไม่ paginate และการ approve แบบ status-only | `backend/tests/unit/eligible-factories.service.test.ts`, `backend/tests/unit/eligible-factory-add-requests.repository-regression.test.ts` |
| Migration `0104_create_eligible_factory_add_requests` บังคับสถานะและหนึ่ง open request ต่อ factory master; `0105_allow_status_only_eligible_factory_add_request_approval` อนุญาต `APPROVED` ที่ไม่มี `eligible_factory_id` โดยยังอ่าน legacy link ได้ | `backend/tests/unit/eligible-factory-add-requests-migration.test.ts` |
| Operator factory list คืน `eligibilityRequest`/`canRequestEligibility` ครบทุก row และไม่ใช้ field legacy | `backend/tests/unit/connection-requests.operator-factories.route.test.ts`, `backend/tests/unit/connection-requests.operator-factories.repository.test.ts` |
| OpenAPI paths, request examples, permissions, response schemas และ endpoint count ตรง runtime/registry | `backend/tests/unit/api-docs.openapi.test.ts` |

## Verification commands

รันจาก `backend/`:

```bash
npm test -- --runInBand \
  tests/unit/eligible-factory-add-requests-migration.test.ts \
  tests/unit/eligible-factory-add-requests.repository-regression.test.ts \
  tests/unit/eligible-factories.route.test.ts \
  tests/unit/eligible-factories.service.test.ts \
  tests/unit/connection-requests.operator-factories.repository.test.ts \
  tests/unit/connection-requests.operator-factories.route.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/api-docs.route.test.ts
npm run typecheck
```

บันทึกผลผ่าน/ไม่ผ่านจริงใน change summary หรือ CI run ของการส่งมอบ ไม่ใช้เอกสารนี้แทนผลรันล่าสุด

## Scope note

งาน contract รอบนี้ไม่แก้ `frontend/`; client ต้องหยุดส่ง `status`, `page`, `perPage`, แสดงข้อมูลทุกสถานะจาก response เดียว และรองรับ `eligibleFactoryId = null` สำหรับคำขอที่อนุมัติใหม่ในงาน frontend แยกต่างหาก

## การอ่านข้อมูลผู้ติดต่อในรายการคำขอ

ที่มาของกรณีทดสอบคือรายงานบัค `GET /api/v1/eligible-factories/add-requests` คืน `contactName` และ `contactPhone` เป็น `null` แม้ผู้ประกอบการส่งค่าทั้งสองฟิลด์ใน POST ไม่มีไฟล์แผนแยก เจ้าหน้าที่ต้องอ่านข้อมูลผู้ติดต่อที่บันทึกไว้ได้ทั้งก่อนและหลังพิจารณาคำขอ

สาเหตุคือ `buildEligibleFactoryAddRequestsBaseQuery` ไม่เลือก `contact_name` และ `contact_phone` จึงส่งค่าที่หายไปให้ `toAddRequestDTO` แทนด้วย `null` แก้ด้วยการเพิ่มสองคอลัมน์ใน SELECT เดิม โดยคง permission, data scope, search และลำดับรายการ

ชุดทดสอบเดิมคืนทุกคอลัมน์ในข้อมูลจำลองโดยไม่สนใจ SELECT จึงมองไม่เห็นบัคนี้ ปรับข้อมูลจำลองให้คืนเฉพาะคอลัมน์ที่ repository เลือกจริง และเพิ่มกรณีครบทั้งสามสถานะ รวมถึงการส่งผู้ติดต่อเพียงฟิลด์เดียว

### หลักฐาน RED และ GREEN

รันคำสั่งเดียวกันจาก `backend/` ก่อนและหลังแก้ production code:

```bash
npm test -- --runInBand --runTestsByPath tests/unit/eligible-factory-add-requests.repository-regression.test.ts --silent
```

- RED: เทสต์ compile และรันได้; `6 failed, 5 passed, 11 total` โดยข้อมูลจำลองมีชื่อ/เบอร์ แต่ response ได้ `null`
- GREEN: `11 passed, 11 total` หลังเพิ่มสองคอลัมน์ใน SELECT
- ไม่ทำ refactor เพิ่ม และไม่สร้าง checkpoint commit เพราะกติกาโครงการให้ commit เฉพาะเมื่อผู้ใช้สั่ง หลักฐานรอบนี้เก็บในเอกสารและเทสต์

| สิ่งที่รับประกัน | เทสต์ | ประเภท | ผล |
| --- | --- | --- | --- |
| ชื่อและเบอร์ที่บันทึกไว้ถูกอ่านผ่านคอลัมน์ที่เลือกจริงใน `PENDING_REVIEW`, `APPROVED` และ `REJECTED` | `eligible-factory-add-requests.repository-regression.test.ts`: `lists stored contacts using the query projection` | unit ของ repository | PASS |
| ผู้ติดต่อที่มีเพียงชื่อหรือเบอร์ยังคืนฟิลด์ที่มีค่า และคง `null` เฉพาะฟิลด์ที่ไม่มีค่า | เทสต์ชุดเดียวกัน | unit ของ repository | PASS |
| เบอร์ยังเก็บเลขศูนย์นำหน้า เครื่องหมาย ช่องว่างภายใน และข้อความต่อท้าย | เทสต์ชุดเดียวกัน | unit ของ repository | PASS |
| คำขอที่ไม่มีผู้ติดต่อยังคืน `null` ทั้งคู่ และรายการยังเรียง/คืนทุกสถานะโดยไม่แบ่งหน้า | `lists stored contacts using the query projection`, `lists every status without applying legacy status or pagination while preserving stable order` | unit ของ repository | PASS |

### การตรวจที่เกี่ยวข้องและ coverage

```bash
npm test -- --runInBand --runTestsByPath \
  tests/unit/eligible-factory-add-requests.repository-regression.test.ts \
  tests/unit/eligible-factories.route.test.ts \
  tests/unit/eligible-factories.service.test.ts \
  tests/unit/eligible-factories.validator.test.ts \
  tests/unit/eligible-factory-add-request-contacts.migration.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/api-docs.route.test.ts \
  --coverage \
  --collectCoverageFrom=src/modules/eligible-factories/eligible-factories.repository.ts \
  --coverageDirectory=/private/tmp/poms-contact-fix-coverage \
  --coverageReporters=text-summary --coverageReporters=json --silent
npm run typecheck
node node_modules/typescript/bin/tsc -p tsconfig.json --outDir /private/tmp/poms-contact-fix-build
node node_modules/tsc-alias/dist/bin/index.js -p tsconfig.json --outDir /private/tmp/poms-contact-fix-build
node node_modules/eslint/bin/eslint.js \
  src/modules/eligible-factories/eligible-factories.repository.ts \
  tests/unit/eligible-factory-add-requests.repository-regression.test.ts \
  src/modules/api-docs/poms.openapi.ts
```

ผลจริง: `7 suites passed`, `180 tests passed`, ไม่มีเทสต์ที่ skip; build, typecheck และ lint ผ่าน ใช้ output ของ build ใน temporary directory เพื่อไม่แทนที่ build เดิม

Coverage จาก `coverage-final.json` เฉพาะเส้นทางที่เกี่ยวข้อง:

| ฟังก์ชัน | Statements | Functions | Branches |
| --- | --- | --- | --- |
| `listAddRequests` | 100% (5/5) | 100% (1/1) | ไม่มี branch |
| `buildEligibleFactoryAddRequestsBaseQuery` | 100% (4/4) | 100% (1/1) | 100% (2/2) |
| `toAddRequestDTO` | 100% (1/1) | 100% (1/1) | 87.5% (7/8) |

Coverage ทั้งไฟล์ repository จากเทสต์เฉพาะงานนี้เป็น statements 25.28%, functions 20.83%, branches 26.21%, lines 27.27% เพราะรวมฟังก์ชันโรงงานอื่นนอกขอบเขตบัค ไม่อ้างว่าเป็น coverage ทั้ง backend และไม่เพิ่มเทสต์ของงานอื่นเพื่อดันตัวเลข

ข้อจำกัด: ไม่ได้รันกับฐานข้อมูลจริงหรือ deploy ชุดทดสอบใช้ query projection จำลองที่เคารพ SELECT ของ repository; ไม่ยืนยันว่ารายการ id 13 มีข้อมูลผู้ติดต่อในฐานจริงแล้ว และการแก้นี้ไม่เติมข้อมูลให้คำขอที่บันทึกเป็น `null` อยู่เดิม

### สัญญา API และการตรวจความปลอดภัย

อัปเดต [canonical API](../../api/menus/eligible-factories/README.md#get-apiv1eligible-factoriesadd-requests) และคำอธิบาย GET ใน `backend/src/modules/api-docs/poms.openapi.ts` ให้ชัดเจนว่าคืนค่าผู้ติดต่อที่บันทึกไว้ทุกสถานะ รูปแบบ response และ nullable fields คงเดิม จึงไม่เป็น breaking change

ตรวจ diff แล้วเพิ่มเฉพาะชื่อคอลัมน์คงที่ผ่าน Knex SELECT ไม่มี SQL จาก input, secret, log ผู้ติดต่อ หรือการขยายสิทธิ์; permission และ data scope เดิมยังทำงานผ่านเส้นทางเดิม เทสต์ route/validation และ runtime OpenAPI ที่เกี่ยวข้องผ่าน

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/eligible-factories/README.md
Reason: แก้ GET ให้คืนข้อมูลผู้ติดต่อที่บันทึกไว้ตามสัญญา API เดิม
Client impact: frontend
Breaking change: no
```
