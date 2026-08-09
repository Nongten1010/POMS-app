# หลักฐาน TDD: รายละเอียดสำหรับคลิกสรุป Calendar Status

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status summary](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)
- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status details](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-statusdetails)

## Source And User Journey

Frontend ต้องเรียกรายละเอียดจากแถว `monthlySummary` เมื่อผู้ใช้คลิกจำนวนวัน `exceededDays` หรือ `lowDataDays` โดยส่ง `month`, `summaryType`, `parameterCode` และ `unit` ของแถวที่คลิก

- `summaryType=exceeded` คืนวันที่ เวลา source จริง ค่าที่วัด ค่าเกณฑ์ และผลต่างจากเกณฑ์
- `summaryType=lowData` คืนวันที่ ชั่วโมงที่ขาดของพารามิเตอร์ที่เลือก และ `lowDataCauses` ซึ่งอธิบายว่าพารามิเตอร์ใดทำให้วันนั้นมีข้อมูลต่ำกว่า 80%
- ข้อมูลถูกจำกัดไว้ใน `month=YYYY-MM` ที่ร้องขอ และใช้ permission/data scope เดียวกับ Calendar Status เดิม

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: endpoint contract | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connected-measurement-points.route.test.ts` | FAIL | TypeScript compile ไม่ผ่านเพราะยังไม่มี `calendarStatusDetails` และ `getCalendarStatusDetails` ใน service/controller contract |
| GREEN: endpoint contract | คำสั่งเดิม | PASS | 3 suites, 119 tests; route, connection wrapper และ detail aggregation ทำงานครบ |
| RED: exact occurrence time | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "returns exceeded occurrences"` | FAIL | fixture เวลา `05:30:00` ถูกลดเหลือ `05:00:00` |
| GREEN: exact occurrence time | คำสั่งเดิม | PASS | `time` คงเวลาจริงจาก `ctime` เป็น `05:30:00`; `displayTime` ยังแสดงช่วงชั่วโมงได้ |
| RED: low-data cause | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "identifies which parameter caused"` | FAIL | วันที่ low data จาก NOx ยังไม่มีข้อมูลอธิบายเมื่อผู้ใช้คลิกแถว CO |
| GREEN: low-data cause | คำสั่งเดิม | PASS | `lowDataCauses` คืนทุกพารามิเตอร์ที่ต่ำกว่า 80% พร้อมชั่วโมงที่ขาด |
| Final focused regression | คำสั่ง endpoint contract ด้านบน | PASS | 3 suites, 121 tests |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | `exceeded` คืนเฉพาะวันที่ในเดือนที่เลือก พร้อมค่าที่วัด ค่าเกณฑ์ ผลต่าง และ source time จริง | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 2 | `lowData` ใช้กฎรายวันเดียวกับ `monthlySummary[].lowDataDays` และอธิบายพารามิเตอร์ต้นเหตุ | `backend/tests/unit/parameter-values.service.test.ts` | Service contract/regression | PASS |
| 3 | wrapper เติมข้อมูลโรงงาน current/live โดยไม่เปลี่ยน parameter-detail payload | `backend/tests/unit/connection-requests.service.test.ts` | Module integration contract | PASS |
| 4 | route validate query และตอบ `400` เมื่อขาด field ที่จำเป็น | `backend/tests/unit/connected-measurement-points.route.test.ts` | HTTP contract | PASS |
| 5 | route บังคับ `dashboard.stats:view` และตอบ `403` เมื่อไม่มีสิทธิ์ | `backend/tests/unit/connected-measurement-points.route.test.ts` | Authorization regression | PASS |
| 6 | พารามิเตอร์ที่ไม่พบตอบ `404` และ code ที่ซ้ำหลายหน่วยต้องระบุ `unit` | `backend/tests/unit/parameter-values.service.test.ts` | Boundary contract | PASS |

## Verification

- `npm run build`: ผ่าน
- `npm run typecheck`: ผ่าน
- `npm run lint`: ผ่านด้วย 0 errors; พบ 145 warnings เดิมในไฟล์นอกขอบเขตงาน
- Full backend regression และ coverage: 108 suites, 991 tests ผ่าน
- Full coverage ของ `src/modules/parameter-values`: statements 81.28%, branches 73.6%, functions 82.77%, lines 84.08%
- Full coverage ของ `parameter-values.service.ts`: statements 85.48%, branches 70.67%, functions 91.85%, lines 88.88%
- Repository-wide coverage: statements 60.38%, branches 59.85%, functions 64.54%, lines 61.67%; ยังต่ำกว่าเป้าหมาย 80% จาก coverage debt เดิมและไม่มี global threshold บังคับใน Jest config
- `npm audit --omit=dev`: พบ 0 vulnerabilities
- Secret/credential และ debug-log scan ในไฟล์ที่เปลี่ยน: ไม่พบ
- `git diff --check`: ผ่าน
- Repository ยังไม่มี executable docs guard; ตรวจ canonical link, endpoint registry และ evidence index ใน diff นี้แทน

## Merge Evidence

- RED endpoint checkpoint: `f59a0ef test: add calendar summary detail API contract`
- GREEN endpoint checkpoint: `88647c3 feat: add calendar summary detail API`
- RED exact-time checkpoint: `a56e445 test: preserve exact exceeded occurrence time`
- GREEN exact-time checkpoint: `3ad7b3c fix: retain exact calendar detail event times`
- RED low-data-cause checkpoint: `1af5d83 test: expose low-data parameter causes`
- GREEN low-data-cause checkpoint: `a26bbce fix: explain low-data parameter causes`
- Parameter-unit regression checkpoint: `d8f79b8 test: cover ambiguous calendar detail parameters`

## Scope

- แก้เฉพาะ backend API, canonical backend documentation และ TDD evidence
- ไม่แก้ `frontend/`
- Docs impact: updated
- Canonical docs: `docs/backend/api/shared/connected-measurement-points/README.md`
- Reason: เพิ่ม client-visible endpoint และ response contract สำหรับ drill-down จาก Calendar Status summary
- Client impact: frontend สามารถแสดงวัน เวลา ค่าที่เกิน เกณฑ์ ผลต่าง และชั่วโมงข้อมูลขาดได้จาก endpoint เดียว
- Breaking change: no
