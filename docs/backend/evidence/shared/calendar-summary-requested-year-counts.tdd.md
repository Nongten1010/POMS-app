# หลักฐาน TDD: ปฏิทินรายเดือนและจำนวนวันสรุปทั้งปี

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)

## Source And User Journey

เมื่อ frontend เรียก `GET /api/v1/connected-measurement-points/S1125/calendar-status?month=2025-08`:

- `data.calendar.days` ต้องมีเฉพาะวันที่ใน `2025-08`
- `data.monthlySummary[].exceededDays` และ `lowDataDays` ต้องนับทุกวันที่เข้าเงื่อนไขตั้งแต่ `2025-01-01` ถึง `2025-12-31`
- `data.monthlySummary[].todayDataCompletenessPercent` ต้องคงพฤติกรรมเดิม คือใช้ daily summary ล่าสุดของเดือนที่ร้องขอ

Backend จึง query source ทั้งปีของ `month` ที่เลือก แล้วแยกตัวกรองเดือนสำหรับ calendar ออกจากตัวกรองปีสำหรับสอง counters

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: annual counter contract | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connected-measurement-points.route.test.ts` | FAIL | implementation เดิม query เฉพาะเดือนและ type ของ details ยังรับ `month` |
| GREEN: annual counter contract | คำสั่งเดิม | PASS | 3 suites, 122 tests; repository range เป็น `2025-01-01` ถึง `2025-12-31`, calendar เหลือเฉพาะเดือน 8 และ counters รวมเดือน 1 กับเดือน 8 |
| RED: requested-month completeness regression | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "counts summary days across the requested year while keeping calendar days month-scoped"` | FAIL | เมื่อ fixture มีข้อมูลเดือน 12 ค่า `todayDataCompletenessPercent` ถูกเปลี่ยนจากเดือน 8 ไปเป็นวันล่าสุดของทั้งปี |
| GREEN: requested-month completeness regression | คำสั่งเดิม | PASS | field นี้ใช้ daily summary ล่าสุดของเดือน 8 ขณะที่สอง counters ยังนับทั้งปี |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | repository อ่านข้อมูลทั้งปีที่ระบุโดย `month` | `backend/tests/unit/parameter-values.service.test.ts` | Database-boundary contract | PASS |
| 2 | `calendar.days` มีเฉพาะวันที่ในเดือนที่ร้องขอ | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 3 | `exceededDays` และ `lowDataDays` นับเฉพาะปีที่ร้องขอและรวมทุกเดือนในปีนั้น | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 4 | `todayDataCompletenessPercent` ยังมาจาก daily summary ล่าสุดของเดือนที่ขอตามพฤติกรรมเดิม แม้ปีนั้นมีข้อมูลเดือนหลังจากนั้น | `backend/tests/unit/parameter-values.service.test.ts` | Regression | PASS |

## Verification

- Focused regression: 3 suites, 122 tests ผ่าน
- Full backend regression: 108 suites, 993 tests ผ่าน
- `npm run build`: ผ่าน
- `npm run typecheck`: ผ่าน
- `npm run lint`: ผ่านด้วย 0 errors; มี 145 warnings เดิมในไฟล์นอกขอบเขตงาน
- Coverage ของ `src/modules/parameter-values`: statements 80.86%, branches 73.03%, functions 82.17%, lines 83.84%
- Coverage ของ `parameter-values.service.ts`: statements 84.89%, branches 70%, functions 91.26%, lines 88.58%
- Repository-wide coverage: statements 60.31%, branches 59.78%, functions 64.43%, lines 61.62%; ต่ำกว่าเป้าหมาย 80% จาก coverage debt เดิมและไม่มี global threshold บังคับ
- `npm audit --omit=dev`: 0 vulnerabilities
- `npm run format:check`: ยัง fail จาก 32 ไฟล์เดิมนอกขอบเขต; ไฟล์ TypeScript ที่เปลี่ยนในงานนี้ผ่าน Prettier
- Secret/credential และ debug-log scan ในไฟล์ที่เปลี่ยน: ไม่พบ
- ลิงก์ local ในเอกสารที่เปลี่ยนและ JSON examples 6 blocks: ผ่าน
- `git diff --check`: ผ่าน

## Merge Evidence

- RED contract checkpoint: `987f939 test: define annual calendar detail contract`
- RED fixture checkpoint: `7f714dc test: align annual calendar detail fixture`
- GREEN implementation checkpoint: `aaa89df fix: return annual calendar detail rows`
- RED completeness checkpoint: `fb8662d test: preserve requested-month completeness`
- GREEN completeness checkpoint: `6223727 fix: keep monthly completeness behavior`

## Scope

- แก้เฉพาะ backend calendar API, canonical backend documentation และ TDD evidence
- ไม่แก้ `frontend/`
- Docs impact: updated
- Canonical docs: `docs/backend/api/shared/connected-measurement-points/README.md`
- Reason: counters ต้องสะท้อนปีที่ผู้ใช้เลือก ขณะที่ปฏิทินยังแสดงเดือนเดิม
- Client impact: จำนวนใน `monthlySummary` เป็นทั้งปี และ frontend ใช้ endpoint details รายปีเมื่อคลิก
- Breaking change: yes; ดู `docs/backend/api/CHANGELOG.md`
