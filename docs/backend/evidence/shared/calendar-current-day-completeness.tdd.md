# Calendar Current-Day Completeness — TDD Evidence

## Contract

- [Calendar status API](../../api/shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)
- [Workflow spec](../../../../workflows/calendar-current-day-completeness.md)

เมื่อเวลาใน `Asia/Bangkok` คือ `2026-08-10 10:25`:

- วัน `2026-08-10` ต้องมี expected hourly buckets 11 ช่วง ตั้งแต่ชั่วโมง `00` ถึง `10`
- ข้อมูลครบทั้ง 11 ชั่วโมงต้องคืน `dataCompletenessPercent=100` และ `dataCompletenessStatus=highData`
- source row ชั่วโมง `23` ต้องไม่เพิ่ม numerator หรือเปลี่ยนผลของวันปัจจุบัน
- วันย้อนหลังที่มี 11 ชั่วโมงต้องคงสูตร 11/24 เป็น `46%` และ `lowData`
- low-data details ต้องไม่คืนวันปัจจุบันที่คำนวณได้ 100%

## RED / GREEN

| Phase | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/parameter-values.service.test.ts -t "calculates current Bangkok day completeness"` | FAIL | วันปัจจุบันได้ `50% lowData` เพราะ implementation นับ 12 source hours รวมชั่วโมงอนาคตและหารด้วย 24 |
| GREEN | คำสั่งเดิม | PASS | วันปัจจุบันได้ `100% highData`, วันย้อนหลังได้ `46% lowData` และ low-data details มีเฉพาะวันย้อนหลัง |

## Implementation

- `backend/src/modules/parameter-values/parameter-values.service.ts`
  - แปลงเวลาปัจจุบันเป็นวันที่และชั่วโมง `Asia/Bangkok`
  - กำหนด expected hours ของวันปัจจุบันเป็น `currentHour + 1`
  - ตัด source rows หลัง bucket ปัจจุบันออกจาก completeness calculation
  - ใช้กฎเดียวกันใน calendar summary และ details
- `backend/tests/unit/parameter-values.service.test.ts`
  - freeze system time ที่ `2026-08-10T03:25:00.000Z` ซึ่งตรงกับ `10:25` ในกรุงเทพฯ
  - ตรวจผลวันย้อนหลัง วันปัจจุบัน annual low-data count และ low-data detail rows
  - ตรวจ explicit parameter completeness โดยให้ชั่วโมง `00` ถึง `10` เป็น `100%` และ future row ชั่วโมง `23` เป็น `0%`; ผลวันปัจจุบันต้องยังเป็น `100%`

## Verification

ผลตรวจฉบับสมบูรณ์บันทึกใน change summary ของงานนี้หลังรัน unit tests, typecheck และ lint.
