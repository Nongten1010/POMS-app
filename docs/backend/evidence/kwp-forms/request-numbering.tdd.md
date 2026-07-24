# หลักฐาน TDD: เลขคำขอ กวภ. แยกตามแบบ ภาค และปี

เอกสารนี้สนับสนุน [contract เมนูแจ้งแบบ กวภ. 01 - กวภ. 05](../../api/menus/kwp-forms/README.md#เลขที่คำขอ-requestno) และไม่ใช้แทน canonical API contract.

## Source Plan

ไม่มี plan file. Acceptance criteria มาจากตัวอย่างและตารางรหัสภาคที่ผู้ใช้ยืนยันในบทสนทนางานนี้:

- รูปแบบ `F{เลขแบบ 2 หลัก}-{รหัสภาค 2 หลัก}-{ลำดับ 4 หลัก}/{ปี พ.ศ. 4 หลัก}`
- running แยกตาม `แบบ + ภาค + ปี พ.ศ.`
- ภาคกลางใช้รหัส `07`
- เก็บเลขเดิม `KWP-YY-NNNNN` โดยไม่เปลี่ยนย้อนหลัง
- ลำดับสูงสุดต่อชุดคือ `9999`

## RED Evidence

Formatter และ migration RED:

```bash
npm test -- --runInBand \
  tests/unit/kwp-form-submission-number.test.ts \
  tests/unit/kwp-form-submission-sequence-migration.test.ts
```

ผล: `2 failed`; TypeScript หา formatter และ migration ใหม่ไม่พบ (`TS2307`).

Repository sequence RED:

```bash
npm test -- --runInBand \
  tests/unit/kwp-form-submission-sequence.repository.test.ts \
  tests/unit/kwp-form-submissions.repository.test.ts
```

ผลหลังแก้ type ของ test harness: test ใหม่ยัง compile ไม่ผ่าน เพราะไม่มี test seam สำหรับ region/sequence และ insert mapper ยังไม่มีข้อมูล numbering snapshot.

## GREEN Evidence

| # | สิ่งที่รับประกัน | Test | ประเภท | ผล |
| --- | --- | --- | --- | --- |
| 1 | ตัวอย่างทั้ง กวภ.01-05 ให้เลขตรงรูปแบบที่ยืนยัน | `kwp-form-submission-number.test.ts` | unit | PASS |
| 2 | รหัสภาค `02`-`07` map จากชื่อภาคของจังหวัด และค่าที่ไม่รู้จักถูกปฏิเสธ | `kwp-form-submission-number.test.ts` | unit | PASS |
| 3 | ปี พ.ศ. เปลี่ยนตามเขตเวลา `Asia/Bangkok` | `kwp-form-submission-number.test.ts` | unit | PASS |
| 4 | sequence ถูกแยกด้วย `form_type + region_code + buddhist_year` และล็อกก่อนเพิ่ม | `kwp-form-submission-sequence.repository.test.ts` | repository/unit | PASS |
| 5 | ลำดับถัดจาก `9999` ตอบ conflict โดยไม่ update sequence | `kwp-form-submission-sequence.repository.test.ts` | repository/unit | PASS |
| 6 | create กวภ.01 หา region จากโรงงานฝั่ง server และบันทึกเลขพร้อม snapshot | `kwp-form-submission-create-numbering.repository.test.ts` | repository/integration-style | PASS |
| 7 | สิทธิ์ตามภาคและรายงานใช้ snapshot สำหรับคำขอใหม่ และ fallback ไปภาคปัจจุบันสำหรับข้อมูลเดิม | `kwp-form-submissions.repository.test.ts`, `kwp-form-reports.repository.test.ts` | repository/unit | PASS |
| 8 | migration เพิ่ม sequence table, snapshot columns และ constraint ที่บังคับให้เลขใหม่สัมพันธ์กับ metadata โดยไม่ rewrite เลขเดิม | `kwp-form-submission-sequence-migration.test.ts` | migration/unit | PASS |
| 9 | route และ report ส่งเลขใหม่ที่มี `/` เป็น opaque string ครบทั้ง กวภ.01-05 | `kwp-form-submissions.route.test.ts`, `kwp-form-reports.route.test.ts` | route/integration | PASS |

Targeted KWP GREEN:

```text
Test Suites: 8 passed, 8 total
Tests:       89 passed, 89 total
```

Regression suite ที่ไม่ต้องต่อฐานข้อมูลภายใน:

```text
Test Suites: 90 passed, 90 total
Tests:       803 passed, 803 total
```

## Coverage And Verification

`npm run test:coverage -- --runInBand --testPathIgnorePatterns=officer-notification-email-recipients.route.test.ts`
ผ่าน `90` suites และ `803` tests. Coverage ของ formatter ใหม่:

```text
kwp-form-submission-number.ts  Statements 95%  Branches 85.71%  Functions 100%  Lines 94.73%
```

Repository-wide coverage เป็น `55.68%` statements, ต่ำกว่าเป้าหมาย `80%` ของโครงการ เนื่องจาก baseline ของทั้ง repository ยังมี module ที่ไม่มี coverage; งานนี้ไม่ลด scope ของคำสั่งและรายงานค่าจริงไว้แทนการกล่าวว่า repository ผ่านเกณฑ์.

Checks:

- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- `npm test -- --runInBand` — KWP และอีก `90` suites ผ่าน; `officer-notification-email-recipients.route.test.ts` จำนวน `3` tests timeout เพราะพยายามเชื่อม SQL Server ภายใน `172.16.31.184:1433`.
- `npm test -- --runInBand --testPathIgnorePatterns=officer-notification-email-recipients.route.test.ts` — PASS, `90` suites และ `803` tests.
- `npm run lint` — PASS โดยไม่มี error; มี warning เดิมของ repository.
- ESLint และ Prettier เฉพาะไฟล์ในงานนี้ — PASS.
- `npm audit --omit=dev --offline` — PASS, ไม่พบ vulnerability จาก lockfile.
- `git diff --check` และ local-link check ของเอกสารที่แก้ — PASS.
- ไม่ได้รัน migration กับฐานข้อมูลจริงในงานนี้ เพื่อไม่เปลี่ยน external state; deployment ต้องรัน migrations ถึง `0081` ก่อนใช้ application version นี้.

## Merge Evidence

ไม่มี checkpoint commit หรือ merge ในงานนี้ เพราะผู้ใช้ไม่ได้ขอ commit และ worktree มีไฟล์อื่นของผู้ใช้อยู่แล้ว. หลักฐาน RED/GREEN จึงเก็บด้วยคำสั่งและผลทดสอบข้างต้น.
