# เจ้าหน้าที่เลือกใช้รหัสจุดตรวจวัดเดิมหรือให้ระบบออกรหัสอัตโนมัติ

หลักฐานนี้สนับสนุน [สัญญา API เมนูขอเชื่อมต่อ](../../api/menus/connection-requests/README.md) และ [payload/validation ของเมนูขอเชื่อมต่อ](../../api/menus/connection-requests/request-payloads-and-validation.md).

## Source

User journey และ acceptance criteria มาจากคำขอในงานนี้ ไม่มีไฟล์แผนภายนอก.

## User Journey

ในฐานะเจ้าหน้าที่ผู้พิจารณาคำขอ ฉันต้องการเลือกได้ต่อจุดตรวจวัดว่าจะ reuse รหัส legacy เดิมหรือให้ระบบออกรหัสใหม่อัตโนมัติ เพื่อให้จุดเก่าใช้ช่วง `S/W0001-1999` ได้ และจุดใหม่ยังใช้ช่วง auto `S/W2001-9999` โดยไม่ชนกับรหัสที่เคยถูกใช้ไปแล้ว.

## Task Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: contract | `npm test -- --runInBand tests/unit/connection-requests.validator.test.ts` | FAIL: 5 tests ใหม่ | schema เดิมยังไม่รับ `pointCodeAssignments` |
| RED: repository | `npm test -- --runInBand tests/unit/connection-requests.point-code-sequence.repository.test.ts` | FAIL: 1 test ใหม่ | repository เดิมยังไม่ตรวจรหัส legacy ที่ชนกับรหัสซึ่งเชื่อมต่อแล้ว |
| GREEN | `npm test -- --runInBand tests/unit/connection-requests.validator.test.ts tests/unit/connection-requests.point-code-sequence.repository.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts tests/unit/point-code-registry-migration.test.ts tests/unit/api-docs.openapi.test.ts` | PASS: 6 suites, 227 tests | approve contract, mixed assignment, registry, direct connection, migration และ OpenAPI ผ่านพร้อมกัน |
| Full backend suite | `npm test -- --runInBand` | PASS: 132 suites, 1405 tests | ไม่พบ regression ใน backend suite |
| Typecheck | `npm run typecheck` | PASS | TypeScript ไม่มี type error หลังเพิ่ม assignment mode, registry และ response field ใหม่ |
| Build | `npm run build` | PASS | backend build สำเร็จ |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | `APPROVE_DESIGN`/`APPROVE_FORM` รับ `pointCodeAssignments` แบบ optional และ validate `AUTO`/`MANUAL_LEGACY` | `connection-requests.validator.test.ts` | Validator unit | PASS |
| 2 | service ส่ง `pointCodeAssignments` ต่อไปยัง repository เฉพาะ approve branch | `connection-requests.service.test.ts` | Service unit | PASS |
| 3 | repository อนุญาต mixed assignment เช่น `S1000` + `S2001` ในคำขอเดียวกัน | `connection-requests.point-code-sequence.repository.test.ts` | Repository unit | PASS |
| 4 | `MANUAL_LEGACY` บังคับ prefix ตามระบบและช่วงเลข `0001-1999` | `connection-requests.point-code-sequence.repository.test.ts` + `connection-requests.validator.test.ts` | Repository + validator | PASS |
| 5 | omission ของ `pointCodeAssignments` ยังหมายถึง `AUTO` ทุกจุดและ auto เริ่มที่ `S/W2001` | `connection-requests.point-code-sequence.repository.test.ts` | Repository unit | PASS |
| 6 | registry ใหม่กันรหัสซ้ำทั้ง manual, auto และ direct connection | `connection-requests.point-code-sequence.repository.test.ts` + `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository unit | PASS |
| 7 | migration `0095_create_point_code_registry` สร้าง registry แบบ immutable และ backfill owner เดิมอย่าง deterministic | `point-code-registry-migration.test.ts` | Migration unit | PASS |
| 8 | runtime OpenAPI เปิดเผย request/response field ใหม่และ enum `pointCodeAssignmentMode` | `api-docs.openapi.test.ts` | OpenAPI unit | PASS |

## Coverage and Known Gaps

งานนี้ครอบคลุมเฉพาะ backend contract, validation, repository transaction, migration และ canonical docs/OpenAPI ตาม scope ที่ผู้ใช้อนุมัติ. ไม่ได้แก้ `frontend/`; client เดิมที่ไม่ส่ง `pointCodeAssignments` ยังใช้ behavior `AUTO` ทุกจุดได้ตามเดิม.

Migration ผ่าน unit test ของโครงสร้าง SQL และ backfill แล้ว แต่ยังไม่ได้ apply กับฐาน MSSQL จริงใน workspace นี้; ก่อน deploy ควรสำรองข้อมูลและรัน migration ใน staging พร้อมตรวจรายการรหัสซ้ำย้อนหลัง.
