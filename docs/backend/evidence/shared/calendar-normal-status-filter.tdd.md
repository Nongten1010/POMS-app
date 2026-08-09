# หลักฐาน TDD: กรอง Source Status ก่อนประเมิน Calendar

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)
- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status details](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-statusdetails)

## Source And User Journey

เมื่อ frontend เรียก `GET /api/v1/connected-measurement-points/S1125/calendar-status?month=2026-08`:

- `data.calendar.days[].pollutionStatus` ต้องประเมินเกณฑ์จากค่าที่ source row มี status ปกติเท่านั้น
- `data.monthlySummary[].exceededDays` ต้องนับทั้งปีตามกฎเดียวกัน โดยวันเดียวกันนับสูงสุดหนึ่งครั้งต่อพารามิเตอร์
- source status ปกติหมายถึง `Normal`, `Ok` หรือ StatusCode `1`; status อื่น รวมถึง `null` และค่าว่าง ต้องไม่ถูกนำไปเทียบเกณฑ์
- `monthlySummary[].lowDataDays` และ `todayDataCompletenessPercent` ต้องคงพฤติกรรมเดิม

กฎนี้ใช้ `<parameter>_status` ของ measurement row ไม่ใช่ `channelStatus` จาก device config และ endpoint details ใช้กฎเดียวกันเพื่อให้รายการที่แสดงตรงกับจำนวนวันที่สรุป

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: non-normal source status | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "uses only Normal source statuses"` | FAIL | วันที่ `2026-08-09` มีค่า `220` แต่ `co_status=Maintenance`; implementation เดิมยังคืน `pollutionStatus=exceeded` แทน `normal` |
| GREEN: Normal-only calendar evaluation | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts` | PASS | 1 suite, 31 tests; `Calibration`, `Maintenance`, `pass` และ status ที่ไม่รู้จักไม่ถูกประเมิน ขณะที่ค่า status `Normal` ยังทำให้วันนั้นเป็น `exceeded` และถูกนับหนึ่งวัน |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | `calendar.pollutionStatus` ไม่เป็น `exceeded` จากค่าที่ source status เป็น `Maintenance` | `backend/tests/unit/parameter-values.service.test.ts` | Service regression | PASS |
| 2 | `monthlySummary.exceededDays` ไม่นับวันที่ source status เป็น `Calibration` หรือ `Maintenance` แม้อยู่ในปีที่ร้องขอ | `backend/tests/unit/parameter-values.service.test.ts` | Annual summary contract | PASS |
| 3 | ค่าที่ source status เป็น `Normal` ยังถูกประเมินด้วย criteria ของ connected point และนับวันเกินมาตรฐานได้ | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 4 | รายละเอียด `summaryType=exceeded` ข้ามค่าที่ source status เป็น `Maintenance` แม้เวลานั้นมาก่อนค่า `Normal` ที่เกินมาตรฐาน | `backend/tests/unit/parameter-values.service.test.ts` | Detail consistency regression | PASS |
| 5 | `lowDataDays`, `todayDataCompletenessPercent` และการไม่ใช้ device `channelStatus` แทน measurement-row status ยังคงเดิม | `backend/tests/unit/parameter-values.service.test.ts` | Regression | PASS |
| 6 | status แบบ `pass` หรือข้อความที่ไม่ตรง POMS contract ไม่ถูกนับเป็น `Normal` สำหรับ `pollutionStatus` และ `exceededDays` | `backend/tests/unit/parameter-values.service.test.ts` | Strict status regression | PASS |

## Verification

- Full backend regression: 108 suites, 995 tests ผ่าน
- `npm run typecheck`: ผ่าน
- `npm run build`: ผ่าน
- `npm run lint`: ผ่านด้วย 0 errors; มี 145 warnings เดิมในไฟล์นอกขอบเขตงาน
- Focused regression: `npm test -- --runInBand tests/unit/parameter-values.service.test.ts` ผ่าน 1 suite, 31 tests
- Changed TypeScript files ผ่าน Prettier
- Coverage ของ `parameter-values.service.ts`: statements 82.8%, branches 69.34%, functions 89.92%, lines 86.12%; branch coverage ต่ำกว่า 80% จาก coverage debt เดิมและไม่มี threshold บังคับ
- `npm audit --omit=dev`: 0 vulnerabilities
- JSON examples ใน canonical contract จำนวน 6 blocks: ผ่าน
- `git diff --check`: ผ่าน

## Merge Evidence

- RED checkpoint: `221dbbc test: reproduce non-normal calendar exceedance`
- GREEN checkpoint: `94add16 fix: filter calendar exceedances by normal status`

## Change Declaration

- Docs impact: updated
- Canonical docs: `docs/backend/api/shared/connected-measurement-points/README.md`
- Reason: `pollutionStatus` และ `exceededDays` ต้องไม่ใช้ค่าจาก source status ที่ไม่ปกติ
- Client impact: response shape ไม่เปลี่ยน แต่ค่า `pollutionStatus`, `display.borderStatus`, `exceededDays` และ exceeded detail อาจลดลงให้ตรงกับข้อมูล status ปกติ
- Breaking change: no
