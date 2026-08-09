# หลักฐาน TDD: ส่งออกข้อมูลตรวจวัดของจุดเชื่อมต่อเป็น CSV

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Measurement CSV export](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidmeasurement-exportcsv)
- [หน้าหลัก](../../api/menus/home/README.md)

## Source And User Journey

ผู้ใช้เปิดรายละเอียดโรงงานจากหน้า Home เลือกจุดตรวจวัด พารามิเตอร์ ความถี่ และช่วงวันที่ แล้วกด `ส่งออก CSV`. Backend ต้องตรวจ authentication, permission `dashboard.stats:export` และ data scope ก่อนอ่าน source rows และ stream CSV โดยไม่เชื่อถือชื่อโรงงานหรือประเภทระบบที่ client แสดง.

ข้อกำหนดเริ่มจากไฟล์ตัวอย่าง `export-measurement_20260809201732.csv`, ภาพ dialog ของ frontend และการยืนยัน Q1-Q6 ใน [workflow](../../../../workflows/export-connected-measurement-csv.md).

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: module seam | `npm test -- --runInBand tests/unit/measurement-csv-export.test.ts` | FAIL | ยังไม่มี module สร้าง CSV และ golden contract |
| GREEN: module seam | คำสั่งเดิม | PASS | UTF-8 BOM, CRLF, headers พร้อมหน่วย, ordering, status/completeness, escaping และ filename ผ่าน 9 tests |
| RED: validator seam | `npm test -- --runInBand tests/unit/parameter-values.validator.test.ts` | FAIL | ยังไม่มี export query schema และ range limits |
| GREEN: validator seam | คำสั่งเดิม | PASS | repeated parameters, exact Gregorian dates, hourly 366 วัน และ daily 10 ปีผ่าน |
| RED: HTTP seam | `npm test -- --runInBand tests/unit/measurement-csv-export.route.test.ts` | FAIL | route ยังตอบ `404` |
| GREEN: focused vertical slice | `npm test -- --runInBand tests/unit/measurement-csv-export.test.ts tests/unit/measurement-csv-export.route.test.ts tests/unit/parameter-values.validator.test.ts` | PASS | 3 suites, 34 tests |
| RED: single-cell status contract | `npm test -- --runInBand tests/unit/measurement-csv-export.test.ts -t "streams an authorized hourly export"` | FAIL | CSV ยังมี `<Parameter> Status` และส่ง `Normal` แยกคอลัมน์ |
| GREEN: replace non-normal values | `npm test -- --runInBand tests/unit/measurement-csv-export.test.ts -t "exports normal measurements"` | PASS | parameter ละหนึ่งคอลัมน์; ปกติเป็นตัวเลข และสถานะอื่นแทนค่าด้วย `NoData`, `Maintenance`, `No Discharge` หรือ `Etc.` |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | Authorized hourly request ได้ exact CSV พร้อม headers สำหรับ download | `measurement-csv-export.route.test.ts` | Express/Supertest | PASS |
| 2 | ต้อง login และมี `dashboard.stats:export`; station นอก scope ตอบ `403` ก่อนโหลด metadata | `measurement-csv-export.route.test.ts` | Authorization integration | PASS |
| 3 | Missing station/table/data ใช้ `404`; no-data ใช้ `NO_EXPORT_DATA` และไม่เริ่ม CSV | `measurement-csv-export.route.test.ts` | Error contract | PASS |
| 4 | `hourly` ใช้ `60m`, `daily` ใช้ `1day`; monthly/range/date ที่ไม่รองรับตอบ `400` | `measurement-csv-export.route.test.ts`, `parameter-values.validator.test.ts` | HTTP + validation | PASS |
| 5 | Parameter matching ไม่สน case แต่สนหน่วย, รักษาลำดับ request และตัดค่าซ้ำ | `measurement-csv-export.test.ts` | Module contract | PASS |
| 6 | ไม่มี status column; operational status ที่ไม่ปกติแทนค่าตัวเลขใน parameter cell และ completeness ต่ำกว่า 80% ทำให้ cell ว่าง | `measurement-csv-export.test.ts` | Golden CSV | PASS |
| 7 | Daily midnight, ascending rows และ duplicate timestamps ถูกเก็บครบ | `measurement-csv-export.test.ts` | Golden CSV | PASS |
| 8 | RFC 4180, formula-injection protection, two decimals และ sanitized filename ทำงาน | `measurement-csv-export.test.ts` | Security/formatting | PASS |

## Verification

- Focused tests: 3 suites, 35 tests ผ่าน
- Full backend regression: 108 suites, 984 tests ผ่าน
- CSV module coverage after single-cell status contract: statements 96.66%, branches 84%, functions 100%, lines 97.05%
- `npm run typecheck`: ผ่าน
- ESLint และ Prettier check เฉพาะ source/tests ที่เปลี่ยน: ผ่าน
- `git diff --check`: ผ่าน
- Repository ยังไม่มี executable docs guard; ตรวจ endpoint registry, canonical links และ evidence index ใน diff นี้แทน

## Scope

- เปลี่ยนเฉพาะ `backend/`, canonical backend docs และ skill-managed workflow/notes
- ไม่แก้ `frontend/`, default permission grants, schema หรือ migration
- ไม่สร้าง stored file, signed URL, export history หรือ background job
