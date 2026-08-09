# หลักฐาน TDD: กรอง Source Status และแยกความครบถ้วนจากสถานะมลพิษใน Calendar

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)
- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status details](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-statusdetails)

## Source And User Journey

เมื่อ frontend เรียก `GET /api/v1/connected-measurement-points/S1125/calendar-status?month=2026-08`:

- `data.calendar.days[].pollutionStatus` ต้องประเมินเกณฑ์จากค่าที่ source row มี status ปกติเท่านั้น
- `data.monthlySummary[].exceededDays` ต้องนับทั้งปีตามกฎเดียวกัน โดยวันเดียวกันนับสูงสุดหนึ่งครั้งต่อพารามิเตอร์
- source status ปกติหมายถึง `Normal`, `Ok` หรือ StatusCode `1`; status อื่น รวมถึง `null` และค่าว่าง ต้องไม่ถูกนำไปเทียบเกณฑ์
- `dataCompletenessStatus` ใช้กำหนดพื้นหลังและ `lowDataDays` ส่วน `pollutionStatus` ใช้กำหนดเส้นขอบและ `exceededDays`; สองสถานะนี้ต้องคำนวณแยกกัน
- วันที่เป็น `lowData` แต่มีค่าจาก source status ปกติที่ประเมินเป็น `exceeded` ต้องมีเส้นขอบ `exceeded`, ถูกนับในทั้ง `lowDataDays` และ `exceededDays` และปรากฏใน details ของทั้งสอง `summaryType`
- `insufficient` ใช้เมื่อไม่มีค่าจาก source status ปกติให้ประเมิน หรือมีเฉพาะค่าที่ใช้ไม่ได้จากความครบถ้วนระดับ row; ไม่ได้เกิดจาก `lowData` ระดับวันโดยอัตโนมัติ
- `monthlySummary[].lowDataDays` และ `todayDataCompletenessPercent` ต้องคงวิธีคำนวณเดิม

กฎนี้ใช้ `<parameter>_status` ของ measurement row ไม่ใช่ `channelStatus` จาก device config และ endpoint details ใช้กฎเดียวกันเพื่อให้รายการที่แสดงตรงกับจำนวนวันที่สรุป

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: non-normal source status | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "uses only Normal, Ok, and code 1 source statuses"` | FAIL | วันที่ `2026-08-09` มีค่า `220` แต่ `co_status=Maintenance`; implementation เดิมยังคืน `pollutionStatus=exceeded` แทน `normal` |
| GREEN: measurement-usable source statuses | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts` | PASS | 1 suite, 33 tests; `Calibration`, `Maintenance`, `pass` และ status ที่ไม่รู้จักไม่ถูกประเมิน ขณะที่ `Normal`, `Ok` และ code `1` ยังใช้ประเมิน `exceeded` ได้ |
| RED: low-data coupling | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "keeps low-data completeness independent"` | FAIL ก่อนแก้ | วันที่มีความครบถ้วนรายวัน 46% และค่าปกติที่เกินมาตรฐานถูกบังคับเป็น `pollutionStatus=insufficient`, ไม่ถูกนับใน `exceededDays` และไม่ปรากฏใน `summaryType=exceeded` |
| GREEN: independent completeness and pollution | คำสั่ง RED เดียวกัน | PASS | วันเดียวกันคืนพื้นหลัง `lowData` กับเส้นขอบ `exceeded`, นับ `lowDataDays=1` และ `exceededDays=1` และอยู่ใน details ของทั้งสอง `summaryType` |
| RED: parameter completeness guard | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "does not evaluate rows whose explicit parameter completeness"` | FAIL ก่อนแก้ | ค่า `co_data_completeness_percent=50` ถูกประเมินเป็น `exceeded` เพราะ implementation อ่านเฉพาะ completeness ระดับ row ส่วนกลาง |
| GREEN: parameter completeness guard | คำสั่ง RED เดียวกัน | PASS | ค่า completeness เฉพาะพารามิเตอร์ต่ำกว่า 80% ยังคงเป็น `insufficient`, ไม่เพิ่ม `exceededDays` และไม่อยู่ใน exceeded details |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | `calendar.pollutionStatus` ไม่เป็น `exceeded` จากค่าที่ source status เป็น `Maintenance` | `backend/tests/unit/parameter-values.service.test.ts` | Service regression | PASS |
| 2 | `monthlySummary.exceededDays` ไม่นับวันที่ source status เป็น `Calibration` หรือ `Maintenance` แม้อยู่ในปีที่ร้องขอ | `backend/tests/unit/parameter-values.service.test.ts` | Annual summary contract | PASS |
| 3 | ค่าที่ source status เป็น `Normal` ยังถูกประเมินด้วย criteria ของ connected point และนับวันเกินมาตรฐานได้ | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 4 | รายละเอียด `summaryType=exceeded` ข้ามค่าที่ source status เป็น `Maintenance` แม้เวลานั้นมาก่อนค่า `Normal` ที่เกินมาตรฐาน | `backend/tests/unit/parameter-values.service.test.ts` | Detail consistency regression | PASS |
| 5 | `lowDataDays`, `todayDataCompletenessPercent` และการไม่ใช้ device `channelStatus` แทน measurement-row status ยังคงเดิม | `backend/tests/unit/parameter-values.service.test.ts` | Regression | PASS |
| 6 | status แบบ `pass` หรือข้อความที่ไม่ตรง POMS contract ไม่ถูกนับเป็น `Normal` สำหรับ `pollutionStatus` และ `exceededDays` | `backend/tests/unit/parameter-values.service.test.ts` | Strict status regression | PASS |
| 7 | วันที่ `lowData` ยังคืน `pollutionStatus` และ `display.borderStatus` ตามค่าจาก source status ปกติที่ใช้ประเมินได้ | `backend/tests/unit/parameter-values.service.test.ts` | Independence regression | PASS |
| 8 | วันที่ `lowData` ที่มีค่าเกินมาตรฐานถูกนับในทั้ง `lowDataDays` และ `exceededDays` และคืนจาก details ของทั้ง `summaryType=lowData` และ `summaryType=exceeded` | `backend/tests/unit/parameter-values.service.test.ts` | Summary/detail consistency regression | PASS |
| 9 | completeness เฉพาะพารามิเตอร์ต่ำกว่า 80% ยังป้องกันไม่ให้ค่านั้นกำหนด `pollutionStatus`, `exceededDays` หรือ exceeded detail | `backend/tests/unit/parameter-values.service.test.ts` | Parameter completeness regression | PASS |

## Verification

- Targeted low-data regression: `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "keeps low-data completeness independent"` ผ่าน 1 test (32 skipped)
- `npm run typecheck`: ผ่าน
- `npm run build`: ผ่าน
- `npm run lint`: ผ่านด้วย 0 errors; มี 145 warnings เดิมในไฟล์นอกขอบเขตงาน
- Focused regression: `npm test -- --runInBand tests/unit/parameter-values.service.test.ts` ผ่าน 1 suite, 33 tests
- Full backend regression: `npm test -- --runInBand` ผ่าน 108 suites, 997 tests
- Changed TypeScript files ผ่าน Prettier
- Coverage ของ `parameter-values.service.ts`: statements 83.89%, branches 70.75%, functions 91.33%, lines 87.03%; branch coverage ต่ำกว่า 80% จาก coverage debt เดิมและไม่มี threshold บังคับ
- `npm audit --omit=dev`: ไม่ได้รันซ้ำเพราะไม่มีการเปลี่ยน dependency
- JSON examples ใน canonical contract จำนวน 6 blocks: ผ่าน
- `git diff --check`: ผ่าน

## Existing Merge Evidence: Source-status Filter

- RED checkpoint: `221dbbc test: reproduce non-normal calendar exceedance`
- GREEN checkpoint: `94add16 fix: filter calendar exceedances by normal status`

## Change Declaration

- Docs impact: updated
- Canonical docs: `docs/backend/api/shared/connected-measurement-points/README.md`
- Reason: `pollutionStatus` และ `exceededDays` ต้องใช้เฉพาะค่าจาก source status ปกติ โดยไม่ถูกสถานะ `lowData` ระดับวันบังคับเป็น `insufficient`
- Client impact: response shape ไม่เปลี่ยน; วันที่ `lowData` อาจเปลี่ยนเส้นขอบจาก `insufficient` เป็น `normal`, `warning` หรือ `exceeded` และค่า `exceededDays` กับ exceeded detail อาจเพิ่มขึ้นให้ตรงกับค่าที่ใช้ประเมินได้
- Breaking change: no
