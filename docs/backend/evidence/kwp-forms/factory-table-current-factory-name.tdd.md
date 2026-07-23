# หลักฐาน TDD: ชื่อโรงงานในเมนู กวภ. ใช้ข้อมูล current/live POMS

## Requirement

ผู้ประกอบการและเจ้าหน้าที่ที่เปิดตารางรายชื่อโรงงานในเมนู กวภ. ต้องเห็น
`factoryName` จาก current/live POMS เหมือนกัน โดยบทบาทมีผลเฉพาะขอบเขตโรงงาน
ที่มองเห็น

## Feedback Loop

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/kwp-form-reports.repository.test.ts -t "uses the current live POMS factory name"` | FAIL | SQL เลือก `f.name as factory_name` ทั้ง scope `OWN_FACTORY` และ `ALL` |
| GREEN | คำสั่งเดียวกัน | PASS | SQL เลือก active `cp_name.factory_name` ล่าสุดด้วย `updated_at DESC, id DESC` ทั้งสอง scope |
| SMOKE | read-only repository invocation กับฐานข้อมูล local | PASS | `ALL` และ `OWN_FACTORY` คืนโรงงานอย่างละ 4 แถว และไม่พบชื่อชั่วคราวรูปแบบ `โรงงาน <เลขทะเบียน>` |

## Root Cause

`buildFactoryQuery` นับจุดตรวจวัดจาก
`cems_wpms_connected_measurement_points` แต่เลือกชื่อจาก `factories.name`
ซึ่งเป็นข้อมูล master/supporting และอาจเป็นชื่อชั่วคราว เช่น
`โรงงาน 10120000325542`

## Regression Coverage

- `OWN_FACTORY`: ครอบคลุมผู้ประกอบการและยังคงตัวกรองโรงงานที่ได้รับมอบหมาย
- `ALL`: ครอบคลุมเจ้าหน้าที่
- เมื่อโรงงานมีหลายจุดตรวจวัด เลือกชื่อแบบ deterministic จาก active row ล่าสุด
- fallback ตามลำดับ `eligible_factories.factory_name` และ `factories.name`
