# หลักฐาน TDD: รายละเอียดรายวันทั้งปีของ Calendar Status

## Canonical Contract

- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status summary](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)
- [จุดตรวจวัดที่เชื่อมต่อแล้ว — Calendar status details](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-statusdetails)

## Source And User Journey

Frontend เรียก endpoint details เมื่อผู้ใช้คลิก `exceededDays` หรือ `lowDataDays` โดยส่ง `year`, `summaryType`, `parameterCode` และ `unit` ของแถวที่คลิก

- `summaryType=exceeded` คืนสูงสุดหนึ่งแถวต่อวัน โดยใช้ค่าที่มีสถานะเกินมาตรฐานรายการแรกตามเวลาจริง พร้อมช่วงเวลา ค่าตรวจวัด ค่าเกณฑ์ และผลต่าง
- `summaryType=lowData` คืนสูงสุดหนึ่งแถวต่อวัน มีเฉพาะวันที่และร้อยละการส่งข้อมูล และไม่มี field เวลา
- response เรียงวันที่จากเก่าไปใหม่ ไม่มี pagination และครอบคลุมทั้งปีที่เลือก

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED: annual row contract | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connected-measurement-points.route.test.ts` | FAIL | type เดิมไม่มี `year`/`rows` และยังบังคับ `month`/`days` |
| GREEN: annual row contract | คำสั่งเดิม | PASS | 3 suites, 122 tests; route, wrapper และ service ใช้ contract รายปีตรงกัน |
| First-exceedance regression | คำสั่งเดิม | PASS | fixture ที่มีค่าเกิน `01:15`, `01:45` และ `05:30` คืนเฉพาะ `01:15` ของวันนั้น |
| Maximum daily-row regression | คำสั่งเดิม | PASS | fixture ปี 2025 จำนวน 365 วันคืน 365 low-data rows โดยไม่คืน `time` |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | details รับ `year=YYYY`; query แบบเดิมที่ส่ง `month` ถูกปฏิเสธด้วย `400` | `backend/tests/unit/connected-measurement-points.route.test.ts` | HTTP validation contract | PASS |
| 2 | service query source ตั้งแต่วันที่ 1 มกราคมถึง 31 ธันวาคมของปีที่เลือก | `backend/tests/unit/parameter-values.service.test.ts` | Database-boundary contract | PASS |
| 3 | `exceeded` คืนหนึ่ง row ต่อวันและเลือกค่าที่เกินรายการแรกตาม exact `ctime` | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 4 | `lowData` คืนเฉพาะ `date` กับ `dataCompletenessPercent` และไม่มีเวลา | `backend/tests/unit/parameter-values.service.test.ts` | Service contract | PASS |
| 5 | wrapper เติมโรงงาน current/live โดยไม่เปลี่ยน detail payload | `backend/tests/unit/connection-requests.service.test.ts` | Module integration contract | PASS |
| 6 | route ยังบังคับ `dashboard.stats:view`; พารามิเตอร์ไม่พบตอบ `404` และ code หลายหน่วยต้องระบุ `unit` | `backend/tests/unit/connected-measurement-points.route.test.ts`, `backend/tests/unit/parameter-values.service.test.ts` | Authorization/boundary regression | PASS |

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

## Scope

- แก้เฉพาะ backend API, canonical backend documentation และ TDD evidence
- ไม่แก้ `frontend/`
- Docs impact: updated
- Canonical docs: `docs/backend/api/shared/connected-measurement-points/README.md`
- Reason: dialog ต้องแสดงข้อมูลทั้งปีแบบหนึ่งแถวต่อวันและไม่ต้องมี pagination
- Client impact: frontend เปลี่ยน query จาก `month` เป็น `year` และอ่าน `data.rows` ตาม `summaryType`
- Breaking change: yes; ดู `docs/backend/api/CHANGELOG.md`
