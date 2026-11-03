# หลักฐานตรวจตัวตรวจค่าเกิน อก./EIA ภายใน

[กลับไป Evidence Index](../README.md) · [คู่มือใช้งาน](../../guides/hourly-exceedance-detector.md) · [แผนออกแบบ](../../guides/hourly-exceedance-detector-plan.md) · [API การแจ้งเตือน](../../api/menus/notifications/README.md)

## ขอบเขตที่ตรวจแล้ว

เพิ่ม process ตรวจค่าเกินรายชั่วโมงแบบ opt-in สำหรับ CEMS/WPMS ทั้ง `STANDARD` และ `EIA` มี shadow/active, bounded reader, lease/fence, config observation boundary, durable pending receipts, atomic event/checkpoint และ key กันซ้ำร่วมกับ canonical integration events ใช้คิวอีเมลเดิมโดยไม่เปิด SMTP เอง

ชุด SQL fixture ใช้ query ของ repository จริงที่ compile ด้วย Knex MSSQL แล้วรันข้อมูลด้วย SQL.js โดยปรับเฉพาะ syntax ของ database boundary และจำลอง callback transaction จึงพิสูจน์การเลือกข้อมูล การเขียน/rollback และการ replay ได้ แต่ไม่พิสูจน์ native SQL Server locks, isolation, unique-key race, cancellation หรือ performance

ตรวจ production แบบอ่านอย่างเดียวแล้ว: live points 42 จุด (CEMS 29, WPMS 13), metadata ผ่าน 42 จุด, invalid 0; ทดสอบ reader จริง 4 จุดรวม 1,018 ms โดยไม่เขียน state/events หรือส่ง SMTP; migration ล่าสุด 0154 จึงใช้ migration ใหม่ 0155

ณจุดตรวจ preflight ยังไม่มีการ apply migration หรือเปิด detector; ผลหลังติดตั้งอยู่ในหัวข้อ production ด้านล่าง. พบหลักฐานอีเมลเดิมวันที่ 3 พ.ย. 2569 จำนวน 122 delivery ที่ SMTP รับแล้ว; `SMTP_ACCEPTED` ไม่ยืนยันว่าเข้า Inbox ผู้รับ

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

## ผลเปิด Active บน production

[PR #46](https://github.com/Nongten1010/POMS-app/pull/46) ติดตั้ง commit `3afa254a3d21553f26e411bd88f3b218ea0cee28` ผ่าน [workflow 41617337557](https://github.com/Nongten1010/POMS-app/actions/runs/41617337557) สำเร็จ โดยไม่มี frontend หรือ dependencies ใหม่ใน release

| รายการตรวจรับ | หลักฐาน |
| --- | --- |
| Backend CI ทั้งระบบ | 406 suites / 5,628 tests passed; 2 suites / 18 tests skipped ตามชุดเดิม |
| Migration จริง | Batch 125: migration 0155 จำนวน 1 รายการ; พบตาราง lease/points/hours ครบ 3 ตาราง |
| Service/HTTP | `poms-app-backend` Running; `/health` ตอบ success/status ok หลังเปิด Active เวลา 17:20:08 น. วันที่ 3 พ.ย. 2569 |
| Runtime contract | `/api/v1/openapi.json` มีคำอธิบาย `ALERT_EXCEEDANCE_MODE=active` หลัง deploy และหลัง restart |
| Detector process | มี process ลูกแยกจาก API; log mode active, points 42, errors 0 |
| Native state | active CEMS 29 จุด, WPMS 13 จุด; valid_from/next_hour `2026-11-03T11:00:00Z` หรือ 18:00 น. |
| เวลาเริ่มงาน | รอบ initialize 1,794 ms; รอบตรวจ due ที่ยังไม่มีชั่วโมงถึงกำหนด 95/86 ms; ไม่ใช่เวลาประมวลผล source เต็มชั่วโมง |
| Read-only source benchmark | ทั้ง 42 จุดรวม 2,498 ms: ข้าม 15 จุดที่ปิดทุกเกณฑ์, reader ที่ช้าที่สุด 512 ms; พบ candidate 2 รายการโดยไม่บันทึก event |
| ความพร้อมต้นทาง | `S0747` ไม่มี `ingest.S0747_data_60m`; อีก 12 จุดรอข้อมูลและมี invalid/missing reading 3 กรณีในชั่วโมงที่สำรวจ ไม่มีการเดาข้อมูลหรือสร้าง alert แทน |

ค่าตั้ง production: mode `active`, allowlist 42 IDs ที่ตรวจแล้ว, `START`, delay 10 นาที, batch 50, budget 60,000 ms, query timeout 5,000 ms, late 24 ชั่วโมง, recheck 3 ชั่วโมง. เปิด Normal-only และใช้ค่า/หน่วย/เกณฑ์จาก contract ปัจจุบันโดยไม่คำนวณ standard condition/dry basis/oxygen ซ้ำ. สำรอง environment เดิมนอก checkout ก่อนแก้เฉพาะ detector settings; ไม่เปลี่ยน credentials/SMTP/ผู้รับ

เวลาเปิด config `2026-11-03T10:17:35.985Z` และ restart service เพื่อเริ่ม detector จริง. ไม่เปิด Shadow และไม่ backfill ชั่วโมงก่อนสังเกต config. งานแรกเป็นช่วง 18:00–18:59 น. ซึ่งถึงกำหนดประมาณ 19:10 น. จึงยังไม่มี `alert_exceedance_hours` หรือ event จาก detector ในจุดตรวจเวลา 17:21 น.

ผู้ใช้ระบุให้ส่งจริงตามเดิมและไม่ต้องส่งอีเมลทดสอบ. คง `ALERT_EMAIL_ENABLED=true`, `POINT_OFFICERS_AND_FACTORY`, hourly delay 0 นาที. Event ที่สร้างหลังรอบต้นชั่วโมงจะเข้าส่งในรอบถัดไปตาม engine เดิม: หากพบค่าเกินในงานแรกประมาณ 19:10 น. รอบส่งที่คาดคือ 20:00 น. ไม่ใช่การส่งทันทีที่ detector สร้าง event

หลักฐานอีเมลจริงเดิม ณ จุดตรวจมี 122 delivery ของวันที่ 3 พ.ย. ที่ `SMTP_ACCEPTED`; ล่าสุด delivery 709 ชนิด ABNORMAL_VALUE เวลา 12:22:03 น., attempt 1, error null, SMTP ยอมรับผู้รับ 2 ที่อยู่. ยังไม่ใช่หลักฐานส่งอีเมลจาก detector ใหม่ และไม่ยืนยันการเข้า Inbox. ไม่สร้าง event ปลอม ไม่ส่งอีเมลทดสอบ และไม่เปลี่ยน event date เพื่อบังคับส่ง

## Documentation impact

Docs impact: updated

Canonical docs: [การแจ้งเตือน](../../api/menus/notifications/README.md), [อีเมลแจ้งเตือน](../../api/menus/notifications/email-notifications.md), [Integration Alert Events](../../api/integrations/alert-events/README.md)

Reason: เพิ่มแหล่งสร้างเหตุการณ์ค่าเกินจาก worker ภายในแบบ opt-in และอธิบายการอยู่ร่วมกับ integration/คิวอีเมลเดิม

Client impact: เมื่อเปิด active อาจเห็น event ค่าเกินที่ backend ตรวจเอง; request/response schemas, permissions, enums และนโยบายอีเมลเดิมไม่เปลี่ยน Runtime OpenAPI อัปเดตคำอธิบายแหล่งเหตุการณ์แล้ว

Breaking change: no
