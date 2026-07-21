# หลักฐาน TDD: เจ้าหน้าที่เชื่อมต่อโรงงานเข้าข่ายโดยตรง

เอกสารนี้สนับสนุน contract [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md) และไม่ใช้แทน API contract.

## User journey

เจ้าหน้าที่ที่มี permission และ location scope ถูกต้องเลือกโรงงานจากรายการโรงงานเข้าข่าย แล้วส่ง `POST /api/v1/cems-wpms-requests/direct-connections`; ระบบต้องสร้างคำขอสถานะ `CONNECTED` ได้ แม้โรงงานนั้นยังไม่มี row ใน `factories` หรือ current POMS data.

## Root cause

รายการหน้าเจ้าหน้าที่มาจาก `eligible_factories` แต่ Direct Connection เคย resolve โรงงานโดยเริ่ม query จาก `factories`. Active eligible factory ที่ยังไม่มี POMS factory row จึงถูกตอบ `404 NOT_FOUND` ก่อนเริ่ม transaction.

Production ยังไม่ได้รับโค้ดแก้ไขรอบก่อน เพราะ deployment run `29836136152` ล้มที่ migration `0076_sync_connected_factory_profiles_with_eligible_factories.ts` ด้วย `Invalid column name 'eia_assessment'`. Migration เดิมเพิ่ม column และอ้างถึง column ใหม่นั้นใน SQL Server batch เดียวกัน ทำให้ SQL Server compile คำสั่ง `UPDATE` ก่อน `ALTER TABLE` มีผลและ rollback transaction ทั้งชุด. การแก้ไขจึงแยก DDL กับ backfill เป็นคนละ batch.

## RED → GREEN evidence

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.service.test.ts -t "connects an active eligible factory"` | FAIL ซ้ำ 2 รอบ | Promise ถูก reject ด้วย `Active eligible factory not found within officer access scope` ทั้งที่ active eligible fixture มีอยู่ |
| GREEN | คำสั่งเดียวกับ RED | PASS | Service ใช้ eligible-factory lookup โดยตรงและไม่เรียก `findFactoryGeneral` |
| HTTP integration | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.integration.test.ts` | PASS | Payload `factoryId=10120000325542`, `pointCode=S1125` ผ่าน route, auth, validation และ service ได้ `201 CONNECTED`; out-of-scope fixture ได้ `404` และไม่มี write |
| Focused regression | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.integration.test.ts tests/unit/connection-requests.direct-connections.lookup.repository.test.ts tests/unit/connection-requests.direct-connections.service.test.ts tests/unit/connection-requests.repository.test.ts` | PASS: 4 suites, 37 tests | ครอบคลุม canonical identity, identifier aliases, region, province และ fail-closed scope |
| Migration RED | `npm test -- --runInBand tests/unit/connected-factory-profile-migration.test.ts` | FAIL ก่อนแก้ | ตรวจพบว่า DDL และ backfill อยู่ใน SQL Server batch เดียวกัน |
| Migration GREEN | คำสั่งเดียวกับ Migration RED | PASS | DDL กับ backfill ถูกแยกเป็นคนละ `knex.schema.raw` batch |
| Full backend | `npm test -- --runInBand` | PASS: 77 suites, 705 tests | รอบยืนยันหลังแก้ lookup และ migration ผ่านทั้งหมด |
| Type/build/lint | `npm run typecheck`; `npm run build`; targeted `eslint`/`prettier` | PASS | Production TypeScript compile และไฟล์ที่เปลี่ยนไม่มี lint/format error |

RED checkpoint commits: `964ee20`, `3a9a45c`, `ea6504c`.

## Test specification

| # | สิ่งที่รับประกัน | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Active eligible factory ไม่ต้องมี `factories` row ก่อน Direct Connection | `connection-requests.direct-connections.integration.test.ts` | HTTP integration | PASS |
| 2 | Backend ใช้ชื่อและเลขทะเบียน canonical จาก `eligible_factories` | `connection-requests.direct-connections.lookup.repository.test.ts` | Repository unit | PASS |
| 3 | Resolve ได้จาก source ID, เลขทะเบียนใหม่ หรือเลขทะเบียนเก่า | `connection-requests.repository.test.ts` | Query unit | PASS |
| 4 | Region/province scope ใช้ location ของ eligible factory | `connection-requests.repository.test.ts` | Authorization query unit | PASS |
| 5 | Scope ที่ประเมินไม่ได้ fail closed | `connection-requests.repository.test.ts` | Security unit | PASS |
| 6 | โรงงานนอก scope ยังได้ `404` และไม่เริ่ม write | `connection-requests.direct-connections.integration.test.ts` | HTTP integration | PASS |

## Coverage and known gaps

`npm run test:coverage -- --runInBand` ผ่าน 76 suites/700 tests แต่ repository-wide coverage เดิมอยู่ที่ statements `53.65%`, branches `51.72%`, functions `56.71%`, lines `54.85%`, ต่ำกว่าเป้าหมาย 80% ของ TDD skill. Regression paths ในงานนี้มี focused tests ครบ แต่ยังไม่อ้างว่า repository ทั้งโครงการผ่าน coverage gate.

Production route smoke แบบไม่มี credential คืน `401 UNAUTHORIZED` จาก endpoint ที่ถูกต้อง จึงยืนยันได้เฉพาะ routing. การยืนยัน `201` กับ production DB ต้องทำหลัง deploy ด้วย officer session จริง โดยห้ามบันทึก token ลง repository หรือเอกสารนี้.

`npm audit --omit=dev` พบ advisory เดิมระดับ low ใน `body-parser`; งานนี้ไม่ได้เปลี่ยน dependency.
