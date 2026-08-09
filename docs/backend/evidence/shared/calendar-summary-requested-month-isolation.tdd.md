# หลักฐาน TDD: แยกสรุป Calendar Status ตามเดือนที่ร้องขอ

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)

## Source And User Journey

ข้อกำหนดมาจากการตรวจ `GET /api/v1/connected-measurement-points/S1125/calendar-status?month=2025-08`: ผู้ใช้ต้องเห็น `data.monthlySummary[].exceededDays` และ `data.monthlySummary[].lowDataDays` ที่นับเฉพาะข้อมูลใน `2025-08` ขณะที่ `data.monthlySummary[].todayDataCompletenessPercent` ต้องคงพฤติกรรมเดิม

ตีความ `month=YYYY-MM` เป็นช่วงเดือนเดียวแบบ inclusive ไม่ใช่ทุกเดือนของปีเดียวกัน เพราะ request contract และ repository ใช้ `startDate`/`endDate` ระดับเดือน

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: calendar service seam | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "counts monthly summary days only from the requested month while preserving completeness"` | FAIL | Query `2025-08` ได้ `exceededDays: 2`, `lowDataDays: 2` เมื่อ fixture มีข้อมูล `2024-08`; expected คือ `1/1` จาก `2025-08` เท่านั้น |
| GREEN: calendar service seam | คำสั่งเดิม | PASS | สอง counter ใช้เฉพาะ daily summaries ระหว่าง `2025-08-01` ถึง `2025-08-31` |
| Regression strengthening | คำสั่งเดิม | PASS | เพิ่มข้อมูล `2026-08-11` ซึ่งใหม่กว่าเดือนเป้าหมาย และยืนยัน `todayDataCompletenessPercent: 83` เพื่อป้องกันการเปลี่ยนสูตรเดิม |
| Focused service suite | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts` | PASS | 1 suite, 24 tests |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | `month=2025-08` นับ `exceededDays` จาก daily summaries ใน `2025-08` เท่านั้น | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 2 | `month=2025-08` นับ `lowDataDays` จาก daily summaries ใน `2025-08` เท่านั้น | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 3 | การกรองสอง counter ไม่เปลี่ยน `todayDataCompletenessPercent` ซึ่งยังมาจาก latest summary ตามพฤติกรรมเดิม | `backend/tests/unit/parameter-values.service.test.ts` | Regression | PASS |
| 4 | Repository request ยังคงใช้ `startDate` และ `endDate` ของเดือนที่ร้องขอ | `backend/tests/unit/parameter-values.service.test.ts` | Database-boundary contract | PASS |

## Verification

- `npm run build`: ผ่าน
- `npm run typecheck`: ผ่าน
- `npm run lint`: ผ่านด้วย 0 errors; พบ 145 warnings เดิมในไฟล์นอกขอบเขตงาน
- Full backend regression และ coverage: 108 suites, 984 tests ผ่าน
- Full coverage ของ `parameter-values.service.ts`: statements 83.57%, branches 68.65%, functions 89.9%, lines 87%
- Repository-wide coverage: statements 60.03%, branches 59.66%, functions 64.15%, lines 61.31%; ยังต่ำกว่าเป้าหมาย 80% จาก coverage debt เดิมและไม่มี global threshold บังคับใน Jest config
- `npm audit --omit=dev`: พบ 0 vulnerabilities
- Secret/credential และ `console.log` scan ในไฟล์ที่เปลี่ยน: ไม่พบ
- `git diff --check`: ผ่าน
- Repository ยังไม่มี executable docs guard; ตรวจ canonical link และ evidence index ใน diff นี้แทน

## Merge Evidence

- RED checkpoint: `a54e8e6 test: add calendar summary month isolation reproducer`
- GREEN checkpoint: `4412ae7 fix: isolate calendar summary counts by requested month`
- Regression-strengthening checkpoint: `aa21d09 test: preserve calendar completeness during month filtering`

## Scope

- แก้เฉพาะ backend calendar summary, canonical backend documentation และ TDD evidence
- ไม่แก้ `frontend/`, route, query schema, authentication, permission, response field names หรือ HTTP status codes
- Docs impact: updated
- Canonical docs: `docs/backend/api/shared/connected-measurement-points/README.md`
- Reason: observable values ของ `exceededDays` และ `lowDataDays` ถูกจำกัดให้ตรงกับ `month` ใน request
- Client impact: ค่าเดิมที่ปนจากเดือนหรือปีอื่นจะลดลงเป็นค่าของเดือนที่เลือก; response shape ไม่เปลี่ยน
- Breaking change: no
