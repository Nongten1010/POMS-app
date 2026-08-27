# หลักฐาน TDD: เลขรายงาน BOD/COD แยกตามภาคและปี

เอกสารนี้สนับสนุน [contract เมนูรายงานค่าความคลาดเคลื่อน BOD/COD Online](../../api/menus/bod-cod-deviation-reports/README.md#เลขที่รายงาน-reportno) และไม่ใช้แทน canonical API contract

## Acceptance Criteria

- รูปแบบปัจจุบัน `E-{รหัสภาค 2 หลัก}-{ลำดับ 4 หลัก}/{ปีรายงาน พ.ศ. 4 หลัก}`
- รหัสภาค `02` ตะวันตก, `03` ตะวันออก, `04` เหนือ, `05` ใต้, `06` ตะวันออกเฉียงเหนือ, `07` กลาง
- Running แยกตาม `region + reportYear` แต่ใช้ร่วมกันระหว่าง BOD, COD และรอบรายงาน 1-2
- Region มาจากจังหวัดของโรงงานฝั่ง server และจังหวัดใน payload ต้องตรงกับ authoritative factory data
- Sequence ถูกจองและบันทึกรายงานใน transaction เดียวกัน พร้อม lock ป้องกันเลขซ้ำ
- ลำดับสูงสุดคือ `9999`; รายการถัดไปตอบ `409 CONFLICT`
- Resubmit คงเลขเดิม และเลขที่ใช้แล้วไม่นำกลับมาใช้ซ้ำ
- เลขเดิมรูปแบบ `BODCOD-*` ไม่ถูก rewrite และยังอ่านผ่าน API ได้

## RED Evidence

สร้าง tests ก่อน implementation:

```bash
cd backend
npm test -- --runInBand \
  tests/unit/regional-document-number.test.ts \
  tests/unit/bod-cod-deviation-report-number.test.ts \
  tests/unit/bod-cod-deviation-report-numbering.repository.test.ts \
  tests/unit/bod-cod-deviation-report-sequence-migration.test.ts
```

RED เกิดจาก formatter, numbering repository และ migration ใหม่ยังไม่มีใน source ก่อนเริ่ม implementation

## Executable Coverage

| สิ่งที่รับประกัน | Test |
| --- | --- |
| Shared region mapping ครบ `02`-`07`, validation ปี/ลำดับ และ formatter ที่ reuse ได้ | `regional-document-number.test.ts` |
| BOD/COD wrapper ออก `E-02-0001/2569` และ boundary `9999` | `bod-cod-deviation-report-number.test.ts` |
| Factory query อ่าน province/region ฝั่ง server; sequence ใช้ `UPDLOCK, HOLDLOCK`, แยก region+ปี และ reject overflow | `bod-cod-deviation-report-numbering.repository.test.ts` |
| Create flow ใช้ authoritative factory context และจอง sequence ก่อน insert ภายใน transaction เดียวกัน | `bod-cod-deviation-report-create-numbering.repository.test.ts` |
| Migration เพิ่ม sequence table กับ snapshot สอง field, constraints และไม่ rewrite legacy rows | `bod-cod-deviation-report-sequence-migration.test.ts` |
| Migration เปลี่ยน prefix ข้อมูล regional เดิมจาก `Error-` เป็น `E-`, ตรวจ collision และติดตั้ง constraint รูปแบบใหม่ | `bod-cod-deviation-report-prefix-migration.test.ts` |
| Create flow บันทึกเลข/snapshot ใน transaction, legacy response และ resubmit คงเลขเดิม | `bod-cod-deviation-reports.repository.test.ts` |
| Route คืน `reportNo` ใหม่เป็น string โดยไม่เปลี่ยน envelope และยังส่ง `Location` ด้วย report id | `bod-cod-deviation-reports.route.test.ts` |
| KWP/F01 ยังออกเลขแบบเดิมหลังย้าย region mapping และ formatter มาใช้ร่วมกัน | `kwp-form-submission-number.test.ts`, `kwp-form-submission-sequence.repository.test.ts`, `kwp-form-submission-create-numbering.repository.test.ts` |

## GREEN Evidence

Targeted suite หลัง implementation:

```text
Test Suites: 8 passed, 8 total
Tests:       113 passed, 113 total
```

คำสั่งที่ใช้:

```bash
cd backend
npm test -- --runInBand \
  tests/unit/regional-document-number.test.ts \
  tests/unit/bod-cod-deviation-report-number.test.ts \
  tests/unit/bod-cod-deviation-report-numbering.repository.test.ts \
  tests/unit/bod-cod-deviation-report-create-numbering.repository.test.ts \
  tests/unit/bod-cod-deviation-report-sequence-migration.test.ts \
  tests/unit/bod-cod-deviation-report-prefix-migration.test.ts \
  tests/unit/bod-cod-deviation-reports.route.test.ts \
  tests/unit/api-docs.openapi.test.ts
```

## Verification Commands

```bash
cd backend
npm run typecheck
npx prettier --check \
  src/modules/api-docs/poms.openapi.ts \
  src/modules/bod-cod-deviations/bod-cod-deviation-report-number.ts \
  src/db/migrations/0102_change_bod_cod_report_number_prefix_to_e.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/bod-cod-deviation-report-prefix-migration.test.ts
```

ผลใน environment นี้:

- targeted tests ผ่าน `8` suites / `113` tests
- `npm run typecheck` ผ่าน
- Prettier check ของ source, migration และ tests ที่แก้ผ่าน

เอกสารนี้ไม่กล่าวอ้างผลจากฐานข้อมูล production และ targeted tests ของ BOD/COD ไม่ต้องใช้ข้อมูลโรงงานจริง

## Migration And Rollout Checks

- รัน migration ก่อน application version ที่ออกเลขใหม่
- รัน `0102_change_bod_cod_report_number_prefix_to_e` เพื่อ backfill เลข regional เดิมและเปลี่ยน check constraint ให้รับเฉพาะ `E-...`
- ตรวจว่า `bod_cod_deviation_report_sequences` มี primary key `(region_code, report_year)`
- ตรวจว่า legacy row มี numbering snapshot เป็น `NULL` และ `report_no` เดิมไม่เปลี่ยน
- ทดสอบสร้างรายงานใหม่อย่างน้อยสอง region และตรวจว่าแต่ละ region เริ่ม sequence ของตนเอง
- ตรวจ client ให้แสดง `reportNo` ตรงค่า API และไม่ parse รูปแบบ
