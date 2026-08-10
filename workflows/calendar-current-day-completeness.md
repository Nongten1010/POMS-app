# Calendar Current-Day Completeness Workflow

## Goal

ทำให้ `calendar.days[].dataCompletenessPercent` และ `dataCompletenessStatus` ของ API calendar status สะท้อนเฉพาะช่วงเวลาที่มาถึงแล้วในวันปัจจุบัน โดยไม่ลดเปอร์เซ็นต์จากชั่วโมงอนาคตที่ยังไม่ถึง

## Trigger

ทำงานทุกครั้งที่ backend ประมวลผลคำขอใดคำขอหนึ่งต่อไปนี้จากตารางรายชั่วโมง `60m`:

- `GET /api/v1/connected-measurement-points/:stationId/calendar-status?month=YYYY-MM`
- `GET /api/v1/connected-measurement-points/:stationId/calendar-status/details?year=YYYY&summaryType=lowData&...`

## Time Reference

- ใช้นาฬิกา `Asia/Bangkok` เพื่อระบุวันที่และชั่วโมงปัจจุบัน
- ชั่วโมงปัจจุบันเป็น bucket แบบ inclusive แม้นาทีในชั่วโมงนั้นยังไม่สิ้นสุด
- ตัวอย่าง: เวลา `2026-08-10 10:25` มี expected buckets 11 ช่วง ตั้งแต่ `00:00-00:59` ถึง `10:00-10:59`
- ชั่วโมง `11:00-11:59` ถึง `23:00-23:59` ยังไม่อยู่ในรอบคำนวณ

## Calculation Rules

1. จัดกลุ่ม source rows ตาม `cdate` เหมือน contract เดิม
2. สำหรับวันที่ย้อนหลัง ใช้ expected hours เท่ากับ 24 และคงสูตรเดิม
3. สำหรับวันที่ตรงกับวันปัจจุบันใน `Asia/Bangkok` ใช้ expected hours เท่ากับ `currentHour + 1`
4. เมื่อ fallback ไปนับข้อมูลจริง ให้นับหนึ่งครั้งต่อชั่วโมงที่มีค่าของพารามิเตอร์ตามกฎเดิม แล้วคำนวณ `round(completeHours / expectedHours * 100)`
5. source row ของวันปัจจุบันที่มี `ctime` หลัง bucket ปัจจุบันไม่นำมาคำนวณ completeness
6. ถ้า source มี explicit row-level หรือ parameter-level completeness ให้คง precedence และการเฉลี่ยเดิมเพื่อรักษา compatibility แต่ตัด row ในชั่วโมงอนาคตออกก่อน
7. clamp ผลลัพธ์ให้อยู่ระหว่าง 0 ถึง 100
8. `dataCompletenessStatus` เป็น `lowData` เมื่อเปอร์เซ็นต์ต่ำกว่า 80 มิฉะนั้นเป็น `highData`
9. ใช้ daily summary ชุดเดียวกันกับ `calendar.days`, `monthlySummary[].lowDataDays`, `monthlySummary[].todayDataCompletenessPercent` และ low-data details เพื่อไม่ให้ผลขัดกัน
10. ไม่เปลี่ยนกฎ `pollutionStatus`, source operational status หรือ exceeded evaluation

## Acceptance Examples

| Bangkok time | Date being calculated | Complete hourly buckets | Expected result |
| --- | --- | ---: | --- |
| `2026-08-10 10:25` | `2026-08-10` | `00` ถึง `10` ครบ 11 ชั่วโมง | `100%`, `highData` |
| `2026-08-10 10:25` | `2026-08-10` | ครบ 10 จาก 11 ชั่วโมง | `91%`, `highData` |
| `2026-08-10 10:25` | `2026-08-09` | ครบ 11 จาก 24 ชั่วโมง | `46%`, `lowData` |
| `2026-08-10 00:25` | `2026-08-10` | ชั่วโมง `00` ครบ | `100%`, `highData` |
| `2026-08-10 23:25` | `2026-08-10` | ครบ 24 ชั่วโมง | `100%`, `highData` |

## Checkpoint And Brief

ไม่มี checkpoint ระหว่าง request เพราะเป็น deterministic backend calculation หลัง implementation ผู้ดูแลรับ brief ครั้งเดียวพร้อมผล unit test, typecheck, canonical API documentation และรายชื่อไฟล์ที่แก้

## Implementation Map

- Service: `backend/src/modules/parameter-values/parameter-values.service.ts`
- Unit tests: `backend/tests/unit/parameter-values.service.test.ts`
- Canonical contract: `docs/backend/api/shared/connected-measurement-points/README.md`
- TDD evidence: `docs/backend/evidence/shared/calendar-current-day-completeness.tdd.md`

## Done

- Regression test พิสูจน์กรณี Bangkok `10:25` ว่าวันปัจจุบัน 11/11 เป็น `100%` และวันย้อนหลัง 11/24 ยังเป็น `46%`
- Calendar summary และ low-data details ใช้ผล current-day completeness เดียวกัน
- `npm run typecheck`, targeted unit tests และ lint ของไฟล์ที่แก้ผ่าน
- Canonical API docs และ evidence ถูกลิงก์จาก index ที่ดูแลอยู่
