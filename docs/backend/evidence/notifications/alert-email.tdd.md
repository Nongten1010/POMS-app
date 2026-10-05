# หลักฐาน TDD: อีเมลแจ้งเตือนมลพิษ

เอกสารนี้สนับสนุน [API อีเมลแจ้งเตือน](../../api/menus/notifications/email-notifications.md), [Integration Alert Events](../../api/integrations/alert-events/README.md) และ [คู่มือการเปิดใช้](../../guides/alert-email-operations.md) ไม่ใช้แทน canonical contract

## ขอบเขตและเงื่อนไข

- ผู้ใช้อนุญาตให้เริ่มแก้ backend และเอกสารจริง
- ยืนยันกรณี 1–2 รายชั่วโมง กรณี 3–6 เวลา 09:00 น. ตามเวลาไทย
- ยืนยันว่ากรณีต่อเนื่องนับทั้งวันที่ไม่รายงานและวันที่รายงานต่ำกว่า 80% และให้ `diw.iemc@gmail.com` รับ CC ทุกฉบับ
- ผู้รับหลัก สูตร completeness วันยกเว้น และรายละเอียดการยืนยันค่าผิดปกติยังเป็น explicit policies ก่อนเปิดใช้; worker เริ่มต้น disabled
- การทดสอบใช้ unit mocks และ transport จำลอง ไม่ส่ง SMTP จริง ไม่ migrate ฐานข้อมูลจริง และไม่ deploy
- ไม่มี RED/GREEN commit เพราะผู้ใช้กำหนดให้ไม่สร้าง commit จนกว่าจะร้องขอ ใช้คำสั่งและผลทดสอบเป็นหลักฐาน

## RED

เขียน tests ก่อนเพิ่ม production modules โดยทดสอบล้มเหลวตามที่คาดเมื่อ module ยังไม่มี:

```bash
cd backend
npm test -- --runInBand --runTestsByPath \
  tests/unit/alert-email-rules.test.ts --no-cache --coverage=false

npm test -- --runInBand --runTestsByPath \
  tests/unit/alert-email-policy.test.ts \
  tests/unit/alert-email-preview.service.test.ts --no-cache --coverage=false

npm test -- --runInBand --runTestsByPath \
  tests/unit/alert-email-template.test.ts --no-cache --coverage=false

npm test -- --runInBand --runTestsByPath \
  tests/unit/alert-email-outbox.repository.test.ts \
  tests/unit/alert-email-dispatch.test.ts \
  tests/unit/alert-email-outbox.migration.test.ts --no-cache --coverage=false
```

Identity hardening เพิ่ม regression tests สำหรับหน่วยที่ต่างกัน การแข่ง insert รายการซ้ำ และวันที่ไม่มีอยู่จริง ก่อนแก้ validator/service

ระหว่างเชื่อมระบบเพิ่ม RED สำหรับข้อมูลซ้ำที่ row แรกไม่มีค่าแต่ row ถัดไปมีค่าจริง, เวลาตรวจวัดจริงที่ไม่ได้ตรงต้นชั่วโมง, การคืนเวลาไทยจาก payload ต้นฉบับ, success envelope ของ OpenAPI และจำนวน operations ที่แสดงต่อ client จากนั้นแก้พฤติกรรมและทวน tests ที่เกี่ยวข้อง

## สิ่งที่ต้องตรวจจาก tests

| พฤติกรรม | Tests |
| --- | --- |
| รอบรายชั่วโมงใช้ชั่วโมงก่อนหน้าที่ครบแล้ว รายวัน 09:00 และช่วงข้ามวัน | [`alert-email-rules.test.ts`](../../../../backend/tests/unit/alert-email-rules.test.ts) |
| distinct parameter-hours, เกณฑ์ 80%, streak รวม 0%/ต่ำกว่า 80%, วันยกเว้น และข้อมูลขาด | [`alert-email-rules.test.ts`](../../../../backend/tests/unit/alert-email-rules.test.ts) |
| ศูนย์/ติดลบ/ค่านิ่งต้องต่อเนื่อง ชั่วโมงหายหรือ non-Normal ตัดลำดับ | [`alert-email-rules.test.ts`](../../../../backend/tests/unit/alert-email-rules.test.ts) |
| ไม่เปิดส่งโดยปริยายและการเปิดใช้ต้องกำหนด policies ครบ | [`alert-email-policy.test.ts`](../../../../backend/tests/unit/alert-email-policy.test.ts) |
| ตรวจสิทธิ์ทุก event ก่อน render, ไม่รับ arbitrary recipient และไม่ preview รอบก่อนสิ้นสุดช่วงตรวจวัด | [`alert-email-preview.service.test.ts`](../../../../backend/tests/unit/alert-email-preview.service.test.ts) |
| ข้อมูลผู้รับ/เนื้อหา delivery ต้องอยู่ใน scope ทุก event และไม่คืน lease หรือ key ภายใน | [`alert-email-history.test.ts`](../../../../backend/tests/unit/alert-email-history.test.ts) |
| อีเมลครบหกกรณี กลุ่มโรงงาน/จุด หน่วย HTML escaping plain text และ timestamp ที่มี timezone | [`alert-email-template.test.ts`](../../../../backend/tests/unit/alert-email-template.test.ts) |
| คิว snapshot, กันซ้ำ, claim แข่งกัน, expired lease, CC และขอบเขตทุก event | [`alert-email-outbox.repository.test.ts`](../../../../backend/tests/unit/alert-email-outbox.repository.test.ts), [`alert-email-outbox.migration.test.ts`](../../../../backend/tests/unit/alert-email-outbox.migration.test.ts) |
| SMTP accepted/4xx/5xx/partial/timeout, bounded retry และตรวจผู้รับก่อนส่ง | [`alert-email-dispatch.test.ts`](../../../../backend/tests/unit/alert-email-dispatch.test.ts) |
| โหลดค่ารายชั่วโมงตามหน่วยและ baseline พารามิเตอร์ ไม่แจ้งย้อนหลังช่วงก่อนเริ่มใช้งาน ไม่แปลง source outage เป็น 0% | [`alert-email-measurements.test.ts`](../../../../backend/tests/unit/alert-email-measurements.test.ts), [`alert-email-daily-detector.test.ts`](../../../../backend/tests/unit/alert-email-daily-detector.test.ts) |
| จัดคิวเฉพาะ daily candidates ของนโยบายปัจจุบัน ป้องกัน legacy event/source failure และไม่ส่ง `DISMISSED` | [`alert-email-engine.test.ts`](../../../../backend/tests/unit/alert-email-engine.test.ts), [`alert-email-source.repository.test.ts`](../../../../backend/tests/unit/alert-email-source.repository.test.ts) |
| Runtime OpenAPI มี endpoint/schema และ permission ของ preview/delivery ตรงกับ API | [`alert-email.openapi.test.ts`](../../../../backend/tests/unit/alert-email.openapi.test.ts) |
| `CO (ppm)` และ `CO (%)` ไม่ใช้ key เดียวกัน; SQL duplicate race คืนรายการเดิม; วันที่ปฏิทินจริง | [`alert-event-identity.test.ts`](../../../../backend/tests/unit/alert-event-identity.test.ts), [`alert-events.service.test.ts`](../../../../backend/tests/unit/alert-events.service.test.ts), [`alert-events.route.test.ts`](../../../../backend/tests/unit/alert-events.route.test.ts) |

## GREEN และ verification

ผลตรวจหลังเชื่อม source, detector, scheduler, SMTP transport จำลอง และ runtime OpenAPI:

| Check | Result |
| --- | --- |
| Aggregate tests: email, identity, alert events, SMTP config, OpenAPI และ raw measurement handoff | `27` suites, `382` tests passed |
| Scoped coverage: alert-emails และ alert-event-identity | statements `94.92%`, branches `87.91%`, functions `97.09%`, lines `97.36%` |
| OpenAPI regression หลังแก้ metadata จำนวน operations | `2` suites, `79` tests passed |
| `npm run typecheck` | ผ่าน |
| `npm run build` | ผ่าน |
| ESLint เฉพาะ modules/tests ใหม่และ migration `0127` | ไม่มี errors หรือ warnings |
| `git diff --check` | ผ่าน |
| ลิงก์เอกสารใหม่และเส้นทางจาก backend hub | `50` local links ผ่าน; canonical pages ใหม่ทั้ง `3` หน้าเข้าถึงได้จาก index |

คำสั่ง aggregate:

```bash
cd backend
npm test -- --runInBand --no-cache \
  tests/unit/alert-email \
  tests/unit/alert-event-identity.test.ts \
  tests/unit/alert-events.service.test.ts \
  tests/unit/alert-events.repository.test.ts \
  tests/unit/alert-events.route.test.ts \
  tests/unit/email.service.test.ts \
  tests/unit/smtp-config.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/api-docs.route.test.ts \
  tests/unit/parameter-values.home-handoff.test.ts \
  --coverage \
  --collectCoverageFrom='src/modules/alert-emails/*.ts' \
  --collectCoverageFrom='src/modules/alert-events/alert-event-identity.ts' \
  --coverageDirectory=/private/tmp/dpoms-alert-email-final-coverage
```

Supertest เปิดพอร์ตชั่วคราวในเครื่อง จึงต้องรันชุด API นอกข้อจำกัด sandbox ที่ห้าม `listen`; dependency ฐานข้อมูลและ SMTP ยังเป็น mocks ไม่มีการติดต่อระบบจริง การตรวจแยกโดยผู้ตรวจอีกคนครอบคลุม runtime, worker, engine, eligibility และ measurement loader (`5` suites / `39` tests ผ่าน) ไม่พบปัญหาใหม่ที่มีหลักฐาน

## ตรวจชุด release ก่อนขึ้น production

แยก release จาก `origin/main` ที่ commit `74f47004539e417e0e968d566420b8f0e961455a` โดยคัดเฉพาะงานแจ้งเตือนและรักษา contract ที่เผยแพร่ไปแล้วของงานอื่น ตรวจ backend ทั้งชุดได้ `274` suites / `3325` tests ผ่าน พร้อม `npm run typecheck`, `npm run build` และ `git diff --check` ผ่าน

การตรวจในเครื่องใช้ database/JWT placeholders, `PARAMETER_DB_SCHEMA=ingest` และ `PUBLIC_BASE_URL=http://d-poms.diw.go.th` ตาม fixtures โดยชี้ `DOTENV_CONFIG_PATH` ไปไฟล์ทดสอบที่ไม่มีอยู่ ไม่อ่าน `.env` จริงและไม่เปิด SMTP การเผยแพร่ code/schema ยังคง worker disabled ตามคู่มือ; ผล deploy/migration และ runtime contract ต้องตรวจจาก workflow production แยกต่างหาก

## ผลกระทบต่อเอกสารและ client

Docs impact: updated
Canonical docs: [อีเมลแจ้งเตือน](../../api/menus/notifications/email-notifications.md), [Integration Alert Events](../../api/integrations/alert-events/README.md)
Reason: เพิ่ม preview/ผล SMTP, กติกา worker และ identity ที่แยกหน่วยให้ตรงกับ code และ runtime OpenAPI
Client impact: integration
Breaking change: yes

รายละเอียดการย้าย client: [การเปลี่ยนรูปแบบ idempotencyKey](../../api/CHANGELOG.md#alert-event-identity-unit-aware)

## ขอบเขตหลักฐานความปลอดภัย

- Preview ตรวจ permission/data scope และไม่เปิดสถานะติดตามที่ผู้เรียกไม่มีสิทธิ์ดู
- Delivery ต้องครอบคลุมสิทธิ์ทุก event ของ batch ก่อนคืน recipient หรือเนื้อหา
- ข้อมูลถูก escape ก่อน render HTML และลิงก์อีเมลเป็น HTTPS ของระบบที่กำหนดไว้
- Query ผ่าน Knex ไม่รับ table identifier หรือ SQL จาก public request
- `UNKNOWN` ไม่ถูกเปลี่ยนเป็น retry อัตโนมัติ; expired lease ไม่ทำให้ส่งซ้ำหลังผล SMTP ไม่ชัด
- ไม่ทดสอบ SMTP จริง, migration จริง, inbox delivery, bounce feedback หรือ production deployment ในหลักฐานชุดนี้
- Baseline ของพารามิเตอร์ใช้ device configuration revision ปัจจุบันร่วมกับเวลาเชื่อมต่อจุด ยังไม่มีประวัติเปิดใช้ราย channel การแก้ configuration จึงอาจเริ่มนับวันใหม่ ต้องทวน timestamp ของ channel เดิมก่อนเปิดใช้จริง
