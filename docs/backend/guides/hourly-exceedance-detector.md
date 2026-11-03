# ตัวตรวจค่าเกิน อก./EIA ภายในสำหรับ CEMS/WPMS

[กลับไปคู่มือ Backend](./README.md) · [แผนออกแบบ](./hourly-exceedance-detector-plan.md) · [API การแจ้งเตือน](../api/menus/notifications/README.md) · [ระบบอีเมลเดิม](./alert-email-operations.md)

มี worker สำหรับอ่านข้อมูล `60m` และสร้าง `STANDARD_EXCEEDED`/`EIA_EXCEEDED` เอง ครบทั้ง CEMS/WPMS โดยทำงานเป็น process แยกจาก HTTP API และ email worker เมื่อเปิด mode แล้ว HTTP service เดิมจะดูแล child process ให้เริ่มใหม่และหยุดผ่าน IPC ไม่เพิ่ม service account หรือ pool ของ API ค่าเริ่มต้น `off` การ deploy code เพียงอย่างเดียวไม่เปิดตัวตรวจหรือส่งอีเมลให้เอง

ยังไม่ได้ apply migration, ทดลองกับ SQL Server จริง หรือเปิดใช้งาน production ผลทดสอบในเครื่องไม่แทนหลักฐาน performance, index และ lock บน production

## รูปแบบการทำงาน

| Mode | อ่านข้อมูลต้นทาง | ผลที่บันทึก | สร้าง event / อีเมล |
| --- | --- | --- | --- |
| `off` | ไม่อ่านและไม่เปิด connection ของ detector | ไม่มี | ไม่สร้าง |
| `shadow` | อ่านเฉพาะ allowlist และช่วงถึงกำหนด | สถานะงาน, counts และตัวอย่าง candidate ไม่เกิน 10 รายการต่อจุด/ชั่วโมง | ไม่เขียน `alert_events` หรือ outbox |
| `active` | เหมือน shadow โดยต้องยืนยัน policy ก่อน | สถานะงานและหลักฐาน producer ใน event | สร้าง event; email worker เดิมเป็นผู้เลือกผู้รับและส่งตาม policy |

ตัวตรวจตื่นทุกนาทีเพื่อเลือกงานถึงกำหนด แต่ไม่อ่านค่าของชั่วโมงที่ทำเสร็จทุกนาที หนึ่ง tick จำกัดหนึ่ง batch ไม่เกิน 50 จุด และอ่านแบบลำดับทีละจุด: ชั่วโมงใหม่หนึ่งช่วงก่อนงาน retry หนึ่งช่วงต่อจุด

ใช้ connection pool แยกสำหรับ POMS และ parameter source อย่างละไม่เกิน 1 connection พร้อม native query timeout และ pool guard เดิม มี lease กลางในฐานข้อมูลกันหลาย process ทำงานพร้อมกัน การแยก process ยังใช้ทรัพยากร SQL Server ร่วมกับ API จึงต้องวัดผลก่อนขยาย allowlist

## ข้อมูลที่ตัวตรวจยอมรับ

- จุด active ที่เชื่อมต่อแล้วใน `cems_wpms_connected_measurement_points`, มี canonical `point_code`, อยู่ใน allowlist และไม่มี origin ที่ถูกลบหรือ `CANCELED`
- พารามิเตอร์เป็นจุดตัดระหว่างเครื่องมือของ live point, active device channels ของ config ปัจจุบัน (`request_id IS NULL`) และ active parameter activation ที่ยืนยันแล้ว ไม่ใช้ request config ที่ยังไม่เชื่อมต่อ
- เกณฑ์มาจาก `standardCriteria.standardValue` และ `eiaCriteria.standardValue` ของเครื่องมือ มีค่าตัวเลข finite และหน่วยที่จับคู่ตรงกัน ไม่มีการเดาเกณฑ์หรือแปลงหน่วย
- ข้ามเกณฑ์ที่ตั้ง `enabled: false` แม้ยังมีค่าเดิมค้างอยู่; ถ้าปิดทั้งสองเกณฑ์จะไม่อ่านค่าของพารามิเตอร์นั้นและไม่รายงานว่าเกณฑ์ขาด
- ตรวจเฉพาะค่าที่สถานะตรงกับ `Normal` ตาม status mapping เดิม รวม numeric code `1`; สถานะอื่นไม่สร้างค่าเกิน
- แหล่งข้อมูลคือ `<point_code>_data_60m` ใน parameter-source schema ที่ตั้งไว้ อ่าน metadata ของคอลัมน์และเลือกเฉพาะเวลา ค่า หน่วย และสถานะของพารามิเตอร์ที่ใช้ ไม่มีการโหลด device credential, `SELECT *`, `NOLOCK` หรือ scan raw history ทั้งหมด
- `cdate`/`ctime` ต้องระบุชั่วโมงเต็มจริง เช่น `10:00`, `10:00:00` หรือเศษวินาทีศูนย์เท่านั้น แถวแบบ `10:32:00` ไม่อยู่ในรูปแบบที่รองรับ รุ่นนี้ยังไม่รองรับการเดาว่าข้อมูลเลื่อนนาทีหมายถึงชั่วโมงใด
- `HOUR_LABEL=START` หมายถึง timestamp ต้นชั่วโมง; `END` หมายถึง timestamp ปลายชั่วโมงเต็มถัดไป เช่น ข้อมูล label `00:00` ของวันที่ 4 เป็นชั่วโมง 23:00 ของวันที่ 3 ต้องยืนยันกับต้นทางก่อนเลือก
- ต้องมี `measuredValue > thresholdValue` โดยไม่ปัดก่อนเปรียบเทียบ เกณฑ์ `0` ใช้ได้; เกณฑ์ช่วงหรือข้อความที่ไม่ใช่ตัวเลขเดี่ยวยังไม่รองรับ
- หากความละเอียด `DECIMAL(18,6)` ของ `alert_events` ทำให้ค่าเกินกลายเป็นเท่ากันหลังบันทึก จะพักด้วย `DECIMAL_PRECISION` เพื่อให้ตรวจนโยบาย precision ไม่สร้าง event ที่คิวอีเมลจะปฏิเสธ

ชื่อพารามิเตอร์ใน event มีหน่วย เช่น `CO (ppm)` และ `CO (%)` และใช้ schema/identity ชุดเดียวกับ [API integration](../api/integrations/alert-events/README.md)

## การเริ่มติดตามและ config history

เริ่มจากชั่วโมงเต็มแรกที่ไม่น้อยกว่าเวลาสังเกต config ครั้งแรก, `cutover` และเวลาเชื่อมต่อจริง เช่น process เห็น config เวลา 11:15 จะเริ่มติดตามชั่วโมง 12:00 หลังชั่วโมงนั้นจบและพ้น delay ไม่มีการนำเกณฑ์ปัจจุบันไปสร้าง alert ย้อนอดีตโดยอัตโนมัติ

เมื่อเกณฑ์ หน่วย การตั้งค่าอุปกรณ์หรือ activation ที่เกี่ยวข้องเปลี่ยน จะเริ่มช่วง config ใหม่จากเวลาสังเกตครั้งแรกของรุ่นนั้น การเปลี่ยนชื่อโรงงานอย่างเดียวไม่เริ่ม config ใหม่ และจะตรวจ fingerprint ซ้ำใน transaction ก่อนบันทึกเพื่อไม่ใช้ config ที่เปลี่ยนระหว่างอ่านต้นทาง

ชั่วโมงเก่าที่ไม่มีหลักฐาน config ตรงกันจะเป็น `REVIEW_REQUIRED` แทนการใช้เกณฑ์ใหม่ย้อนหลัง Shadow และ active มี state แยกกัน การรัน shadow ไม่เลื่อน checkpoint ของ active ดังนั้นเมื่อเปลี่ยนเป็น active จะเริ่มสังเกต config ของ active ใหม่ ไม่สร้าง event ตาม shadow history ให้เอง

## การตั้งค่า

ค่าตั้งต้นต่อไปนี้เป็นตัวอย่างทดลอง ไม่ใช่ค่าที่เปิดแล้วบน production และไม่มี credential จริง:

```dotenv
ALERT_EXCEEDANCE_MODE=shadow
ALERT_EXCEEDANCE_STATIONS=S0001,P0001
ALERT_EXCEEDANCE_CUTOVER=2026-11-03T00:00:00+07:00
ALERT_EXCEEDANCE_HOUR_LABEL=START
ALERT_EXCEEDANCE_DELAY_MINUTES=10
ALERT_EXCEEDANCE_BATCH_SIZE=50
ALERT_EXCEEDANCE_BUDGET_MS=300000
ALERT_EXCEEDANCE_QUERY_TIMEOUT_MS=5000
ALERT_EXCEEDANCE_LATE_HOURS=24
ALERT_EXCEEDANCE_RECHECK_HOURS=3
```

| Setting | กฎ |
| --- | --- |
| `ALERT_EXCEEDANCE_MODE` | `off` โดยปริยาย; รับ `shadow`/`active` |
| `ALERT_EXCEEDANCE_STATIONS` | required เมื่อเปิด; canonical codes คั่น comma, ไม่รับ `*`, ไม่เกิน 500 รหัส และรหัสละไม่เกิน 64 ตัวอักษร |
| `ALERT_EXCEEDANCE_CUTOVER` | required เมื่อเปิด; ISO timestamp ที่มี offset; ไม่ใช่คำสั่ง backfill |
| `ALERT_EXCEEDANCE_HOUR_LABEL` | required เมื่อเปิด; `START` หรือ `END` ตามรูปแบบข้อมูลที่ยืนยันแล้ว |
| `ALERT_EXCEEDANCE_DELAY_MINUTES` | 0–59; default 10 นาทีก่อนถือว่าชั่วโมงใหม่ถึงกำหนด |
| `ALERT_EXCEEDANCE_BATCH_SIZE` | 1–50; default 50 จุดต่อ tick ไม่ใช่จำนวน query พร้อมกัน |
| `ALERT_EXCEEDANCE_BUDGET_MS` | 1,000–300,000; default 300,000; หยุดเริ่มงานใหม่เมื่อหมดงบ งาน SQL ที่กำลังทำอยู่ยังต้องจบ/timeout จึงไม่ใช่ hard deadline ของ process |
| `ALERT_EXCEEDANCE_QUERY_TIMEOUT_MS` | 1,000–15,000; default 5,000; ใช้ native request/connect timeout และ connection acquisition timeout |
| `ALERT_EXCEEDANCE_LATE_HOURS` | 1–24; default 24 ชั่วโมงที่อนุญาตให้ตรวจข้อมูลช้าอัตโนมัติ |
| `ALERT_EXCEEDANCE_RECHECK_HOURS` | 1–6; default 3; ตรวจชั่วโมงที่เสร็จแล้วซ้ำไม่ถี่กว่ารายชั่วโมงภายในช่วงนี้ โดยไม่ขยายขอบเขต `LATE_HOURS` |

ก่อนเลือก `active` ต้องกำหนดสามค่าต่อไปนี้เป็น `true` หลังทบทวนข้อมูลจริงครบเท่านั้น:

- `ALERT_EXCEEDANCE_NORMAL_ONLY_CONFIRMED`: ยืนยันว่าใช้เฉพาะ `Normal` สำหรับค่าเกิน
- `ALERT_EXCEEDANCE_DATA_BASIS_CONFIRMED`: ยืนยันว่าค่า `60m` และเกณฑ์ใช้หน่วย/standard condition/dry basis/oxygen หรือ excess air ตรงกัน ไม่มีการปรับซ้ำ
- `ALERT_EXCEEDANCE_STATION_IDS_CONFIRMED`: ยืนยัน canonical station ID กับ producer API เดิม เพื่อให้ key กันซ้ำตรงกัน รุ่นนี้ไม่เดาหรือ migrate legacy aliases

ใช้ connection settings POMS และ `PARAMETER_DB_*` เดิม โดยไม่เปลี่ยน pool ของ API และไม่มีการเปลี่ยน `ALERT_EMAIL_ENABLED` ค่าตั้ง detector โหลดครั้งเดียวตอนเริ่ม process ต้อง restart detector เมื่อเปลี่ยน policy

## ขั้นทดลองและเปิดใช้

1. ตรวจ source schema/index, timestamp และค่า/หน่วย/สถานะตัวอย่างจริง รวม baseline API/SQL ก่อน ยังไม่เพิ่ม index บนตารางต้นทางอัตโนมัติ
2. ตรวจ pending migrations ทั้งหมดก่อนอนุมัติ deployment; migration ใหม่ [`0155_create_alert_exceedance_state.ts`](../../../backend/src/db/migrations/0155_create_alert_exceedance_state.ts) ต่อจาก production migration 0154 เพิ่มเฉพาะ worker tables ไม่ backfill, ไม่แก้ `alert_events` และไม่สร้าง index บน `60m` การ apply production เป็นขั้นแยกที่ต้องได้รับอนุมัติ
3. โดยทั่วไปเริ่มด้วย `shadow` และ allowlist ขนาดเล็ก. หากเจ้าของระบบอนุมัติ Active โดยตรง ให้บันทึกผล preflight และตั้ง `active` หลังตรวจ policy ทั้งสามข้อ โดยยังใช้ config observation boundary และไม่สร้างย้อนหลัง. สำหรับการรันเดี่ยวในสภาพแวดล้อมที่อนุมัติ:

   ```bash
   cd backend
   npm run dev:alert-exceedances
   ```

   สำหรับไฟล์ที่ build แล้ว ใช้ `npm run start:alert-exceedances` หากต้องรันเดี่ยวเพื่อวินิจฉัย บน production ปกติให้ตั้ง mode ใน environment และ restart HTTP service หลัง apply migration แล้ว supervisor จะเริ่ม child process เอง โดยใช้ lease กลางร่วมกันทุกวิธีรัน Log ของ process ลูกแยกใต้ `backend/logs/alert-exceedance-worker/logs/`

4. รอ config epoch และชั่วโมงแรกจบ ตรวจผลจาก log `[alert-exceedance] RUN` และตารางด้านล่าง เทียบ candidate กับข้อมูลและเกณฑ์จริง ไม่ใช้การไม่มี event จาก integration เป็นผลเฉลย
5. วัด elapsed time, source query plan/logical reads, SQL CPU/IO/blocking, API p95/error rate และงานค้าง ภายในงบและเกณฑ์หยุดที่ตกลงตาม [แผน](./hourly-exceedance-detector-plan.md#งบทรัพยากรและเป้าหมายทดลอง)
6. เปิด `active` เฉพาะ allowlist ที่ผ่าน review หลังยืนยัน policy ทั้งสามข้อ โดยยังคง API ภายนอกไว้ ติดตาม native unique-key race/lease takeover และ query cancellation บน SQL Server; ผล fixture ไม่ใช่หลักฐานของ native concurrency
7. ขยาย allowlist ตามผลวัด ชุดแรกยังไม่มี benchmark ยืนยันว่าครบ 500 จุดจะเสร็จทันทุกชั่วโมง

## สถานะงานและการติดตาม

| ตาราง | หน้าที่ |
| --- | --- |
| `alert_exceedance_lease` | owner, fence และ lease expiry ใช้เวลา UTC จาก SQL Server; หนึ่ง lease ร่วมกันทุก instance และทุก mode จำกัดงานรวม |
| `alert_exceedance_points` | config fingerprint, `valid_from` และ `next_hour` แยก mode/ระบบ/จุด; `next_hour` คือช่วงถัดไปที่จะสำรวจ ไม่ใช่การประกาศว่าชั่วโมงก่อนหน้าทั้งหมดครบ |
| `alert_exceedance_hours` | receipt ต่อ mode/ระบบ/จุด/ชั่วโมง พร้อมผล, จำนวนครั้ง, next retry และ summary ที่ไม่มี credential |

สถานะ receipt คือ `COMPLETE`, `PENDING` และ `REVIEW_REQUIRED` อ่านข้อมูลไม่ได้/ขาด/ตัวเลขใช้ไม่ได้/เกณฑ์ไม่พร้อมต้องมีเหตุผลใน `summary_json` ไม่ถูกตีความเป็นค่าปกติ ชั่วโมงที่เกิน `LATE_HOURS` หรือมี config history ไม่พอหยุด retry อัตโนมัติและรอทบทวน

งานใหม่ให้สิทธิ์ก่อน retry, retry ใช้ exponential backoff สูงสุดหนึ่งชั่วโมง และกันรอบซ้อนด้วย lease/fence การสร้าง event และ receipt/checkpoint อยู่ใน transaction เดียว หาก transaction ล้มเหลวให้ replay อย่างปลอดภัย พร้อม retry transaction อีกหนึ่งครั้งเฉพาะ SQL unique-key/deadlock ที่รู้จัก

จำกัดงานยังไม่สมบูรณ์ 48 ชั่วโมงต่อ mode/ระบบ/จุด เมื่อเต็มจะพักการสร้างงานชั่วโมงใหม่ของจุดนั้น แต่ยังให้ retry ที่ถึงกำหนดทำงานและรายงาน `backlogFull` ต้องทบทวนสาเหตุก่อนเพิ่มงานต่อ ไม่ทิ้ง pending history โดยเงียบ

เมื่อข้อมูลของชั่วโมงที่ยืนยันแล้วถูกแก้ หรือมี event จากอีก producer ที่ค่า/เกณฑ์ต่างกัน ให้บันทึก `SOURCE_REVISED`/`PRODUCER_DISCREPANCY` และพักเป็น `REVIEW_REQUIRED` ไม่แก้ event เก่าหรือส่งฉบับแก้อัตโนมัติ เก็บ event IDs เดิมไว้ใน receipt สำหรับตามหลักฐาน

ผล `COMPLETE` เก็บอย่างน้อย 7 วันสำหรับ shadow และ 30 วันสำหรับ active ล้างครั้งละไม่เกิน 100 receipts; งานที่ยังไม่สมบูรณ์ไม่ถูกลบด้วยรอบนี้ ไม่มีการลบ event หรือข้อมูลตรวจวัด

SQL ต่อไปนี้เป็น read-only บนฐาน POMS ที่ detector ใช้:

```sql
SELECT TOP (50)
    mode, system_type, station_id, hour_at,
    status, attempts, next_retry_at, checked_at, summary_json
FROM dbo.alert_exceedance_hours
ORDER BY checked_at DESC;

SELECT mode, system_type, status, COUNT(*) AS total,
       MIN(hour_at) AS oldest_hour
FROM dbo.alert_exceedance_hours
GROUP BY mode, system_type, status;
```

`hour_at` และเวลาของ state/lease เป็น UTC; รูปแบบวัน/ชั่วโมงใน event payload เป็นเวลาไทยตาม contract เดิม Log แสดง counts และรหัสปัญหา ไม่ log connection strings, API key, device credentials หรือ raw database error

## หยุดและย้อนกลับ

หยุดเฉพาะ process detector หรือเปลี่ยน mode เป็น `off` แล้ว restart detector ไม่ต้องหยุด API หรือ email worker; รักษา state ไว้สำหรับ resume การหยุดไม่ยกเลิก event หรืออีเมลที่เข้าคิว/ส่งไปแล้ว หากต้องพัก delivery ให้ตรวจ provenance และผู้รับจริงผ่านสิทธิ์เดิม ไม่ลบทั้งคิวหรือแก้ event ของ producer อื่น

การ rollback migration บน production ไม่ใช่วิธีปิด worker ให้ปิด process ก่อนและใช้ forward migration สำหรับเปลี่ยน schema ตามงานที่อนุมัติ ส่วน `down` ของ migration นี้ใช้เฉพาะการทดสอบหรือสภาพแวดล้อมที่อนุมัติให้ลบ worker state แล้ว

## ขอบเขตที่ยังต้องทำก่อน production

- ยืนยันข้อมูลจริงและสาม policy flags; ทดสอบกับ SQL Server สำหรับ lease/transaction isolation, native unique race และ cancellation ไม่มีผล SQL Server จริงในรอบพัฒนานี้
- ตรวจ index และขีดจำกัด throughput ตาม allowlist/โหลดจริง ไม่สร้าง View ใหญ่หรือย้ายโครงสร้างแหล่งข้อมูลเพื่อหวังความเร็วโดยไม่วัด
- ยังไม่มี automatic backfill เกิน 24 ชั่วโมง, config history ย้อนหลัง, source timestamps ที่ไม่ใช่ชั่วโมงเต็ม, การแก้ legacy station aliases หรืออีเมลแก้ไขย้อนหลัง
- ระบบอีเมลเดิมเลือก hourly events ในขอบเขตย้อนหลังประมาณหนึ่งวัน งานที่เก่ากว่านั้นต้องกำหนดนโยบาย catch-up แยก ห้ามเปลี่ยน event date เป็นปัจจุบันเพื่อบังคับส่ง

Source: [policy](../../../backend/src/modules/alert-exceedances/exceedance-policy.ts), [detector](../../../backend/src/modules/alert-exceedances/exceedance-detector.ts), [metadata](../../../backend/src/modules/alert-exceedances/exceedance-metadata.ts), [repository](../../../backend/src/modules/alert-exceedances/exceedance-repository.ts), [worker](../../../backend/src/modules/alert-exceedances/exceedance-worker.ts), [runtime](../../../backend/src/modules/alert-exceedances/exceedance-runtime.ts), [entry point](../../../backend/src/alert-exceedance-worker.ts)
