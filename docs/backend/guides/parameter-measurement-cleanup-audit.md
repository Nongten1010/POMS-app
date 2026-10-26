# ตรวจคอลัมน์และ receipt ก่อนเปิดใช้การล้างเฉพาะพารามิเตอร์

[กลับคู่มือ backend](./README.md) · [สัญญาการล้างค่าระหว่างทดสอบ](../api/menus/connection-requests/measurement-cleanup.md) · [สัญญาอ่านข้อมูลทดสอบ](../api/menus/connection-requests/parameter-values.md#get-apiv1parameter-valuesconnection-test)

คู่มือนี้เป็นการตรวจแบบอ่านอย่างเดียวสำหรับฐานค่าที่อาจมีทั้งคอลัมน์แยกหน่วยและคอลัมน์ generic ก่อนเปิดใช้การจับคู่คอลัมน์รุ่นแก้ไข ไม่ใช่คำสั่งซ่อมข้อมูลหรืออนุมัติให้รัน SQL กับระบบจริง

มี [snapshot ผลตรวจ migration/receipt แบบอ่านอย่างเดียว](../evidence/connection-requests/measurement-cleanup.tdd.md#cleanup-receipt-audit-2026-10-26) สำหรับ connection/schema ที่กำหนดในรอบงานนี้ แยกจากขั้นตอนทั่วไปด้านล่าง

## เหตุที่ต้องตรวจ receipt เดิม

รูปแบบผสม เช่น `co2_ppm_*` พร้อม `co2_*` อาจทำให้ implementation เดิมล้างเพียงบางชุดคอลัมน์แล้วบันทึก receipt ว่าสำเร็จได้ Receipt จึงยืนยันว่ามีรอบการล้างถูกบันทึก แต่เพียงอย่างเดียวไม่พิสูจน์ว่าทุก family ที่ควรถูกล้างว่างครบแล้ว

รุ่นแก้ไขล้างทุก family ที่ยืนยันชื่อและหน่วยได้ ตรวจผลก่อนเขียน receipt และรักษา identity hash เดิมเพื่อไม่ให้คำขอเก่าถูกมองเป็นงานใหม่ การแก้ matcher ไม่ทำให้ receipt เก่าถูกล้างทิ้งหรือทำให้ข้อมูล `CONNECTED` ถูกล้างซ้ำ

**ห้ามลบ/แก้ receipt เดิมเพื่อบังคับ retry และห้ามย้อนล้างข้อมูลของคำขอที่ `CONNECTED` แล้วโดยอัตโนมัติ** เพราะข้อมูลที่เข้าหลังรอบล้างเดิมต้องถูกเก็บ แม้เวลาตรวจวัดจะเป็นข้อมูลย้อนหลัง

## สิ่งที่ต้องตรวจในแต่ละ family

| รูปแบบต้นทาง | ผลอ่านข้อมูลทดสอบ | ผลล้างเฉพาะพารามิเตอร์ |
| --- | --- | --- |
| `co2_ppm_*` และ `co2_percent_*` | แยก `CO2 (ppm)` และ `CO2 (%)`; ไม่คัดลอกค่า ppm ไปใต้ `%` | ล้างเฉพาะหน่วยที่ขอเพิ่ม |
| dedicated มี value หรือ status ในแถวนั้น | ใช้ value/status จาก dedicated คู่เดียวกัน แม้อีกฝั่งเป็น `null` | ล้าง dedicated ที่ตรงหน่วย และ generic ที่ยืนยันว่าตรงหน่วยด้วย |
| dedicated ไม่มีข้อมูลทั้ง value และ status | ใช้ generic ได้เมื่อหน่วยตรง | ตรวจทุก generic family ที่ตรงหน่วย; ไม่ใช่ fallback ที่ข้ามชุดอื่น |
| generic ไม่ระบุหน่วย | อ่านเพื่อ compatibility ได้เฉพาะเมื่อพารามิเตอร์ที่ลงทะเบียนมีหน่วยเดียวที่ระบุได้แน่นอนและไม่มี dedicated family ต่างหน่วยที่แข่งขันกัน | พารามิเตอร์ที่ต้องมีหน่วยยังต้องหยุดเมื่อแยกไม่ได้ ไม่ใช้ข้อยกเว้นของเส้นทางอ่านมาอนุมานการล้าง |
| `pm2_5_*` | จับคู่ `PM2.5` โดยรักษาชื่อคอลัมน์จริงที่มี underscore | ล้างเฉพาะ family และหน่วยของ PM2.5 ที่ยืนยันได้ |
| `pH` ที่เป็นไร้มิติชัดเจน และ `ph_units` ว่าง/`NULL` | อ่านคู่ `ph_value`/`ph_status` ได้ | ล้างเฉพาะ pH ได้; ไม่ขยายข้อยกเว้นให้พารามิเตอร์อื่นที่หน่วยหาย |

ชื่อแสดงผล canonical ของพารามิเตอร์ไร้มิตินี้คือ `pH`; label เดิม `pH (pH)` ยังรองรับโดยไม่เปลี่ยนชื่อที่ลงทะเบียนหรือเขียน hash ของ receipt เดิมใหม่

ตรวจขอบเขตชื่อกับหน่วยของ dedicated ด้วย: ปกติต้องมี `_` คั่นจริง รองรับ compact เฉพาะ `co2ppm`/`co2percent`/`co2pct`; `cod_*` ไม่ใช่ `CO (d)`. ตรวจ baseline ที่หน่วยว่างแม้อยู่ในวงเล็บ เช่น `CO2 (   )` และ identity เดิมต่างกันที่ใช้ชุดคอลัมน์เดียวกัน เช่น `CO2 (percent)` กับ `CO2 (%)` เพราะการล้างทั้ง family ต้องหยุดด้วย `503` ในกรณีที่กระทบ identity เดิม ส่วน generic ที่มีหน่วยยืนยันรายแถวได้ยังแบ่งแถวตามหน่วยได้ตามสัญญา

## อ่านข้อมูลที่ใช้ประกอบการตรวจ

ใช้ชื่อ schema จาก configuration จริง ตัวอย่างต่อไปนี้ใช้ `ingest`, คำขอสมมติ `101` และจุดสมมติ `S2001` โดยไม่เชื่อมฐานหลักกับฐานค่าข้าม server เอง

เริ่มในฐานค่าตาม `PARAMETER_DB_*` เพื่ออ่าน receipt ของคำขอที่ต้องตรวจ:

```sql
DECLARE @request_id bigint = 101;

SELECT source_key, request_id, station_id, parameter_key, parameter_label,
       actor_user_id, cleared_at, table_results_json
FROM [ingest].[parameter_measurement_cleanup_receipts]
WHERE request_id = @request_id
ORDER BY station_id, parameter_label;
```

ตรวจ metadata ของทั้งหก interval โดยใช้ชื่อจุดจาก receipt และอ่านชื่อ identifier ตามที่เก็บจริง:

```sql
DECLARE @station_id nvarchar(64) = N'S2001';

SELECT t.name AS table_name, c.column_id, c.name AS column_name,
       ty.name AS data_type, c.is_nullable
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.columns AS c ON c.object_id = t.object_id
JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
WHERE s.name = N'ingest'
  AND t.name IN (
    @station_id + N'_data_real', @station_id + N'_data_1m',
    @station_id + N'_data_5m', @station_id + N'_data_60m',
    @station_id + N'_data_1day', @station_id + N'_data_test'
  )
ORDER BY t.name, c.column_id;
```

จากนั้นอ่านเฉพาะคอลัมน์ที่ metadata ยืนยันว่ามีอยู่ของจุด/พารามิเตอร์นั้น เพื่อดู dedicated และ generic พร้อมกัน ตัวอย่างสำหรับตารางที่มีคอลัมน์เหล่านี้ครบ:

```sql
SELECT cdate, ctime,
       co2_ppm_value, co2_ppm_status, co2_ppm_units,
       co2_percent_value, co2_percent_status, co2_percent_units,
       co2_value, co2_status, co2_units
FROM [ingest].[S2001_data_real]
ORDER BY cdate DESC, ctime DESC;
```

ในฐานหลัก อ่านสถานะคำขอและชุดพารามิเตอร์ปัจจุบันแยกต่างหาก:

```sql
DECLARE @request_id bigint = 101;
DECLARE @station_id nvarchar(64) = N'S2001';

SELECT id, request_type, status, factory_id, system_type, verified_at
FROM cems_wpms_connection_requests
WHERE id = @request_id;

SELECT id, point_code, factory_id, system_type, parameters_json, deleted_at
FROM cems_wpms_connected_measurement_points
WHERE point_code = @station_id
ORDER BY id;
```

`cdate`/`ctime` ก่อน `cleared_at` ไม่ใช่หลักฐานว่าการล้างเดิมผิด เพราะอาจเป็นข้อมูลย้อนหลังที่ส่งเข้าหลังการล้าง ต้องอาศัยหลักฐานที่มาที่เชื่อถือได้ เช่น snapshot ก่อน/หลังรอบเดิมหรือบันทึกการเขียนของระบบต้นทาง โดยเก็บเฉพาะข้อมูลที่จำเป็นและปกปิด credential

## ตัดสินใจหลังตรวจ

- ไม่มี receipt และคำขอยังไม่ `CONNECTED`: ตรวจ schema/mapping ให้ผ่านชุดทดสอบก่อนใช้ final verification ตาม workflow ปกติ การตรวจในคู่มือนี้ไม่เปลี่ยนสถานะให้
- มี receipt แต่คำขอยังค้าง: การ retry เดิมต้องเคารพ receipt และรักษาข้อมูลใหม่ หากพิสูจน์ได้ว่ารอบเดิมล้างไม่ครบ ให้ทำข้อเสนอ recovery แยกที่ระบุ family/แถว/ที่มาของข้อมูลเป้าหมายอย่างแน่นอน ก่อนขออนุมัติการแก้ข้อมูล
- คำขอ `CONNECTED` แล้ว: บันทึกผลตรวจและผลกระทบ ห้ามเปิด workflow ใหม่ ลบ receipt หรือสั่งล้างซ้ำอัตโนมัติ การซ่อมเฉพาะข้อมูลที่พิสูจน์ได้เป็นงานแยกที่ต้องได้รับอนุมัติ
- แยกข้อมูลก่อน/หลังรอบเดิมไม่ได้: รักษาข้อมูลและ receipt ไว้ ระบุข้อจำกัดในการตรวจรับ และยังไม่อ้างว่าซ่อมข้อมูลเดิมครบแล้ว

ก่อนพิจารณา release ให้บันทึกว่าตรวจจุดใด/ช่วงใด พบ dedicated/generic แบบใด มี receipt ที่ต้องตัดสินใจ recovery หรือไม่ และหลักฐานชุดทดสอบ SQL Server จริงครอบคลุมขอบเขตใด การเพิ่ม matcher ใหม่อย่างเดียวไม่ยืนยันข้อมูลประวัติหรือการหยุดเขียนของ Worker
