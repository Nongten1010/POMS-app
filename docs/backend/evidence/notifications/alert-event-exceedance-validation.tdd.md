# หลักฐาน TDD: ตรวจค่าเกินก่อนรับเหตุการณ์

[กลับไป Evidence Index](../README.md) · [สัญญา Integration Alert Events](../../api/integrations/alert-events/README.md) · [Breaking change](../../api/CHANGELOG.md#alert-event-exceedance-validation)

## ขอบเขตหลักฐาน

ผู้ใช้อนุมัติให้แก้ช่องรับเหตุการณ์ค่าเกิน โดย `measuredValue` และ `thresholdValue` ต้องเป็น finite number และค่าตรวจวัดต้องมากกว่าเกณฑ์จริงทั้ง `STANDARD` และ `EIA` ตัวเลขแบบ string ที่ไม่ว่างและแปลงได้ยังรองรับตามพฤติกรรมเดิม

การทดสอบ HTTP ใช้ middleware, controller และ service จริง แต่จำลอง repository ไม่เชื่อม SQL Server หรือ SMTP จริง ไม่สร้าง detector ที่อ่าน raw measurements และไม่แก้เหตุการณ์เก่าย้อนหลัง การผ่านชุดนี้พิสูจน์ validation กับเส้นทางก่อนบันทึก ไม่ใช่หลักฐานการส่งอีเมลครบวงจรหรือ deployment

ไม่มี checkpoint commits เพราะผู้ใช้กำหนดให้สร้าง commit เมื่อร้องขอเท่านั้น เก็บ RED/GREEN ผ่านคำสั่งและผลทดสอบแทน

## RED และ GREEN

เพิ่ม tests ก่อนแก้ implementation:

- [`alert-events.exceedance-validation.test.ts`](../../../../backend/tests/unit/alert-events.exceedance-validation.test.ts): ค่าต่ำกว่า/เท่ากับ/เกินเกณฑ์ทั้งสองประเภท, numeric strings, เปรียบเทียบโดยไม่ปัดเศษ, `null`/boolean/blank/array/object/non-finite, mixed batch, service guard ก่อน dedup และ API key
- [`alert-events.exceedance.openapi.test.ts`](../../../../backend/tests/unit/alert-events.exceedance.openapi.test.ts): runtime contract อธิบายตัวเลข finite, numeric strings, strictly greater และการปฏิเสธทั้ง batch

| Stage | ผลที่ตรวจได้ |
| --- | --- |
| RED ก่อนเพิ่ม guard | 2 suites; 30 tests failed และ 18 passed จาก 48 tests; พบค่าที่ไม่เกินเกณฑ์และชนิดข้อมูลที่ถูก coercion ยังผ่าน พร้อม contract ที่ยังไม่ประกาศกฎใหม่ |
| GREEN หลังเพิ่ม guard | 11 suites, 243 tests passed รวม tests ใหม่ 48 tests และ regression ของ alert events, identity, email engine/source/eligibility กับ OpenAPI |
| ทวน error envelope หลังเพิ่ม assertion | 2 suites, 48 tests passed; `details.events` และ `issues[].pathString` ตรงกับตัวอย่างใน canonical doc |
| TypeScript | `npm run typecheck` ผ่าน |
| Build | `npm run build` ผ่าน |
| ESLint เฉพาะไฟล์ที่เกี่ยวข้อง | 0 errors; มี formatting warnings เดิม 8 จุดใน service/validator ที่ไม่ได้แก้ในรอบนี้ ไม่มี warnings ใน helper/tests ใหม่หรือ OpenAPI |
| เอกสารและขอบเขต diff | `git diff --check` ผ่าน; local links 166 จุดผ่าน; evidence ใหม่เข้าถึงได้จาก backend hub; มีเฉพาะ backend และ canonical docs ใน diff รอบนี้ |

Sandbox จำกัดการเปิดพอร์ตชั่วคราวของ Supertest จึงรันชุด HTTP ด้วยสิทธิ์ที่รองรับ local server โดยใช้ settings ทดสอบและ repository จำลอง ความผิดพลาด `EPERM` จาก sandbox ไม่นับเป็น RED ของ business behavior

คำสั่งชุดใหม่ ใช้ค่าทดสอบเท่านั้นและไม่โหลด environment จริง:

```bash
cd backend
env NODE_ENV=test DOTENV_CONFIG_PATH=/private/tmp/poms-exceedance-no-real-env \
  DB_HOST=127.0.0.1 DB_NAME=unit_test DB_USER=unit_test DB_PASSWORD=unit_test \
  JWT_SECRET=unit-test-access-secret-exceedance \
  JWT_REFRESH_SECRET=unit-test-refresh-secret-exceedance \
  FACTORY_DB_HOST=127.0.0.1 BOILER_DB_HOST=127.0.0.1 \
  PARAMETER_DB_HOST=127.0.0.1 PARAMETER_DB_NAME=unit_test PARAMETER_DB_SCHEMA=ingest \
  PUBLIC_BASE_URL=http://d-poms.diw.go.th \
  npm test -- --runInBand --runTestsByPath \
  tests/unit/alert-events.exceedance-validation.test.ts \
  tests/unit/alert-events.exceedance.openapi.test.ts
```

ชุด regression เพิ่ม `alert-events.route`, `alert-events.service`, `alert-events.repository`, `alert-event-identity`, `alert-email-engine`, `alert-email-source.repository`, `alert-email-eligibility`, `api-docs.openapi` และ `api-docs.route` จาก `backend/tests/unit/`

## Change summary

Docs impact: updated

Canonical docs: [Integration Alert Events](../../api/integrations/alert-events/README.md)

Reason: ป้องกันการรับเหตุการณ์ค่าเกินเมื่อค่าตรวจวัดไม่เกินเกณฑ์ และป้องกันการ coercion ชนิดข้อมูลที่ไม่ใช่ตัวเลข

Client impact: integration กรองเฉพาะค่าที่เกินจริงก่อนส่ง `events[]`; รายการผิด validation ทำให้ทั้ง request ตอบ `400 VALIDATION_ERROR` ก่อนบันทึก

Breaking change: yes — [วิธีปรับ client](../../api/CHANGELOG.md#alert-event-exceedance-validation)
