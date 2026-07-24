# หลักฐาน TDD: การล้างข้อมูลทดสอบ Production

## ขอบเขต

เครื่องมือบำรุงรักษานี้ล้างเฉพาะข้อมูลธุรกรรม CEMS/WPMS และข้อมูลลูกที่อ้างอิงผ่าน
Foreign Key พร้อมล้างข้อมูลวัดของ station เดิมและรีเซ็ตลำดับเลข โดยเก็บ `users`,
`factories`, `eligible_factories` และ master data ไว้

## Safety guarantees

| # | สิ่งที่รับประกัน | Test | ผล |
|---|---|---|---|
| 1 | ตารางลูกถูกลบก่อนตารางแม่ | `test-data-reset-plan.test.ts` | PASS |
| 2 | หยุดทำงานเมื่อพบวงจร Foreign Key | `test-data-reset-plan.test.ts` | PASS |
| 3 | ล้างเฉพาะตาราง parameter ที่ตรงกับ station ที่บันทึกไว้ | `test-data-reset-plan.test.ts` | PASS |
| 4 | ปฏิเสธ SQL identifier ที่ไม่ปลอดภัย | `test-data-reset-plan.test.ts` | PASS |
| 5 | ยอมรับฐานที่อยู่ร่วมกับ production runner เฉพาะเมื่อเรียกจาก GitHub Actions ของ repository นี้บน `main` | `test-data-reset-plan.test.ts` | PASS |

## Operational safeguards

- ค่าเริ่มต้นเป็น `preview` และไม่แก้ข้อมูล
- โหมด `execute` ต้องยืนยันด้วย `RESET-POMS-TEST-DATA`
- ยอมรับเฉพาะฐาน `POMS` และ `parameter_ingest` จาก GitHub Actions ของ repository นี้บน `main`
- หยุด backend ก่อนลบ และเปิดพร้อมตรวจ health หลังลบ
- สร้างและตรวจสอบ SQL Server backup ก่อนเริ่ม transaction
- ไม่รีเซ็ต internal identity IDs

## Evidence

RED: test compile ไม่ผ่านเพราะยังไม่มี `test-data-reset-plan`.

GREEN:

```text
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```
