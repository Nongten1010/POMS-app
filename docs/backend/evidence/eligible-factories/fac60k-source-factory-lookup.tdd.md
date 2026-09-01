# ข้อมูลต้นทาง Fac60k รายโรงงานสำหรับ flow อนุมัติ

เอกสารนี้กำหนดเป้าหมายการทดสอบของ `GET /api/v1/eligible-factories/source-factories/:factoryRegistrationNo` และสนับสนุน canonical contract [โรงงานที่เข้าข่าย: ข้อมูลต้นทาง Fac60k รายโรงงาน](../../api/menus/eligible-factories/README.md#ข้อมูลต้นทาง-fac60k-รายโรงงาน). เอกสารนี้ไม่ใช้แทน API contract และไม่บันทึกผลรันที่ยังไม่ได้ยืนยัน.

## User journeys

1. เจ้าหน้าที่เปิดคำขอเพิ่มโรงงานและกดอนุมัติจากหน้าที่ไม่ได้เริ่มด้วยการเลือกแถวในตาราง Fac60k จึงมีเพียงเลขทะเบียนโรงงาน แต่ยังไม่มีข้อมูลทั่วไปของโรงงานที่ต้องใช้ใน flow เลือกเข้าข่าย.
2. Client ใช้ `encodeURIComponent(factoryRegistrationNo)` แล้วเรียก endpoint ด้วย Bearer token ที่มี `eligible_factories:view`.
3. Backend trim path parameter และค้นหา Fac60k แบบ exact match ผ่าน `FID`, `FACREG` หรือ `DISPFACREG` โดยรับเฉพาะ `FFLAG` `0`, `1` หรือ `3` และใช้ data scope ของผู้เรียก.
4. เมื่อพบ Backend คืน `{ success: true, data }` โดย `data` เป็น candidate row เดียวและมี shape เดียวกับแถวจาก `GET /api/v1/eligible-factories/candidates` เพื่อให้ client เติมข้อมูลก่อนทำ action ถัดไป.
5. Lookup ยังคงคืนข้อมูลเมื่อเลขทะเบียนนั้นถูกเลือกเข้า `eligible_factories` แล้ว เพราะ endpoint รายโรงงานไม่ใช้ candidate-list exclusion.
6. หากไม่พบเลขทะเบียน, สถานะต้นทางไม่อยู่ในชุดที่อนุญาต หรือโรงงานอยู่นอก data scope ระบบตอบ `404` แบบเดียวกันเพื่อไม่เปิดเผยข้อมูลนอกสิทธิ์.

## Test targets

| Behavior ที่ต้องรับประกัน | Test target |
| --- | --- |
| Path parameter trim แล้วต้องยาว 1–64 ตัวอักษร และรองรับค่าที่ decode จาก path ซึ่งมี `/` เมื่อ client URL-encode แล้ว | `backend/tests/unit/eligible-factories.validator.test.ts`, `backend/tests/unit/eligible-factories.route.test.ts` |
| Route บังคับ Bearer และ `eligible_factories:view`, ส่ง access context ให้ service และคืน envelope `{ success: true, data }` | `backend/tests/unit/eligible-factories.route.test.ts` |
| Repository ใช้ exact equality กับ `FID`, `FACREG` และ `DISPFACREG`, จำกัด `FFLAG` เป็น `0`, `1`, `3` และ apply data-scope filters ก่อนคืนแถว | `backend/tests/unit/eligible-factory-candidates.repository.test.ts` |
| เมื่อ identifier เดียวกันชนหลายคอลัมน์/หลายแถว Repository เลือก deterministic ตาม `FID` → `FACREG` → `DISPFACREG` แล้วเรียง identifier ซ้ำเป็น tie-breaker | `backend/tests/unit/eligible-factory-candidates.repository.test.ts` |
| Lookup รายโรงงานไม่เรียก selected-factory exclusion แม้มี active eligible row ของเลขทะเบียนเดียวกัน | `backend/tests/unit/eligible-factory-candidates.repository.test.ts` |
| แถวที่พบ map เป็น `EligibleFactoryCandidateDTO` เหมือน candidate list รวมข้อมูลประเภทโรงงาน ที่อยู่ จังหวัด พิกัด การประกอบกิจการ สถานะ และข้อมูลประกอบที่เกี่ยวข้อง | `backend/tests/unit/eligible-factory-candidates.repository.test.ts`, `backend/tests/unit/eligible-factories.service.test.ts` |
| Service คืน `404 NOT_FOUND` เมื่อ repository ไม่พบแถวภายใน scope | `backend/tests/unit/eligible-factories.service.test.ts`, `backend/tests/unit/eligible-factories.route.test.ts` |
| Runtime OpenAPI ระบุ path, Bearer permission, path validation, candidate response schema และ `404` ตรง canonical contract | `backend/tests/unit/api-docs.openapi.test.ts`, `backend/tests/unit/api-docs.route.test.ts` |
| Endpoint registry มี route ใหม่เพียงหนึ่งแถวและยอดรวมตรง explicit mounted routes | documentation guard/endpoint registry check ตาม [CI Documentation Guard Specification](../../guides/documentation/docs-guard-spec.md) |

## Verification commands

รันจาก `backend/`:

```bash
npm test -- --runInBand \
  tests/unit/eligible-factory-candidates.repository.test.ts \
  tests/unit/eligible-factories.validator.test.ts \
  tests/unit/eligible-factories.service.test.ts \
  tests/unit/eligible-factories.route.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/api-docs.route.test.ts
npm run typecheck
```

ตรวจเอกสารจาก repository root ด้วย documentation guard เมื่อมี package script พร้อมใช้งานตาม specification. บันทึกผลจริงของคำสั่งทั้งหมดใน change summary หรือ CI run ของการส่งมอบ; ตารางด้านบนเป็น test specification เท่านั้นและไม่ได้ระบุผลการรัน.

## Scope notes

- Contract นี้เป็น read-only lookup และไม่เปลี่ยนสถานะคำขอหรือสร้าง `eligible_factories` โดยตรง.
- งานนี้ไม่แก้ `frontend/`; client wiring ของปุ่มอนุมัติและการนำ candidate row ไปเติมแบบฟอร์มเป็นงานแยกต่างหาก.
- ห้ามเก็บ access token, credential หรือข้อมูลส่วนบุคคลจริงไว้ใน evidence หรือ test fixture.
