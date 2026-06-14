# คู่มือฐานข้อมูลการแจ้งเตือน POMS

ของระบบ POMS กรมโรงงานอุตสาหกรรม

Service Name : AlertNotificationDatabase

## 1. ภาพรวม

ฐานข้อมูลการแจ้งเตือนใช้ตารางหลัก 3 ตาราง เพื่อเก็บเหตุการณ์แจ้งเตือน ประวัติการส่งแจ้งเตือน และข้อมูลสรุปรายวันจาก 60m

### 1.1 ตารางหลัก

| No. | Table | Description |
| --- | --- | --- |
| 1 | `alert_events` | ตารางกลางสำหรับเก็บเหตุการณ์แจ้งเตือนทุกประเภท |
| 2 | `alert_notifications` | ตารางบันทึกประวัติการส่งแจ้งเตือนของแต่ละ event |
| 3 | `measurement_daily_summaries` | ตารางสรุปข้อมูลรายวันจาก 60m สำหรับคำนวณ 80%, ไม่รายงานต่อเนื่อง และค่าผิดปกติ |

## 2. ตาราง `alert_events`

ตารางกลางสำหรับเก็บเหตุการณ์แจ้งเตือนทุกประเภท ใช้เป็นแหล่งข้อมูลหลักของหน้ารายงานและ API `GET /api/v1/alert-events`

| No. | Field | Description |
| --- | --- | --- |
| 1 | `id` | Primary key |
| 2 | `alert_type` | ประเภทแจ้งเตือน เช่น `STANDARD_EXCEEDED`, `EIA_EXCEEDED`, `DAILY_COMPLETENESS_LOW`, `CONSECUTIVE_NO_REPORT`, `ABNORMAL_VALUE` |
| 3 | `system_type` | ระบบต้นทาง เช่น `CEMS`, `WPMS` |
| 4 | `display_system_type` | ประเภทที่ใช้แสดงผล เช่น `CEMS`, `BOD_COD_ONLINE` |
| 5 | `factory_id` | รหัสโรงงาน |
| 6 | `factory_name` | ชื่อโรงงาน |
| 7 | `factory_registration_no` | เลขทะเบียนโรงงาน |
| 8 | `connected_measurement_point_id` | id จุดตรวจวัดที่เชื่อมต่อแล้ว |
| 9 | `station_id` | รหัสสถานีหรือรหัสจุดตรวจวัด |
| 10 | `point_code` | รหัสจุดตรวจวัด |
| 11 | `point_name` | ชื่อจุดตรวจวัด |
| 12 | `point_type` | ประเภทจุดตรวจวัด เช่น `STACK`, `WASTEWATER` |
| 13 | `parameter_code` | รหัสพารามิเตอร์ |
| 14 | `parameter_name` | ชื่อพารามิเตอร์ |
| 15 | `parameter_label` | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `SO2 (ppm)` |
| 16 | `unit` | หน่วย |
| 17 | `event_date` | วันที่ของเหตุการณ์ |
| 18 | `started_at` | เวลาเริ่มต้นเหตุการณ์ |
| 19 | `ended_at` | เวลาสิ้นสุดเหตุการณ์ |
| 20 | `measured_value` | ค่าที่ตรวจวัดได้ |
| 21 | `threshold_value` | ค่าเกณฑ์มาตรฐานหรือค่า EIA |
| 22 | `threshold_type` | `STANDARD` หรือ `EIA` |
| 23 | `completeness_percent` | เปอร์เซ็นต์ความครบถ้วนของรายงาน |
| 24 | `consecutive_days` | จำนวนวันที่ไม่รายงานต่อเนื่อง |
| 25 | `abnormal_type` | ประเภทค่าผิดปกติ เช่น `CONSTANT`, `ZERO`, `NEGATIVE` |
| 26 | `abnormal_streak_count` | จำนวนครั้งที่ผิดปกติติดต่อกัน |
| 27 | `first_abnormal_at` | เวลาแรกของชุดค่าผิดปกติ |
| 28 | `confirmed_abnormal_at` | เวลาที่ครบเงื่อนไขแจ้งเตือน |
| 29 | `source_payload_json` | payload หรือข้อมูลต้นทาง |
| 30 | `notification_status` | สถานะการแจ้งเตือน เช่น `AUTO`, `OFFICER`, `ACKNOWLEDGED`, `DISMISSED` |
| 31 | `idempotency_key` | key สำหรับกันข้อมูลซ้ำ |
| 32 | `detected_at` | เวลาที่ระบบตรวจพบหรือรับ event |

## 3. ตาราง `alert_notifications`

ตารางบันทึกประวัติการส่งแจ้งเตือนของแต่ละ event

| No. | Field | Description |
| --- | --- | --- |
| 1 | `id` | Primary key |
| 2 | `alert_event_id` | อ้างอิง `alert_events.id` |
| 3 | `channel` | ช่องทางส่งแจ้งเตือน |
| 4 | `recipient` | ผู้รับ |
| 5 | `send_status` | สถานะการส่ง |
| 6 | `error_message` | ข้อความ error ถ้าส่งไม่สำเร็จ |
| 7 | `sent_at` | เวลาส่งสำเร็จ |
| 8 | `created_at` | เวลาสร้างข้อมูล |

## 4. ตาราง `measurement_daily_summaries`

ตารางสรุปข้อมูลรายวันจาก 60m ใช้สำหรับคำนวณรายงานไม่ถึง 80%, ไม่รายงานต่อเนื่อง และค่าผิดปกติ

| No. | Field | Description |
| --- | --- | --- |
| 1 | `id` | Primary key |
| 2 | `system_type` | `CEMS` หรือ `WPMS` |
| 3 | `factory_id` | รหัสโรงงาน |
| 4 | `station_id` | รหัสจุดตรวจวัด |
| 5 | `parameter_code` | รหัสพารามิเตอร์ |
| 6 | `parameter_label` | ชื่อพารามิเตอร์พร้อมหน่วย |
| 7 | `unit` | หน่วย |
| 8 | `summary_date` | วันที่สรุป |
| 9 | `expected_count` | จำนวนข้อมูลที่คาดว่าควรมี |
| 10 | `received_count` | จำนวนข้อมูลที่ได้รับ |
| 11 | `normal_status_count` | จำนวนข้อมูลที่ status เป็น Normal |
| 12 | `shutdown_status_count` | จำนวนข้อมูลที่ status เป็น Shut Down |
| 13 | `completeness_percent` | เปอร์เซ็นต์ความครบถ้วน |
| 14 | `null_count` | จำนวนค่าว่าง |
| 15 | `zero_count` | จำนวนค่า 0 |
| 16 | `negative_count` | จำนวนค่าติดลบ |
| 17 | `same_value_max_streak` | จำนวนค่านิ่งต่อเนื่องสูงสุด |
| 18 | `first_received_at` | เวลาที่ได้รับข้อมูลแรกของวัน |
| 19 | `last_received_at` | เวลาที่ได้รับข้อมูลล่าสุดของวัน |
| 20 | `source_table` | ตาราง raw 60m ต้นทาง |

## 5. Index และ Constraint

| No. | Name | Description |
| --- | --- | --- |
| 1 | `uq_alert_events_idempotency` | กันข้อมูล alert ซ้ำด้วย `idempotency_key` |
| 2 | `ix_alert_events_date_type` | ใช้ค้นหาตามวันที่, ประเภท alert และระบบ |
| 3 | `ix_alert_events_factory_date` | ใช้ค้นหาตามโรงงานและวันที่ |
| 4 | `ix_alert_events_station_param_date` | ใช้ค้นหาตามจุดตรวจวัด, พารามิเตอร์ และวันที่ |
| 5 | `ix_alert_notifications_event` | ใช้ค้นหาประวัติการส่งแจ้งเตือนของ event |
| 6 | `uq_daily_summary_station_param_date` | กัน summary ซ้ำต่อจุดตรวจวัด/พารามิเตอร์/วัน |

## 6. หมายเหตุการใช้งาน

- `alert_events` เป็นตารางกลาง ไม่ต้องแยกตารางตาม CEMS หรือ BOD/COD Online
- BOD/COD Online ใช้ `system_type = WPMS` และ `display_system_type = BOD_COD_ONLINE`
- การแจ้งเตือนเกินมาตรฐานและเกินค่า EIA มาจาก External API
- การแจ้งเตือน 80%, ไม่รายงานต่อเนื่อง และค่าผิดปกติ คำนวณจากข้อมูล 60m/summary
- `idempotency_key` ใช้กันการสร้างข้อมูลแจ้งเตือนซ้ำ
