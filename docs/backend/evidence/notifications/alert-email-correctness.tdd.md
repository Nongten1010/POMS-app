# หลักฐาน: ตรวจความถูกต้องก่อนส่งและประวัติพารามิเตอร์

[กลับไป Evidence Index](../README.md) · [สัญญาอีเมล](../../api/menus/notifications/email-notifications.md) · [คู่มือทดลอง](../../guides/alert-email-test.md) · [Breaking change](../../api/CHANGELOG.md#alert-email-presend-activation)

## ขอบเขตและสภาพแวดล้อม

หลักฐานส่วนพัฒนาในเอกสารนี้ตรวจและแก้ backend โดยไม่แก้ frontend ไม่รัน migration ในฐานจริง และไม่ส่งอีเมลออกภายนอก เก็บ RED ก่อนแก้และ GREEN หลังแก้แทน checkpoint commits การอนุมัติ push production เกิดภายหลังการทดสอบส่วนนี้ และต้องตรวจ release แยกต่างหาก

Unit tests จำลอง database repositories หรือใช้ Knex MSSQL compile SQL โดยไม่เชื่อมฐานข้อมูล ชุดจำลองใช้กฎ ตัวจัดคิว renderer validator eligibility และ dispatcher จริงกับ in-memory adapter และนาฬิกาที่ระบุใน test ส่วน Nodemailer ส่ง MIME จริงเข้า SMTP sink เฉพาะ `127.0.0.1` ไม่มีการส่งต่อ

## กรณีที่ตรวจพบและการแก้

- ข้อมูลรายชั่วโมงเก่าที่ไม่เกินเกณฑ์ยังอาจไปถึง renderer หรือ dispatcher: ตรวจ finite และ strict `measuredValue > thresholdValue` พร้อมชนิดเกณฑ์/cadence อีกครั้ง หากหนึ่งเหตุการณ์ไม่ผ่านจะข้าม delivery ทั้งชุดก่อน SMTP
- วันเริ่มนับผูกกับ config `updatedAt`: ใช้ registry แยก point/parameter/unit และอัปเดตใน transaction เดียวกับ config และการอนุมัติ การแก้ device/address ที่ยังมี channel ปกติเดิมรักษา activation; ลบหรือ Test Mode ทั้งหมดแล้วเพิ่มกลับเริ่มช่วงใหม่
- `ADD_PARAMETER` เปลี่ยน live connected point ID: carry เฉพาะ ownership เดิมที่ยังต่อเนื่อง อ่านและนับประวัติตาม activation ที่ยืนยันแล้ว และใช้ identity รายวันที่ไม่เปลี่ยนตาม row ID พร้อมรองรับ daily key v1 เดิม
- รูปแบบ station ID ต่างตัวพิมพ์และรหัสว่าง: ใช้ identity ที่ตรงกับการจับคู่ของฐานข้อมูลและ fallback ชื่อจุดอย่างสอดคล้องกัน
- เวลาจาก legacy audit อาจเป็น baseline อนาคต: รักษาขอบเขตการเริ่มนับอย่างระมัดระวัง ไม่เดา timezone และปิดช่วงที่เวลาไม่น้อยกว่า activation เดิม เพื่อไม่ทำให้เส้นทางบันทึก config ล้มเหลว
- CLI ต้องไม่อ่าน SMTP/DB จริง: แยก mandatory CC เป็น pure policy และกำหนด transport เฉพาะ loopback ไม่อ่าน `.env` หรือค่า SMTP จาก environment

## RED/GREEN

| กรณี | RED ก่อนแก้ | GREEN ที่ตรวจได้ |
| --- | --- | --- |
| Pre-send guard และ renderer | 12 failed / 36 passed | 3 suites / 50 passed รวม STD/EIA ที่เกินจริง และ legacy invalid ที่ไม่เรียก SMTP |
| Activation parser/planner/repository/migration | module ที่ยังไม่มีทำให้ tests ล้มเหลว | ชุดใหม่ตรวจ canonical identity, transitions, SQL bindings และ conservative backfill |
| Transaction hooks | device hooks 2 failed / 5 passed; approval carry 6 failed | ตรวจ final state ใน transaction เดียวกัน และไม่ sync request snapshot |
| Registry ใน runtime/measurement loader | measurements 3 failed / 6 passed; runtime 2 failed / 19 passed | ตรวจ config edit, parameter ใหม่, missing registry/source error และ recheck ก่อนส่ง |
| Carried history หลังเปลี่ยน live point | loader 1 failed / 9 passed | loader อ่านประวัติเดิมได้และไม่รวมวันบางส่วนของพารามิเตอร์ใหม่ |
| Stable daily identity | detector 1 failed / 18 passed | point replacement ต่อเนื่องใช้ key เดิม; activation ใหม่เป็นคนละ identity |
| Daily v1 compatibility และ canonical identity | 6 failed / 33 passed; timestamp/case 5 failed / 42 passed | detector/repository 2 suites / 47 passed รวม legacy `+07:00` และ source นาที `HH:05` |
| Case ของ station ใน engine | 1 failed / 7 passed | จับคู่ภายใต้โรงงานและระบบเดิม; ข้ามโรงงาน/ระบบ/สถานีอื่น |
| ขนาด batch ของ activation | 600 rows สร้าง 2,400 SQL bindings; 1 failed / 11 passed | 12 passed; แบ่งครั้งละ 200 rows ภายใน transaction เดิม และบันทึกครบทุก key |
| Projection ใน ownership query ของ main ล่าสุด | 6 failed / 158 passed | 3 suites / 172 passed; อ่าน `factory_id` และ `point_name` จริงเพื่อ carry baseline ภายใต้ ownership guards |
| วันเชื่อมต่ออนาคตของ activation ใหม่ | 3 failed / 13 passed | repository 16 passed; activation รวม 5 suites / 42 passed; เริ่มที่ `max(now, connectedAt)` และรักษาประวัติ carry ที่พิสูจน์แล้ว |
| Migration ก่อนสร้าง activation registry | 3 failed / 7 passed | 5 suites / 25 passed; `0112` opt out เฉพาะ activation hooks ก่อน `0128`; runtime reconciliation ยัง sync ตามเดิม |
| CLI/report | module ยังไม่มีก่อน implementation | regression 3 tests ผ่าน รวม capture ที่ปฏิเสธ CC ต้องทำให้รายงาน FAIL |

ชุด regression ข้าม hook เพิ่ม 7 suites / 110 tests ผ่าน ครอบคลุม parameter approval, factory repository/profile locks และ integration device config การตรวจฐานข้อมูลจริงและ concurrency ต้องทำแยก ไม่ใช้ผล SQL compile เป็นหลักฐานว่ารัน migration สำเร็จแล้ว

## ผลตรวจสุดท้าย

| การตรวจ | ผล |
| --- | --- |
| Regression เฉพาะ notification และเส้นทางที่เชื่อม registry | 48 suites / 684 tests ผ่าน รวม HTTP, OpenAPI, config writers และ approval repositories |
| `npm run typecheck` | ผ่าน |
| `npm run build` | ผ่าน |
| Strict TypeScript ของ CLI/scripts | ผ่านด้วย temporary config ที่ extends backend config และรวม `scripts/test-alert-emails.ts` / `scripts/alert-email-test/**/*.ts` |
| ESLint ของ alert-emails, migration ใหม่, pure CC policy, email service, OpenAPI และ tests ที่เกี่ยวข้อง | 0 errors / 0 warnings |
| เอกสาร | ลิงก์ใหม่ที่เพิ่มในรอบนี้ผ่าน; guide/evidence เข้าถึงได้จาก backend hub |
| Diff | ทวนเทียบ baseline ของรอบงานเพื่อรักษาการแก้เดิม; `git diff --check` ผ่าน; รอบนี้แก้เฉพาะ backend และ canonical docs |

คำสั่ง regression ใช้ `NODE_ENV=test`, `DOTENV_CONFIG_PATH` ที่ไม่มี `.env` จริง และ host/credential ทดสอบสำหรับ modules ที่ต้อง validate environment ก่อน import โดย repositories ถูก mock คำสั่งเลือกชื่อ tests ด้วย pattern ต่อไปนี้:

```text
alert-email|alert-parameter-activations|email-policy|alert-events.exceedance|
device-connections.repository|reconcile-approved-station-parameters|
connection-requests.*repository|poms-factories.parameter-approval|
poms-factories.repository|poms-factories.general-info-approval|
poms-factories.canonical-profiles.repository|poms-factories.profile-lock.repository|
integration-device-configs.service|integration-device-configs.repository|
api-docs.openapi|api-docs.route
```

รัน `npm test -- --runInBand '<pattern>'` โดยต่อ pattern ในบล็อกเป็นบรรทัดเดียว Sandbox จำกัดการเปิดพอร์ตใน Supertest จึงใช้สิทธิ์ที่อนุญาต local server ระหว่างทดสอบ ความล้มเหลว `EPERM` ไม่ใช่ RED ของ business behavior

## ตรวจลำดับ deployment

การ review release พบว่า backfill ขณะ backend รุ่นเก่ายังรับ config writes อาจทำให้ registry คลาดเคลื่อนก่อน cutover จึงแยกการเตรียม release/dependencies ไว้ก่อนหยุด service และหยุด service ก่อน migration พร้อมคง recovery แบบ `always()` เมื่อ migration/preflight ล้มเหลว

Deployment tests: RED 4 failed / 1 passed → GREEN 2 suites / 9 passed รวม preflight เดิม ตรวจ prepare ก่อน stop, stop ก่อน migration, migration ก่อน copy/restart, output ของการติดตั้ง dependencies และ recovery เมื่อขั้นก่อน deploy ล้มเหลว เป็นการตรวจ workflow source ไม่ใช่การรัน Windows service จริง ดู [ลำดับปฏิบัติการ](../../guides/alert-email-operations.md#ลำดับปล่อย-backend)

## ตรวจ release ร่วมกับ main ล่าสุด

ทวน diff ใน worktree แยกบน `7b298ffa6855835d6b5d45c3d82a22633f646a55` เพื่อรักษา ownership/profile guards และไม่รวมงานค้างจาก checkout เดิม หลังแก้ projection, วันเชื่อมต่ออนาคต และ compatibility ของ migration `0112` แล้ว รัน backend ทั้งหมดผ่าน **284 suites / 3,466 tests** พร้อม `npm run typecheck`, `npm run build`, strict TypeScript ของ CLI และ `git diff --check`

ESLint ของไฟล์ release ใน `src/` และ `tests/` มี 0 errors และ 12 warnings เดิม ชุด loopback จาก source ของ release ผ่าน 46/46 checks และรับ MIME ครบ 6 ฉบับ ลิงก์เอกสารใหม่ที่เพิ่ม 32 ลิงก์ผ่าน และเอกสารใหม่ทั้ง 3 หน้าถึงได้จาก backend hub ผลเหล่านี้ยังไม่ใช่หลักฐานการรัน migration หรือ inbox บน production; ต้องตรวจ deployment run และ runtime OpenAPI หลังปล่อย

## ทดลองดูอีเมล

```bash
cd /Users/yuthsuwannadech/Documents/POMS-app/backend
npm run test:alert-emails
```

ผล loopback ล่าสุดผ่าน **46/46 checks และรับ MIME อีเมลครบ 6 ฉบับ** มี To/CC, Message-ID ที่เชื่อม delivery/event, plain text และ HTML โดยทดสอบแม้ตั้ง `SMTP_HOST`/`DB_HOST` เป็น host ที่ไม่ควรถูกติดต่อและ `ALERT_EMAIL_ENABLED=true` เครื่องมือก็ยังรับเฉพาะในเครื่อง ไม่เปิด worker จริง

CLI สร้าง `report.html`, `report.json` และ `message-01.eml` ถึง `message-06.eml` ใน `/private/tmp/poms-alert-email-test-*` ใช้โฟลเดอร์ใหม่และไม่เขียน generated files ลง repository รายละเอียดเงื่อนไข ข้อมูลจำลอง และ expected/actual อยู่ใน [คู่มือทดลอง](../../guides/alert-email-test.md)

ข้อ 1–2 ป้อน fixture เหตุการณ์ที่ผ่าน validator จริง จึงยังไม่ยืนยันตัวตรวจและการเลือกเกณฑ์ของระบบต้นทาง คิวในหน่วยความจำกับการสร้าง engine ใหม่ยังไม่ยืนยัน SQL Server, restart process, scheduler จริง, migration/locking หลาย worker หรือ inbox production ต้องตรวจในฐานข้อมูลทดสอบและระบบต้นทางก่อนเปิดส่งจริง

## Change summary

Docs impact: updated

Canonical docs: [สัญญาอีเมล](../../api/menus/notifications/email-notifications.md), [คู่มือปฏิบัติการ](../../guides/alert-email-operations.md), [คู่มือทดลอง](../../guides/alert-email-test.md)

Reason: ปิดเส้นทางส่งค่าไม่เกินเกณฑ์ รักษาวันเริ่มนับเมื่อ config/point revision เปลี่ยน และจัดชุดทดสอบที่ดู MIME ครบหกแบบได้โดยไม่ส่งจริง

Client impact: preview ปฏิเสธเหตุการณ์รายชั่วโมงเดิมที่ไม่เกินเกณฑ์; `SKIPPED` ครอบคลุม event eligibility; daily key เป็น opaque identity และต้องติดตั้ง migration `0128` ก่อน backend รุ่นนี้

Breaking change: yes — [ผลกระทบและขั้นตอนย้าย](../../api/CHANGELOG.md#alert-email-presend-activation)
