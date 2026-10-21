# ล้างค่าทดสอบเมื่อจุดใหม่เชื่อมต่อสำเร็จ

[กลับเมนูขอเชื่อมต่อ](./README.md)

## เริ่มใช้งานสำหรับ frontend

Backend ล้างค่าทดสอบก่อนยืนยันจุดตรวจวัดใหม่เป็น `CONNECTED` อัตโนมัติ ผู้เรียกไม่ต้องส่ง field เพิ่ม และ response สำเร็จใช้ contract เดิมของแต่ละ endpoint ข้อมูลทดสอบที่เห็นก่อนยืนยันจะหายไป หลังจากนั้นจึงแสดงข้อมูลที่เข้ามาใหม่ ตารางอาจว่างชั่วคราวได้

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/101/verify-connection' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

สิทธิ์และ data scope คงเดิม ดู request/response fields ใน [เมนูขอเชื่อมต่อ](./README.md#connected-factory-profile-sync) และ [payload/validation](./request-payloads-and-validation.md) ตัวอย่างส่วนที่ใช้ตัดสินผลสำเร็จ:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "status": "CONNECTED",
    "measurementPoints": [{ "id": 201, "pointCode": "S2001" }]
  }
}
```

## ขอบเขตและจังหวะการล้าง

- ใช้กับจุดใหม่ของ `NEW_CONNECTION` และ `ADD_MEASUREMENT_POINT` ที่จะเชื่อมต่อสำเร็จหลังเปิดใช้ feature; ไม่ทำงานย้อนหลังกับจุดที่เชื่อมต่ออยู่แล้ว
- ล้างเฉพาะตารางของ `pointCode` ในคำขอนั้น ไม่ล้างจุดอื่นแม้อยู่โรงงานเดียวกัน ไม่ล้าง `ADD_PARAMETER` และไม่ล้างรหัสที่เคยมีแถวใน `cems_wpms_connected_measurement_points` รวมแถวที่เลิกใช้งานแล้ว ตรวจชื่อจุดที่ใช้แทนรหัสในข้อมูล legacy ที่ `point_code` ว่างด้วย
- ตารางเป้าหมายคือ `<pointCode>_data_real`, `<pointCode>_data_1m`, `<pointCode>_data_5m`, `<pointCode>_data_60m`, `<pointCode>_data_1day`, `<pointCode>_data_test` ภายใต้ `PARAMETER_DB_SCHEMA` ลบเฉพาะแถว คงโครงสร้างตารางไว้
- ครอบคลุม `POST /cems-wpms-requests/{id}/verify-connection`, direct `CONNECT` ผ่าน `/cems-wpms-requests/direct-connections` และ `/cems-wpms-requests/measurement-points`, รวมการอนุมัติจุดยกเว้นทั้งหมดผ่าน `/{id}/review` หรือ `/{id}/status` ที่เข้าสู่ `CONNECTED` ทันที การสร้างคำขอรอพิจารณา/รอแก้ไขและการบันทึกอุปกรณ์ยังไม่ล้าง
- จับ exclusive lock ของตารางที่มีอยู่ทุกตารางและทุกจุดที่จะล้างก่อนลบแถวแรก ช่วงที่จับล็อกครบคือจังหวะตัดข้อมูล แถวที่มีอยู่ขณะนั้นถูกล้าง การเขียนพร้อมกันต้องรอ commit และแถวที่เขียนภายหลังจะคงอยู่ รวมค่าที่มีเวลาตรวจวัดย้อนหลัง
- ไม่ใช้ `verifiedAt`, `cdate`/`ctime` หรือ `udate`/`utime` เป็นเกณฑ์แบ่งแถวก่อน/หลัง จึงไม่ขึ้นกับนาฬิกาของเครื่องหรือการระบุวันยืนยันย้อนหลัง
- ตารางที่ไม่มีให้ข้ามและบันทึก `skippedMissing: true` หากภายหลังสร้างตารางหรือเติมข้อมูล ไม่ย้อนล้างตารางนั้นอีก
- หากตารางใดล้างไม่ได้ ให้ rollback การล้างทุกจุดในรอบเดียวกันและยังไม่ commit `CONNECTED` การอ่าน metadata ไม่ได้เป็นข้อผิดพลาด ไม่ถือว่าตารางไม่มี

## ข้อผิดพลาดและการลองใหม่

ใช้ [error envelope กลาง](../../shared/common-api/README.md) สำหรับ endpoint ข้างต้น เพิ่มกรณี `503`:

| Field | Type | ความหมาย |
| --- | --- | --- |
| `success` | boolean | `false` |
| `error.code` | string | `MEASUREMENT_CLEANUP_FAILED` |
| `error.message` | string | `Unable to clear test measurements; connection was not completed` |
| `error.details.retryable` | boolean | `true`; ตรวจสถานะล่าสุดก่อนลองใหม่ |

```json
{
  "success": false,
  "error": {
    "code": "MEASUREMENT_CLEANUP_FAILED",
    "message": "Unable to clear test measurements; connection was not completed",
    "details": { "retryable": true }
  }
}
```

เมื่อได้ `503` ให้คงขั้นตอนเดิมและเปิดให้ลองใหม่หลังแก้ปัญหาฐานค่า สำหรับ direct `CONNECT` ที่ล้มเหลว การสร้างคำขอ/จุดในฐานหลักจะ rollback ก่อนส่ง error หาก timeout หรือผลเครือข่ายไม่ชัดเจนให้โหลดสถานะล่าสุดก่อนเสมอ คำขอที่สำเร็จแล้วใช้ข้อจำกัด transition เดิมและไม่ล้างซ้ำ

ฐานค่าตรวจวัดกับฐานคำขออาจอยู่คนละ server จึงมี transaction แยกกัน หากการล้าง commit แล้วแต่บันทึกสถานะในฐานหลักล้มเหลว ค่าทดสอบอาจถูกล้างแล้วโดยสถานะยังไม่สำเร็จ Backend เก็บ receipt ใน transaction เดียวกับการล้างที่ฐานค่า การลองใหม่จึงข้ามรหัสที่มี receipt และรักษาข้อมูลที่เข้ามาหลังการล้าง แม้ direct request รอบใหม่ได้ `id` ต่างจากรอบที่ rollback

## ข้อมูลสำหรับ backend และผู้ดูแล

Migration `0143_create_connection_measurement_cleanup_receipts` สร้างตาราง `connection_measurement_cleanup_receipts` ในฐานค่าตาม `PARAMETER_DB_*` โดย fallback ไปฐานหลักตาม configuration เดิม Migration ไม่ล้างข้อมูลและไม่ backfill จุดเก่า ต้องรัน migration ก่อนเปิด application รุ่นนี้; ถ้า receipt table ไม่พร้อม ระบบตอบ `503` และยังไม่ยืนยันการเชื่อมต่อ

ผู้รัน migration ต้องมีสิทธิ์สร้างตารางใน source schema ที่มีอยู่แล้ว ส่วนบัญชี runtime ต้องมี `VIEW DEFINITION` ของ source schema, `SELECT`/`DELETE` ของตารางค่าตรวจวัด และ `SELECT`/`INSERT` ของ receipt table การไม่มีสิทธิ์หรือ source database ติดต่อไม่ได้ต้องแก้ที่ฐานค่าก่อนลองใหม่ ไม่เปลี่ยนสิทธิ์ให้อัตโนมัติ

| คอลัมน์ receipt | ความหมาย |
| --- | --- |
| `source_key` | SHA-256 ของ `DB_HOST` (lowercase), `DB_PORT`, `DB_NAME` (lowercase) ในฐานหลัก แยก namespace เมื่อหลายระบบใช้ฐานค่าร่วมกัน |
| `station_id` | รหัสจุด; unique ร่วมกับ `source_key` ไม่อิง ID คำขอที่ rollback ได้ |
| `request_id`, `actor_user_id` | คำขอและผู้ดำเนินการของการล้างรอบแรก ซึ่งอาจเป็นรอบที่ฐานหลัก rollback |
| `cleared_at` | เวลา UTC ของฐานค่าหลังจับล็อกครบ |
| `table_results_json` | ทั้ง 6 ตารางพร้อม `tableName`, `rowCount`, `skippedMissing` ไม่มีสำเนาค่าตรวจวัด |

เก็บ receipt ไว้เมื่อ rollback migration และห้ามลบ/เปลี่ยน namespace เพื่อบังคับล้างซ้ำ เพราะอาจทำให้ค่าที่เข้ามาหลังล้างถูกลบ หากย้ายหรือเปลี่ยนชื่อฐานหลัก/host ต้องรักษา namespace หรือย้าย receipt อย่างมีแผนก่อนเปิดรับคำขอใหม่ รายการที่เคยเชื่อมต่อแล้วยังได้รับการคุ้มครองจากประวัติ connected point อีกชั้นหนึ่ง

ชุดทดสอบ SQL Server จริงเป็น opt-in ผ่าน `POMS_CLEANUP_SQL_TEST_ENABLED=true` และ credential แยก `POMS_CLEANUP_SQL_TEST_HOST`, `POMS_CLEANUP_SQL_TEST_DATABASE`, `POMS_CLEANUP_SQL_TEST_USER`, `POMS_CLEANUP_SQL_TEST_PASSWORD` (port ไม่ระบุใช้ 1433) ฐานต้องชื่อ `poms_measurement_cleanup_test` และมี extended property ระดับ database `PomsTestPurpose = measurement-cleanup-synthetic-only` เท่านั้น ห้ามใช้ฐาน application ชุดนี้สร้างและลบเฉพาะ schema สมมติชื่อสุ่ม และตรวจ concurrent insert/rollback ด้วย SQL Server โดยไม่ fallback ไปใช้ `DB_*`

- Runtime: [cleanup](../../../../../backend/src/modules/connection-requests/connection-measurement-cleanup.ts), [success transitions](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts)
- Schema/migration: [receipt schema](../../../../../backend/src/modules/connection-requests/connection-measurement-cleanup-schema.ts), [migration](../../../../../backend/src/db/migrations/0143_create_connection_measurement_cleanup_receipts.ts)
- Tests: [cleanup/retry/rollback](../../../../../backend/tests/unit/connection-measurement-cleanup.test.ts), [activation transitions](../../../../../backend/tests/unit/connection-requests.current-factory-profile.repository.test.ts), [direct connection](../../../../../backend/tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts)
- SQL Server opt-in: [concurrent insert และ rollback](../../../../../backend/tests/integration/connection-measurement-cleanup.sql-server.test.ts)
- Runtime OpenAPI: [connection-requests.openapi.ts](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts)
