# Calendar Current-Day Completeness Workflow

## Goal

ทำให้เปอร์เซ็นต์การส่งข้อมูลของหน้าหลัก สถิติ และปฏิทินสะท้อนเฉพาะชั่วโมงที่จบแล้ว โดยตรวจการส่งทันเวลาด้วย `ctime`/`utime` และไม่ลดเปอร์เซ็นต์จากชั่วโมงปัจจุบันที่ยังไม่จบ สัญญาที่เผยแพร่อยู่ที่ [กติกาหน้าหลัก](../docs/backend/api/shared/connected-measurement-points/README.md#home-measurement-rules)

## Trigger

ทำงานทุกครั้งที่ backend ประมวลผลคำขอใดคำขอหนึ่งต่อไปนี้จากตารางรายชั่วโมง `60m`:

- `GET /api/v1/connected-measurement-points/:stationId/calendar-status?month=YYYY-MM`
- `GET /api/v1/connected-measurement-points/:stationId/calendar-status/details?year=YYYY&summaryType=lowData&...`
- `GET /api/v1/connected-measurement-points/:stationId/measurement-statistics?date=YYYY-MM-DD`

รวม annual path aliases ของสาม endpoint; ไม่เปลี่ยน calculation context ของ CSV หรือเมนูอื่น

## Time Reference

- ใช้นาฬิกา `Asia/Bangkok` เพื่อระบุวันที่และชั่วโมงปัจจุบัน
- ชั่วโมงปัจจุบันไม่เป็น expected bucket จนกว่าจะสิ้นสุด
- ตัวอย่าง: เวลา `2026-08-10 10:25` ชั่วโมงล่าสุดที่นำมาคำนวณคือ `09:00–09:59`
- ชั่วโมง `10:00–10:59` ถึง `23:00–23:59` ยังไม่อยู่ในรอบคำนวณ
- ช่วง `00:00–00:59` ล่าสุดของ dashboard/map เป็นชั่วโมง 23 ของวันก่อนหน้า ส่วนวันปัจจุบันยังไม่มีชั่วโมงที่จบแล้ว

## Calculation Rules

1. กรอง visibility โรงงาน → จุด → พารามิเตอร์ และจุดที่ยกเว้นทั้งหมด ก่อนสร้าง expected data และสรุปผล
2. จัด source rows เข้าวัน/ชั่วโมงตาม `cdate`/`ctime` และตรวจ `utime` กับเวลาสิ้นสุดชั่วโมงเดียวกัน
3. ใช้เฉพาะชั่วโมงที่จบแล้วของวันปัจจุบันและช่วงวันเต็มของวันที่ผ่านมา เริ่มวันด้วย bucket `00:00–00:59` รวม row เวลา `00:00`; denominator เป็นจำนวนพารามิเตอร์ที่แสดง × จำนวนชั่วโมงที่คาดว่าจะได้รับข้อมูล
4. ข้อมูลมาช้าแสดงค่าของชั่วโมงต้นทางได้ แต่ไม่เพิ่มตัวตั้งการส่งทันเวลา และชั่วโมงปัจจุบันไม่เพิ่มตัวตั้งหรือตัวหาร
5. คำนวณเปอร์เซ็นต์ส่งทันเวลา/ข้อมูลย้อนหลังแยกกันจาก expected data ชุดเดียวกัน แล้ว clamp ให้อยู่ระหว่าง 0 ถึง 100
6. `dataCompletenessStatus` เป็น `lowData` เมื่อเปอร์เซ็นต์ต่ำกว่า 80 มิฉะนั้นเป็น `highData`
7. ใช้ daily summary ชุดเดียวกันกับสถิติ, `calendar.days`, `monthlySummary`, summary ของจุด และ details เพื่อให้เปอร์เซ็นต์/จำนวนวันตรงกัน
8. `lowDataDays` นับช่วงต่อเนื่องล่าสุดย้อนจากวันสิ้นสุด ข้ามปีได้จนถึงวันแรกที่ได้อย่างน้อย 80% หรือวันเริ่มคาดหวังข้อมูล; `exceededDays` นับวันไม่ซ้ำจากต้นปีถึงวันสิ้นสุด
9. คงการประเมิน source operational status และเกณฑ์มลพิษเดิม แล้วใช้ `lateData` เฉพาะค่าที่ปกติแต่ส่งช้า โดย `warning`/`exceeded` มีลำดับสูงกว่า

## Acceptance Examples

| Bangkok time | Date being calculated | Complete hourly buckets | Expected result |
| --- | --- | ---: | --- |
| `2026-08-10 10:25` | `2026-08-10` | ทุก expected bucket ถึงชั่วโมง `09` ส่งทันเวลา | `100%`, `highData` |
| `2026-08-10 10:25` | `2026-08-10` | ชั่วโมง `09` มาช้าที่ `10:05` | ไม่เพิ่มเปอร์เซ็นต์ส่งทันเวลา; ค่าเดิมแสดงย้อนหลังได้ |
| `2026-08-10 10:25` | `2026-08-09` | ทุก expected bucket ของวันย้อนหลังส่งทันเวลา | `100%`, `highData` |
| `2026-08-10 00:25` | `2026-08-10` | ยังไม่มีชั่วโมงที่จบแล้ว | ไม่ใช้ชั่วโมง `00` เป็นข้อมูลขาด; dashboard/map เลือกชั่วโมง 23 ของวันก่อนหน้า |
| `2026-08-10 23:25` | `2026-08-10` | ทุก expected bucket ถึงชั่วโมง `22` ส่งทันเวลา | `100%`, `highData` |

## Checkpoint And Brief

ไม่มี checkpoint ระหว่าง request เพราะเป็น deterministic backend calculation หลัง implementation ผู้ดูแลรับ brief ครั้งเดียวพร้อมผล unit test, typecheck, canonical API documentation และรายชื่อไฟล์ที่แก้

## Implementation Map

- Service: `backend/src/modules/parameter-values/parameter-values.service.ts`
- Unit tests: `backend/tests/unit/parameter-values.service.test.ts`
- Canonical contract: `docs/backend/api/shared/connected-measurement-points/README.md`
- TDD evidence: `docs/backend/evidence/shared/calendar-current-day-completeness.tdd.md`

## Done

- Regression test พิสูจน์เวลาไทย `10:25` ว่าทุกชั่วโมงที่จบแล้วส่งทันเวลาได้ `100%` โดยไม่ใช้ชั่วโมง 10 และข้อมูลส่งช้าไม่เพิ่มเปอร์เซ็นต์ย้อนหลัง
- Calendar summary และ low-data details ใช้ผล current-day completeness เดียวกัน
- `npm run typecheck`, targeted unit tests และ lint ของไฟล์ที่แก้ผ่าน
- Canonical API docs และ evidence ถูกลิงก์จาก index ที่ดูแลอยู่
