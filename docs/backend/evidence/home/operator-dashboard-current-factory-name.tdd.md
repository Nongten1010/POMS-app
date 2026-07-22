# หลักฐาน TDD: ชื่อโรงงานหน้าหลักใช้ข้อมูล current/live POMS

## Canonical Contract

- [หน้าหลัก](../../api/menus/home/README.md)

## Source And User Journey

ไม่มี plan file. Journey มาจากกรณีโรงงานเลขทะเบียน `10120000325542` ที่ชื่อใน `factories` ถูก external login sync เขียนทับ แต่ชื่อใน active `cems_wpms_connected_measurement_points` ถูกต้อง.

ในฐานะผู้ประกอบการหรือเจ้าหน้าที่ที่เปิดหน้าหลัก ต้องเห็นชื่อโรงงานเดียวกันจาก current/live POMS โดยความแตกต่างของบทบาทมีผลเฉพาะขอบเขตโรงงานที่มองเห็น ไม่เปลี่ยนแหล่งชื่อโรงงาน.

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts -t "prefers the latest current POMS factory name"` | FAIL | query เดิมคืน `COALESCE(f.name, ef.factory_name)` และไม่มี scalar lookup ไปยัง current/live point |
| GREEN | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts -t "prefers the latest current POMS factory name"` | PASS | query เลือก `factory_name` จาก active current/live point ล่าสุดและมี fallback |
| GREEN: repository suite | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts` | PASS | 34 tests ผ่าน |
| GREEN: live repository read | repository `listFactoriesForAccess({ connectedPomsOnly: true })` | PASS | โรงงาน `10120000325542` คืน `บริษัท เมโทร ปาร์ติเกิล จำกัด` จากฐานที่ backend ใช้ โดยไม่มีการเขียนข้อมูล |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Dashboard เลือกชื่อจาก active current/live POMS point ที่อัปเดตล่าสุด | `connection-requests.repository.test.ts: prefers the latest current POMS factory name` | Repository SQL | PASS | ตรวจ correlated `TOP (1)` และลำดับ `updated_at`, `id` |
| 2 | Point ที่ soft-delete แล้วไม่เป็นแหล่งชื่อ | test เดียวกัน | Repository SQL | PASS | ตรวจ `cp_name.deleted_at IS NULL` |
| 3 | ยังมี fallback ไป eligible factory และ factory master | test เดียวกัน | Repository SQL | PASS | ตรวจ fallback sources ทั้งสอง |
| 4 | ข้อมูลจริงของโรงงานเป้าหมายผ่าน repository คืนชื่อ current/live ที่ถูกต้อง | read-only repository invocation | Integration smoke | PASS | `factoryName` ตรงกับ active POMS point |

## Coverage And Known Gaps

Focused regression ครอบคลุม query ที่สร้าง response ของ `GET /api/v1/operator-factory-dashboard`. ไม่มี frontend change, database migration หรือการเปลี่ยน authorization; ผู้ประกอบการและเจ้าหน้าที่ยังถูกกรองด้วย permission scope เดิม.

Focused coverage ของ `connection-requests.repository.ts` ได้ statements `31.83%`, branches `22.63%`, functions `34.13%` และ lines `32.85%`. ค่านี้ต่ำกว่าเป้าหมาย `80%` เพราะ repository เดิมมี data-access functions จำนวนมากที่ไม่เกี่ยวกับ query หน้าหลัก; regression behavior ในงานนี้มี SQL assertion และ read-only integration smoke โดยตรง.

Verification สุดท้าย:

- `npm run build` และ `npm run typecheck` ผ่าน.
- `npm run lint` ผ่านโดยไม่มี error; มี 142 warnings เดิมในไฟล์อื่นและไม่มี warning จากไฟล์ที่เปลี่ยน.
- `npx prettier --check ...` สำหรับไฟล์ที่เปลี่ยนผ่าน.
- Full suite ผ่าน 80 suites / 725 tests และล้ม 1 suite / 3 tests ใน `officer-notification-email-recipients.route.test.ts` เพราะ test อ่าน recipient rows ที่มีอยู่จริงในฐานทดสอบและชนข้อมูลเดิม; failure ไม่แตะ modules หรือ behavior ในงานนี้.
- Relevant repository suite ผ่าน 34/34 tests.
- Relevant service และ route suites ผ่าน 69/69 tests.
