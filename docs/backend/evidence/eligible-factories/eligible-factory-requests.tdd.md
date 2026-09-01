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
