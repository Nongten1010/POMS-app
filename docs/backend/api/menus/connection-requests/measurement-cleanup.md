# ล้างค่าระหว่างทดสอบเมื่อเชื่อมต่อสำเร็จ

[กลับเมนูขอเชื่อมต่อ](./README.md)

## เริ่มใช้งานสำหรับ frontend

Backend ล้างค่าระหว่างทดสอบก่อนยืนยัน `CONNECTED` อัตโนมัติ ผู้เรียกไม่ต้องส่ง field เพิ่ม และ response สำเร็จใช้ contract เดิมของแต่ละ endpoint. จุดใหม่ล้างแถวในตารางของจุดนั้น; คำขอ `ADD_PARAMETER` ล้างเฉพาะค่ากับสถานะของพารามิเตอร์ที่เพิ่มใหม่ โดยรักษาทุกแถวและพารามิเตอร์เดิมไว้ หลังจากนั้นจึงแสดงข้อมูลที่เข้ามาใหม่

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

## จุดใหม่: ขอบเขตและจังหวะการล้าง

- ใช้กับจุดใหม่ของ `NEW_CONNECTION` และ `ADD_MEASUREMENT_POINT` ที่จะเชื่อมต่อสำเร็จหลังเปิดใช้ feature; ไม่ทำงานย้อนหลังกับจุดที่เชื่อมต่ออยู่แล้ว
- ล้างเฉพาะตารางของ `pointCode` ในคำขอนั้น ไม่ล้างจุดอื่นแม้อยู่โรงงานเดียวกัน ไม่ใช้การล้างทั้งตารางกับ `ADD_PARAMETER` และไม่ล้างรหัสที่เคยมีแถวใน `cems_wpms_connected_measurement_points` รวมแถวที่เลิกใช้งานแล้ว ตรวจชื่อจุดที่ใช้แทนรหัสในข้อมูล legacy ที่ `point_code` ว่างด้วย
- ตารางเป้าหมายคือ `<pointCode>_data_real`, `<pointCode>_data_1m`, `<pointCode>_data_5m`, `<pointCode>_data_60m`, `<pointCode>_data_1day`, `<pointCode>_data_test` ภายใต้ `PARAMETER_DB_SCHEMA` ลบเฉพาะแถว คงโครงสร้างตารางไว้
- ครอบคลุม `POST /cems-wpms-requests/{id}/verify-connection`, direct `CONNECT` ผ่าน `/cems-wpms-requests/direct-connections` และ `/cems-wpms-requests/measurement-points`, รวมการอนุมัติจุดยกเว้นทั้งหมดผ่าน `/{id}/review` หรือ `/{id}/status` ที่เข้าสู่ `CONNECTED` ทันที การสร้างคำขอรอพิจารณา/รอแก้ไขและการบันทึกอุปกรณ์ยังไม่ล้าง
- จับ exclusive lock ของตารางที่มีอยู่ทุกตารางและทุกจุดที่จะล้างก่อนลบแถวแรก ช่วงที่จับล็อกครบคือจังหวะตัดข้อมูล แถวที่มีอยู่ขณะนั้นถูกล้าง การเขียนพร้อมกันต้องรอ commit และแถวที่เขียนภายหลังจะคงอยู่ รวมค่าที่มีเวลาตรวจวัดย้อนหลัง
- ไม่ใช้ `verifiedAt`, `cdate`/`ctime` หรือ `udate`/`utime` เป็นเกณฑ์แบ่งแถวก่อน/หลัง จึงไม่ขึ้นกับนาฬิกาของเครื่องหรือการระบุวันยืนยันย้อนหลัง
- ตารางที่ไม่มีให้ข้ามและบันทึก `skippedMissing: true` หากภายหลังสร้างตารางหรือเติมข้อมูล ไม่ย้อนล้างตารางนั้นอีก
- หากตารางใดล้างไม่ได้ ให้ rollback การล้างทุกจุดในรอบเดียวกันและยังไม่ commit `CONNECTED` การอ่าน metadata ไม่ได้เป็นข้อผิดพลาด ไม่ถือว่าตารางไม่มี

## ขอเพิ่มพารามิเตอร์: ล้างเฉพาะคอลัมน์ของพารามิเตอร์ใหม่

ใช้กับ `POST /api/v1/cems-wpms-requests/:id/verify-connection` เมื่อคำขอ `ADD_PARAMETER` เปลี่ยนจาก `CONNECTION_CONFIRMED` เป็น `CONNECTED` เท่านั้น ไม่ล้างตอนสร้างคำขอ บันทึก config อนุมัติแบบผ่าน `review`/`status` หรือ sync ข้อมูลจุดตามปกติ

- เทียบพารามิเตอร์ที่จะเชื่อมต่อกับพารามิเตอร์ปัจจุบันของ active connected point โดยใช้ชื่อพร้อมหน่วยและ normalize Unicode แบบ NFKC; `Flow Rate`/`Flow` ถือเป็นชื่อเดียวกันเมื่อหน่วยตรงกัน พารามิเตอร์เดิมที่ติดมากับ payload เต็มไม่ใช่เป้าหมายล้าง; ไม่มีพารามิเตอร์เพิ่มใหม่ให้ข้ามการล้าง
- ครอบคลุม `<pointCode>_data_real`, `_data_1m`, `_data_5m`, `_data_60m`, `_data_1day` และ `_data_test` ที่มีอยู่ แม้เลิกส่งข้อมูลใหม่เข้า `test` แล้วก็ตาม
- อัปเดตเฉพาะ `*_value` และ `*_status` ของพารามิเตอร์เป้าหมายเป็น `NULL` ในข้อมูลที่มีอยู่ขณะจับล็อกครบ เก็บ `*_units`, `station_id`, วันเวลา พารามิเตอร์อื่น และทุกแถวไว้ **ห้าม `DELETE` แถว, `TRUNCATE`, ลบตาราง หรือถอดคอลัมน์**
- ตัวอย่าง: เพิ่ม `NOx (ppm)` ในจุดที่มี `CO (ppm)` อยู่แล้ว จะล้างเฉพาะ `nox_value`/`nox_status`; ค่า `co_value`/`co_status`, `nox_units` และ timestamp ของแถวเดิมยังอยู่
- จับคู่คอลัมน์กับชื่อและหน่วยอย่างชัดเจน สำหรับ prefix ทั่วไปใช้ `*_units` แยกแถวของหน่วยที่ตรงกัน เพื่อคงข้อมูลต่างหน่วยไว้; ล้าง **ทุก family ที่ยืนยันว่าตรง** เช่น เพิ่ม `CO2 (ppm)` แล้วล้างทั้ง `co2_ppm_value/status` และ `co2_value/status` ของแถวหน่วย ppm โดยเก็บ `co2_percent_*` และ generic หน่วย `%` ไว้ ไม่หยุดที่ family แรกที่พบ
- รักษา identifier จริง เช่น `pm2_5_*` ของ `PM2.5 (µg/m3)`. `pH` ที่ระบุเป็นไร้มิติชัดเจนใช้หน่วยว่างหรือ `NULL` ได้ รวม label เดิม `pH (pH)` โดยไม่ถือว่าเป็นพารามิเตอร์ใหม่ซ้ำ ข้อยกเว้นนี้ไม่ขยายให้พารามิเตอร์อื่น
- หากจับคู่กำกวมหรือชุดคอลัมน์ทับกันจนแยกพารามิเตอร์เดิมที่ต้องรักษาไม่ได้ ให้หยุดด้วย `503 MEASUREMENT_CLEANUP_FAILED` โดยไม่เดาหรือล้างกว้างขึ้น. การอ่าน generic รุ่นเก่าที่ไม่มีหน่วยเพื่อ compatibility ไม่ใช่สิทธิ์ให้อนุมานการล้างพารามิเตอร์ที่ต้องมีหน่วย
- ห้ามอัปเดตทั้ง family เมื่อ identity อื่นที่ได้รับอนุมัติแล้วใช้คอลัมน์จริงชุดเดียวกัน เช่น `CO2 (percent)` เดิมกับคำขอใหม่ `CO2 (%)`; ตอบ `503` เพื่อรักษาค่าเดิม ส่วน generic ที่พิสูจน์หน่วยของแต่ละแถวได้ยังแยกอัปเดตเฉพาะแถวหน่วยเป้าหมายได้
- Dedicated ทั่วไปต้องมี `_` แยกชื่อกับหน่วยจริง ยกเว้น compact alias CO2 `co2ppm`/`co2percent`/`co2pct` ที่รองรับชัดเจน ไม่ตีความ prefix ของพารามิเตอร์อื่นเป็นชื่อกับหน่วย เช่น `cod_*` เป็น `CO (d)`
- ตารางที่ไม่มีให้ข้ามและเก็บ receipt; หากมีตารางแต่ยืนยันพารามิเตอร์/หน่วยกับคู่คอลัมน์ค่าและสถานะไม่ได้ให้ตอบ `503`. แถวของพารามิเตอร์ที่ต้องมีหน่วยซึ่งมีค่าหรือสถานะแต่หน่วยว่างไม่ถูกเดา. Baseline ที่มีพารามิเตอร์ต้องมีหน่วยแต่ไม่ระบุหน่วย หรือ `parameters_json` ของจุดปัจจุบันผิดรูปแบบ/อ่านไม่ได้ ตอบ `503` เช่นกัน. ติดต่อฐานค่า/อ่าน metadata ไม่ได้ถือเป็นความล้มเหลว. หากตารางใดทำงานไม่สำเร็จให้ rollback การล้างทั้งรอบและยังไม่ commit `CONNECTED`
- ล็อกตารางเป้าหมายทุกตารางก่อนอัปเดตครั้งแรก การเขียนค่าพร้อมกันต้องรอ commit; ข้อมูลที่เขียนหลังจากนั้นคงอยู่ รวมข้อมูลที่ส่งย้อนหลัง โดยไม่ใช้ `verifiedAt` หรือเวลาตรวจวัดเป็นเกณฑ์
- ตรวจผลหลังอัปเดตทุก family ที่ตรงก่อนบันทึก receipt แยกตามคำขอ จุด และพารามิเตอร์ โดยรักษา identity hash เดิม การลองคำขอเดิมใหม่หลังฐานค่าล้างสำเร็จแล้วจะไม่ล้างซ้ำ คำขอเพิ่มพารามิเตอร์ครั้งถัดไปยังทำงานได้ และไม่ใช้ receipt สำหรับล้างจุดใหม่มาตัดสินข้ามงานนี้

ดู [ผลกระทบและการเปลี่ยนผ่าน](../../CHANGELOG.md#add-parameter-measurement-cleanup) สำหรับ client และผู้ดูแล

หากเคยใช้รุ่นที่จับคู่ dedicated/generic ไม่ครบ Receipt เก่าอาจไม่ยืนยันว่าทุก family ถูกล้างครบ ต้อง [ตรวจแบบอ่านอย่างเดียวและตัดสินใจ recovery ก่อน release](../../../guides/parameter-measurement-cleanup-audit.md). ห้ามลบ receipt เพื่อบังคับล้างซ้ำ และห้ามย้อนล้างข้อมูลของคำขอ `CONNECTED` อัตโนมัติ

## ข้อผิดพลาดและการลองใหม่

ใช้ [error envelope กลาง](../../shared/common-api/README.md) สำหรับ endpoint ข้างต้น เพิ่มกรณี `503`:

| Field | Type | ความหมาย |
| --- | --- | --- |
| `success` | boolean | `false` |
| `error.code` | string | `MEASUREMENT_CLEANUP_FAILED` |
| `error.message` | string | จุดใหม่: `Unable to clear test measurements; connection was not completed`; `ADD_PARAMETER`: `Unable to clear added parameter measurements; connection was not completed` |
| `error.details.retryable` | boolean | `true`; ตรวจสถานะล่าสุดก่อนลองใหม่ |

```json
{
  "success": false,
  "error": {
    "code": "MEASUREMENT_CLEANUP_FAILED",
    "message": "Unable to clear added parameter measurements; connection was not completed",
    "details": { "retryable": true }
  }
}
```

ตัวอย่างข้างต้นเป็นข้อความของ `ADD_PARAMETER`; client ควรใช้ `error.code` ตัดสิน flow แทนการเทียบข้อความภาษาอังกฤษ

หากจุดที่เชื่อมต่ออยู่หายไปหรือข้อมูลโรงงาน/`systemType` ไม่ตรงกับคำขอก่อนยืนยันเพิ่มพารามิเตอร์ ตอบ `409 CONFLICT` พร้อม `error.details.reason = ADD_PARAMETER_POINT_OWNERSHIP_INVALID` ตามกติกาเจ้าของจุดเดิมก่อนล้างค่า ให้ reload ข้อมูลปัจจุบันและตรวจคำขอใหม่ ส่วน metadata/baseline/การจับคู่คอลัมน์ที่กำกวมใช้ `503 MEASUREMENT_CLEANUP_FAILED`

เมื่อได้ `503` ให้คงขั้นตอนเดิมและเปิดให้ลองใหม่หลังแก้ปัญหาฐานค่า สำหรับ direct `CONNECT` ที่ล้มเหลว การสร้างคำขอ/จุดในฐานหลักจะ rollback ก่อนส่ง error หาก timeout หรือผลเครือข่ายไม่ชัดเจนให้โหลดสถานะล่าสุดก่อนเสมอ คำขอที่สำเร็จแล้วใช้ข้อจำกัด transition เดิมและไม่ล้างซ้ำ

ฐานค่าตรวจวัดกับฐานคำขออาจอยู่คนละ server จึงมี transaction แยกกัน หากการล้าง commit แล้วแต่บันทึกสถานะในฐานหลักล้มเหลว ค่าทดสอบอาจถูกล้างแล้วโดยสถานะยังไม่สำเร็จ Backend เก็บ receipt ใน transaction เดียวกับการล้างที่ฐานค่า การลองใหม่จึงข้ามงานที่มี receipt และรักษาข้อมูลที่เข้ามาหลังการล้าง. การล้างจุดใหม่ใช้ namespace/รหัสจุดที่คงเดิมแม้ direct request รอบใหม่ได้ `id` ต่างจากรอบที่ rollback ส่วน `ADD_PARAMETER` ใช้ receipt เฉพาะคำขอและชุดพารามิเตอร์นั้น

## ข้อมูลสำหรับ backend และผู้ดูแล

Migration `0143_create_connection_measurement_cleanup_receipts` สำหรับจุดใหม่ สร้างตาราง `connection_measurement_cleanup_receipts` ในฐานค่าตาม `PARAMETER_DB_*` โดย fallback ไปฐานหลักตาม configuration เดิม Migration ไม่ล้างข้อมูลและไม่ backfill จุดเก่า ต้องรัน migration ก่อนเปิด application รุ่นนี้; ถ้า receipt table ไม่พร้อม ระบบตอบ `503` และยังไม่ยืนยันการเชื่อมต่อ

สำหรับ `ADD_PARAMETER` ต้องรัน [`0145_create_parameter_measurement_cleanup_receipts.ts`](../../../../../backend/src/db/migrations/0145_create_parameter_measurement_cleanup_receipts.ts) ก่อนเริ่ม backend รุ่นนี้ด้วย Migration สร้างเฉพาะตาราง `parameter_measurement_cleanup_receipts` ในฐานค่า ไม่ล้างข้อมูลเดิม คีย์คือ `(source_key, request_id, station_id, parameter_key)` โดย `parameter_key` เป็น SHA-256 ของชื่อและหน่วยที่ normalize แล้ว; receipt เก็บผลใน transaction เดียวกับการอัปเดตค่า เก็บตารางและ receipt ไว้เมื่อ rollback migration เพื่อป้องกันล้างข้อมูลใหม่ซ้ำ

ผู้รัน migration ต้องมีสิทธิ์สร้างตารางใน source schema ที่มีอยู่แล้ว ส่วนบัญชี runtime ต้องมี `VIEW DEFINITION` ของ source schema, `SELECT`/`DELETE` ของตารางค่าตรวจวัดสำหรับจุดใหม่ และ `UPDATE` สำหรับล้างเฉพาะพารามิเตอร์ และ `SELECT`/`INSERT` ของ receipt table การไม่มีสิทธิ์หรือ source database ติดต่อไม่ได้ต้องแก้ที่ฐานค่าก่อนลองใหม่ ไม่เปลี่ยนสิทธิ์ให้อัตโนมัติ

| คอลัมน์ `connection_measurement_cleanup_receipts` สำหรับจุดใหม่ | ความหมาย |
| --- | --- |
| `source_key` | SHA-256 ของ `DB_HOST` (lowercase), `DB_PORT`, `DB_NAME` (lowercase) ในฐานหลัก แยก namespace เมื่อหลายระบบใช้ฐานค่าร่วมกัน |
| `station_id` | รหัสจุด; unique ร่วมกับ `source_key` ไม่อิง ID คำขอที่ rollback ได้ |
| `request_id`, `actor_user_id` | คำขอและผู้ดำเนินการของการล้างรอบแรก ซึ่งอาจเป็นรอบที่ฐานหลัก rollback |
| `cleared_at` | เวลา UTC ของฐานค่าหลังจับล็อกครบ |
| `table_results_json` | ทั้ง 6 ตารางพร้อม `tableName`, `rowCount`, `skippedMissing` ไม่มีสำเนาค่าตรวจวัด |

ตาราง `parameter_measurement_cleanup_receipts` สำหรับ `ADD_PARAMETER` ใช้รูปแบบแยกจาก receipt ของจุดใหม่:

| คอลัมน์ | ความหมาย |
| --- | --- |
| `source_key` | namespace ฐานหลักแบบเดียวกับ receipt จุดใหม่ |
| `request_id`, `station_id` | ระบุคำขอเพิ่มพารามิเตอร์และจุด; คำขอใหม่ของจุดเดิมเป็นคนละงาน |
| `parameter_key` | SHA-256 ของ identity พารามิเตอร์ที่ normalize ชื่อและหน่วยแล้ว; รวมใน primary key |
| `parameter_label` | ชื่อพารามิเตอร์พร้อมหน่วยที่ล้าง |
| `actor_user_id`, `cleared_at` | ผู้ดำเนินการและเวลา UTC ของฐานค่าหลังจับล็อกครบ |
| `table_results_json` | รายการทั้ง 6 interval แต่ละรายการมีเฉพาะ `tableName` และ `skippedMissing`; ไม่มี `rowCount` และไม่มีสำเนาค่าตรวจวัด |

การจับคู่ prefix ทั่วไปใช้ unit key แบบ NFKC แต่ bind ตัวสะกดหน่วยจริงจาก source ใน SQL เพื่ออัปเดตเฉพาะแถวที่ตรงหน่วย ชื่อคอลัมน์อ้างจาก metadata และรักษา underscore ของ identifier จริง ไม่สร้างชื่อ SQL จากข้อความ label โดยตรง

เก็บ receipt ไว้เมื่อ rollback migration และห้ามลบ/เปลี่ยน namespace เพื่อบังคับล้างซ้ำ เพราะอาจทำให้ค่าที่เข้ามาหลังล้างถูกลบ หากย้ายหรือเปลี่ยนชื่อฐานหลัก/host ต้องรักษา namespace หรือย้าย receipt อย่างมีแผนก่อนเปิดรับคำขอใหม่ รายการที่เคยเชื่อมต่อแล้วยังได้รับการคุ้มครองจากประวัติ connected point อีกชั้นหนึ่ง

ชุดทดสอบ SQL Server จริงเป็น opt-in ผ่าน `POMS_CLEANUP_SQL_TEST_ENABLED=true` และ credential แยก `POMS_CLEANUP_SQL_TEST_HOST`, `POMS_CLEANUP_SQL_TEST_DATABASE`, `POMS_CLEANUP_SQL_TEST_USER`, `POMS_CLEANUP_SQL_TEST_PASSWORD` (port ไม่ระบุใช้ 1433) ฐานต้องชื่อ `poms_measurement_cleanup_test` และมี extended property ระดับ database `PomsTestPurpose = measurement-cleanup-synthetic-only` เท่านั้น ห้ามใช้ฐาน application ชุดนี้สร้างและลบเฉพาะ schema สมมติชื่อสุ่ม และตรวจ concurrent insert/rollback ด้วย SQL Server โดยไม่ fallback ไปใช้ `DB_*`

- Runtime สำหรับเพิ่มพารามิเตอร์: [ล้างเฉพาะพารามิเตอร์](../../../../../backend/src/modules/connection-requests/added-parameter-measurement-cleanup.ts), [receipt schema](../../../../../backend/src/modules/connection-requests/parameter-measurement-cleanup-schema.ts), [migration 0145](../../../../../backend/src/db/migrations/0145_create_parameter_measurement_cleanup_receipts.ts)
- Matching และตรวจรับ schema: [family matcher ร่วมกับ connection-test](../../../../../backend/src/modules/parameter-values/measurement-parameter-columns.ts), [ทดสอบ migration 0145](../../../../../backend/tests/unit/parameter-measurement-cleanup.migration.test.ts), [audit/recovery แบบอ่านอย่างเดียว](../../../guides/parameter-measurement-cleanup-audit.md)
- Tests สำหรับเพิ่มพารามิเตอร์: [API อนุมัติและอ่านค่าผ่าน routes จริง](../../../../../backend/tests/unit/add-parameter-cleanup.api.test.ts), [fixture ฐานค่า](../../../../../backend/tests/helpers/parameter-cleanup-source-fixture.ts), [OpenAPI สำหรับ final verify](../../../../../backend/tests/unit/parameter-values.connection-test.openapi.test.ts)
- Runtime สำหรับจุดใหม่: [cleanup](../../../../../backend/src/modules/connection-requests/connection-measurement-cleanup.ts), [success transitions](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts)
- Schema/migration: [receipt schema](../../../../../backend/src/modules/connection-requests/connection-measurement-cleanup-schema.ts), [migration](../../../../../backend/src/db/migrations/0143_create_connection_measurement_cleanup_receipts.ts)
- Tests: [cleanup/retry/rollback](../../../../../backend/tests/unit/connection-measurement-cleanup.test.ts), [activation transitions](../../../../../backend/tests/unit/connection-requests.current-factory-profile.repository.test.ts), [direct connection](../../../../../backend/tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts)
- SQL Server opt-in: [concurrent insert และ rollback](../../../../../backend/tests/integration/connection-measurement-cleanup.sql-server.test.ts)
- Runtime OpenAPI: [connection-requests.openapi.ts](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts)
