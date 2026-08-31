# คำขอเพิ่มโรงงานเข้าข่าย

เอกสารนี้สนับสนุน canonical contract ของ [โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md#คำขอเพิ่มโรงงาน) และ runtime OpenAPI ของ:

- `POST /api/v1/eligible-factories/add-requests`
- `GET /api/v1/eligible-factories/add-requests`
- `POST /api/v1/eligible-factories/add-requests/:id/review`
- field `eligibilityRequest` และ `canRequestEligibility` ของ `GET /api/v1/cems-wpms-requests/operator-factories`

## User journeys

1. ผู้ประกอบการส่ง `factoryId` และ `reason` เพื่อแจ้งความประสงค์ให้โรงงานที่ตนมีสิทธิ์เข้าสู่การพิจารณา
2. เจ้าหน้าที่อ่านคิวแบบ scoped, filter/search และ pagination ได้
3. เจ้าหน้าที่อนุมัติหรือปฏิเสธคำขอที่ยัง `PENDING_REVIEW`; การอนุมัติสร้างหรือ restore `eligible_factories` แบบ atomic
4. หน้า `ขอเชื่อมต่อ` อ่านสถานะคำขอค้างจาก response แล้วไม่แสดงปุ่มส่งซ้ำ

## TDD guarantees

| What is guaranteed | Test target |
| --- | --- |
| Submit route ต้องมี `factories:view` และ `factories:edit`, รับเฉพาะ operator และ validate body แบบ strict | `backend/tests/unit/eligible-factories.route.test.ts` |
| List route ใช้ `eligible_factories:view`, default `PENDING_REVIEW` และส่ง pagination/scope ให้ service | `backend/tests/unit/eligible-factories.route.test.ts` |
| Review route ต้องมี `eligible_factories:view` และ `eligible_factories:approve`; REJECT บังคับ `officerNote` | `backend/tests/unit/eligible-factories.route.test.ts`, `backend/tests/unit/eligible-factories.service.test.ts` |
| Service ตรวจ owner scope, active eligible, open request ซ้ำ, self-review และ terminal state | `backend/tests/unit/eligible-factories.service.test.ts` |
| APPROVE link eligible row และ request state ใน transaction เดียว; REJECT ปิด request โดยไม่สร้าง eligible row | `backend/tests/unit/eligible-factories.service.test.ts`, repository tests ที่เกี่ยวข้อง |
| Migration บังคับสถานะ `PENDING_REVIEW`, `APPROVED`, `REJECTED` และหนึ่ง open request ต่อ factory master | `backend/tests/unit/eligible-factory-add-requests-migration.test.ts` |
| Operator factory list คืน `eligibilityRequest`/`canRequestEligibility` ครบทุก row และไม่ใช้ field legacy | `backend/tests/unit/connection-requests.operator-factories.route.test.ts`, `backend/tests/unit/connection-requests.operator-factories.repository.test.ts` |
| OpenAPI paths, request examples, permissions, response schemas และ endpoint count ตรง runtime/registry | `backend/tests/unit/api-docs.openapi.test.ts` |

## Verification commands

รันจาก `backend/`:

```bash
npm test -- --runInBand \
  tests/unit/eligible-factory-add-requests-migration.test.ts \
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

งาน contract รอบนี้ไม่แก้ `frontend/`; client ต้อง wire ปุ่ม `แจ้งความประสงค์`, modal เหตุผล และตาราง `ขอเพิ่มโรงงาน` เข้ากับ endpoints ข้างต้นในงาน frontend แยกต่างหาก
