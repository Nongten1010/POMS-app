# หลักฐานตรวจตัวตรวจค่าเกิน อก./EIA ภายใน

[กลับไป Evidence Index](../README.md) · [คู่มือใช้งาน](../../guides/hourly-exceedance-detector.md) · [แผนออกแบบ](../../guides/hourly-exceedance-detector-plan.md) · [API การแจ้งเตือน](../../api/menus/notifications/README.md)

## ขอบเขตที่ตรวจแล้ว

เพิ่ม process ตรวจค่าเกินรายชั่วโมงแบบ opt-in สำหรับ CEMS/WPMS ทั้ง `STANDARD` และ `EIA` มี shadow/active, bounded reader, lease/fence, config observation boundary, durable pending receipts, atomic event/checkpoint และ key กันซ้ำร่วมกับ canonical integration events ใช้คิวอีเมลเดิมโดยไม่เปิด SMTP เอง

ชุด SQL fixture ใช้ query ของ repository จริงที่ compile ด้วย Knex MSSQL แล้วรันข้อมูลด้วย SQL.js โดยปรับเฉพาะ syntax ของ database boundary และจำลอง callback transaction จึงพิสูจน์การเลือกข้อมูล การเขียน/rollback และการ replay ได้ แต่ไม่พิสูจน์ native SQL Server locks, isolation, unique-key race, cancellation หรือ performance

ตรวจ production แบบอ่านอย่างเดียวแล้ว: live points 42 จุด (CEMS 29, WPMS 13), metadata ผ่าน 42 จุด, invalid 0; ทดสอบ reader จริง 4 จุดรวม 1,018 ms โดยไม่เขียน state/events หรือส่ง SMTP; migration ล่าสุด 0154 จึงใช้ migration ใหม่ 0155

ก่อนนำ release นี้ขึ้น production ยังไม่มีการ apply migration หรือเปิด detector. พบหลักฐานอีเมลเดิมวันที่ 3 พ.ย. 2569 จำนวน 122 delivery ที่ SMTP รับแล้ว; `SMTP_ACCEPTED` ไม่ยืนยันว่าเข้า Inbox ผู้รับ

## ผลตรวจ

| รายการ | ผล |
| --- | --- |
| Targeted detector และ regression | 21 suites / 429 tests passed |
| `npm run typecheck` | ผ่าน |
| `npm run build` | ผ่าน |
| ESLint เฉพาะ source/tests ใหม่ | ผ่าน ไม่มี errors หรือ warnings |
| โหมดปิดจาก entry point ที่ build แล้ว | ตรวจด้วย `ALERT_EXCEEDANCE_MODE=off` โดยไม่ใช้ environment จริง; ต้องจบด้วยข้อความ `[alert-exceedance] OFF` และไม่ต้องมี database settings |

กรณีสำคัญที่ตรวจ:

- ทั้ง 4 ระบบ/เกณฑ์: ต่ำกว่า เท่ากับ เกิน, เกินสองเกณฑ์, numeric strings, เกณฑ์ `0`, invalid numbers, หน่วย, status และความละเอียด `DECIMAL(18,6)`
- Config ตรงกับ active channel/activation, หน่วยซ้ำที่กำกวม, เกณฑ์หรือ revision เปลี่ยน และการเปลี่ยนชื่อโรงงานที่ไม่ควรเริ่ม epoch ใหม่
- ผลรายชั่วโมงเต็มตาม START/END label รวมเที่ยงคืน; ไม่ยืม config ปัจจุบันไปใช้ในชั่วโมงที่ยังไม่มีหลักฐาน
- สร้างสองเกณฑ์ให้ 100 พารามิเตอร์จริงใน fixture ได้ 200 events โดยบันทึกเป็นชุด
- Event จาก external API/legacy key, replay หลัง restart, producer discrepancy, source revision และการไม่เขียนทับ event เก่า
- Shadow ไม่สร้าง event หรือเปลี่ยน active state; stale lease/config change ปฏิเสธผล; checkpoint failure rollback event และ receipt พร้อมกัน
- งานใหม่ก่อน retry, ข้อมูลขาด/source error, round budget, pending limit, non-overlapping ticks และ shutdown ระหว่างรอ query
- Supervisor เริ่ม process แยกอัตโนมัติ, retry เมื่อ process จบ, ปิดด้วย IPC และไม่ทำให้ HTTP service หยุดเพราะ policy ผิด
- เกณฑ์ที่ปิดใช้งานไม่สร้าง candidate และไม่อ่าน raw columns ของพารามิเตอร์นั้น
- Runtime ใช้ pool แยกอย่างละ 1 connection และ native timeout; OpenAPI ประกาศ opt-in/Shadow behavior
- API รับ event, การกันซ้ำ, hourly email engine/source/eligibility/worker/runtime และเส้นทาง runtime OpenAPI เดิม

การพัฒนาพบ test assertion หนึ่งจุดที่คาดว่า fixture decimal จะเป็น number แต่ SQL fixture คืน numeric string แก้ assertion ให้เทียบค่าตัวเลขโดยยังยืนยันว่ามี event เดิมเพียงรายการเดียว ไม่ใช่การเปลี่ยน business behavior เพื่อให้ test ผ่าน

## คำสั่งตรวจซ้ำ

จาก `backend/` ใช้ test environment ที่ไม่โหลดไฟล์จริงและค่า synthetic เท่านั้น:

```bash
env NODE_ENV=test DOTENV_CONFIG_PATH=/private/tmp/poms-exceedance-no-real-env \
  DB_HOST=127.0.0.1 DB_NAME=unit_test DB_USER=unit_test DB_PASSWORD=unit_test \
  JWT_SECRET=unit-test-access-secret-exceedance \
  JWT_REFRESH_SECRET=unit-test-refresh-secret-exceedance \
  FACTORY_DB_HOST=127.0.0.1 BOILER_DB_HOST=127.0.0.1 \
  PARAMETER_DB_HOST=127.0.0.1 PARAMETER_DB_NAME=unit_test PARAMETER_DB_SCHEMA=ingest \
  PUBLIC_BASE_URL=http://d-poms.diw.go.th \
  npm test -- --runInBand --runTestsByPath \
  tests/unit/alert-exceedance.detector.test.ts \
  tests/unit/alert-exceedance.metadata.test.ts \
  tests/unit/alert-exceedance.policy.test.ts \
  tests/unit/alert-exceedance.repository.test.ts \
  tests/unit/alert-exceedance.worker.test.ts \
  tests/unit/alert-exceedance.migration.test.ts \
  tests/unit/alert-exceedance.runtime.test.ts \
  tests/unit/alert-exceedance.supervisor.test.ts \
  tests/unit/alert-events.exceedance-validation.test.ts \
  tests/unit/alert-events.exceedance.openapi.test.ts \
  tests/unit/alert-events.route.test.ts \
  tests/unit/alert-events.service.test.ts \
  tests/unit/alert-events.repository.test.ts \
  tests/unit/alert-event-identity.test.ts \
  tests/unit/alert-email-engine.test.ts \
  tests/unit/alert-email-source.repository.test.ts \
  tests/unit/alert-email-eligibility.test.ts \
  tests/unit/alert-email-worker.test.ts \
  tests/unit/alert-email-runtime.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/api-docs.route.test.ts
```

Source/tests ของ feature อยู่ใต้ `backend/src/modules/alert-exceedances/` และ `backend/tests/unit/alert-exceedance.*.test.ts`; migration คือ [`0155_create_alert_exceedance_state.ts`](../../../../backend/src/db/migrations/0155_create_alert_exceedance_state.ts) ส่วน helper เก็บ event ที่ใช้ร่วมกับ API คือ [`alert-event-persistence.ts`](../../../../backend/src/modules/alert-events/alert-event-persistence.ts)

## ข้อจำกัดและการตรวจรับต่อ

ผู้ใช้อนุมัติให้เปิด Active โดยไม่ใช้ Shadow. ใช้ค่า 60m ที่รับและแสดงในระบบเดิม เทียบเกณฑ์ของ live point พร้อมหน่วย; ไม่แปลงฐานค่า/ปรับ oxygen ซ้ำ. คงการตรวจ Normal-only, canonical IDs และ config boundary. ต้องเฝ้าดูโหลดจริงและ native SQL Server concurrency ต่อ ไม่ถือว่าผล test ในเครื่องเป็น benchmark ครบทุกจุด

ไม่มี automatic backfill เกิน 24 ชั่วโมงหรือ historical config reconstruction ไม่แก้ legacy station aliases และไม่ส่งอีเมลแก้ไข source revision อัตโนมัติ ดูขั้นเปิดใช้และวิธีหยุดใน [คู่มือ](../../guides/hourly-exceedance-detector.md)

## Documentation impact

Docs impact: updated

Canonical docs: [การแจ้งเตือน](../../api/menus/notifications/README.md), [อีเมลแจ้งเตือน](../../api/menus/notifications/email-notifications.md), [Integration Alert Events](../../api/integrations/alert-events/README.md)

Reason: เพิ่มแหล่งสร้างเหตุการณ์ค่าเกินจาก worker ภายในแบบ opt-in และอธิบายการอยู่ร่วมกับ integration/คิวอีเมลเดิม

Client impact: เมื่อเปิด active อาจเห็น event ค่าเกินที่ backend ตรวจเอง; request/response schemas, permissions, enums และนโยบายอีเมลเดิมไม่เปลี่ยน Runtime OpenAPI อัปเดตคำอธิบายแหล่งเหตุการณ์แล้ว

Breaking change: no
