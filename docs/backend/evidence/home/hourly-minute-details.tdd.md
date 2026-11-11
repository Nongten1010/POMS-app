# หลักฐาน API ข้อมูลรายนาทีของชั่วโมงที่เลือก

สัญญาที่ frontend ใช้อ้างอิงคือ [ข้อมูลรายนาที](../../api/shared/connected-measurement-points/measurement-minutes.md) หน้านี้บันทึกวิธีตรวจและข้อจำกัดของ implementation ในเครื่อง ไม่ใช่ผลตรวจ production

## ขอบเขต

- เพิ่ม `GET /connected-measurement-points/:stationId/measurement-minutes` และ annual path alias
- แก้เฉพาะ backend กับ canonical docs ไม่แก้ frontend และไม่เพิ่ม dependencies หรือ migrations; ผลส่วนนี้เป็นการตรวจ implementation ในเครื่องก่อนส่ง production
- ทดสอบผ่าน HTTP จริงใน process โดยแทน persistence adapters ด้วย fixtures; controller, authorization, services และ response mapping ทำงานจริง
- ทดสอบ query ของ production Knex ผ่าน `knex-sqlite-fixture` ที่แทนเฉพาะ database runner ไม่จำลองผลลัพธ์ของ query

## วงรอบ TDD

| กรณี | หลักฐานตอน Red | ผลหลังเพิ่ม implementation |
| --- | --- | --- |
| ค่ากับสถานะและ 60 นาที | endpoint ยังไม่มี คืน 404 | คงค่าทศนิยมพร้อม Maintenance และเติม null เฉพาะช่องที่ขาด |
| แถวซ้ำและต่างหน่วย | เลือกแถวแรก ทำให้ค่าเก่าและอีกหน่วยหาย | เลือกตัวอย่างล่าสุดแยกต่อพารามิเตอร์/หน่วย |
| ขอบชั่วโมงของ query | reader เริ่มต้นคืน [] | อ่านเฉพาะชั่วโมง 00/09/23 รวมเศษวินาทีสุดท้าย ไม่อ่านวันถัดไป |
| ป้องกันนอก scope | คืน 200 เมื่อ adapter แจ้งว่าไม่มีสิทธิ์ | คืน 403 ก่อนอ่าน metadata หรือรายนาที |
| วันที่ไม่ถูกต้อง | วันที่ผิดบางรูปแบบทำให้เกิด 500 | คืน 400 VALIDATION_ERROR โดยไม่อ่านข้อมูล |
| ค่าว่าง/ไม่ใช่ตัวเลข | ส่งค่าว่างเป็น string | คืน null โดยคงสถานะ และรักษา precision ของ decimal string |
| Flow alias | ส่ง Flow และ Flow Rate ซ้ำกัน | คืน Flow Rate (m3/hr) ชื่อเดียว |
| สัญญา OpenAPI | ไม่พบ operation | มีทั้ง legacy/annual path, schema, permissions, errors และตัวอย่าง |
| หน่วยที่ซ่อน | อนุมานหน่วยจากพารามิเตอร์ที่มองเห็นแล้วคืนค่า | ตรวจหน่วยที่ลงทะเบียนทั้งหมดก่อน fallback จึงไม่ยืมค่าของหน่วยที่ซ่อน |
| Flow จาก live registration แบบเดิม | คืน null แม้ flow_value เป็น 25 เพราะนับ Flow และ Flow Rate เป็นคนละหน่วย | normalize รายการแสดงและลงทะเบียนก่อนตรวจหน่วย; HTTP test ได้ค่า 25 และ Normal |
| ชื่อ CO ที่ไม่มีหน่วย | คืน key CO และ null แม้ source มีค่า 50 พร้อม ppm | ระบุ CO (ppm) จาก metadata/source ที่ยืนยันหน่วยเดียว และคืนค่า 50 |
| ชื่อไม่มีหน่วยเมื่อมี hidden unit ขัดแย้ง | คืน 200 และเลือกหน่วยจาก source ทั้งที่ metadata ระบุอีกหน่วย | คืน 503 MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE; ไม่เดาหน่วยหรือคืนค่าข้ามหน่วย |
| OpenAPI ของหน่วยที่ยืนยันไม่ได้ | ไม่มี response 503 ในทั้งสอง path | เพิ่ม error contract และตัวอย่างตรงกับ runtime |
| Numeric string ที่มีช่องว่างรอบค่า | runtime ยอมรับ แต่ OpenAPI pattern ปฏิเสธ | schema ยอมรับข้อความตัวเลขเดิมพร้อมช่องว่าง และยังปฏิเสธข้อความที่ไม่ใช่ตัวเลข |

Tests เพิ่มเติมครอบคลุม 401/403, ชั่วโมงและ query ผิดรูปแบบ, จุดที่หาย/ซ่อน/ยกเว้น, ตารางหาย, ชั่วโมงว่าง, สถานะรหัส 0–9, ค่า 0, status-only, แถวซ้ำกลับลำดับ, column families กำกวม และ annual code ทั้ง encode slash และ split path รวม status-only หลัง resolve หน่วย, metadata ของชั่วโมงว่าง, หน่วยขาด/หลายหน่วย, pH ไร้มิติ และการตัด label ซ้ำหลัง resolve หน่วย

## ผลตรวจ

| รายการ | ผล |
| --- | --- |
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| ESLint รอบตรวจสุดท้ายเฉพาะไฟล์ที่เปลี่ยน | PASS: 0 errors และ warnings เดิม 2 รายการใน registry test บรรทัดที่ไม่แก้ |
| ชุดทดสอบที่เกี่ยวข้อง | PASS: 266 tests ใน 11 suites และ SQL Server จริงอีก 3 tests ผ่าน รวม 269 tests ที่เกี่ยวข้อง |
| Coverage ของ reader/schema ใหม่ | Statements 94.05%, branches 85.1%, functions 92.3%, lines 95.55%; ไม่ใช่ coverage ทั้ง backend |
| Security review | ตรวจ permission/scope ก่อนข้อมูล, current visibility, หน่วยที่ซ่อน, query bindings, ไม่มี secrets/console.log ใหม่ และไม่คืนชื่อ physical source |
| เอกสาร | relative links ของหน้าที่เปลี่ยนผ่าน; contract ใหม่เข้าถึงได้จาก backend hub; registry/OpenAPI ตรวจจำนวน 165 canonical endpoints และ 175 operations |
| Diff | `git diff --check` ผ่าน; ไม่มี frontend หรือ generated files ใน change |

คำสั่งทดสอบที่ใช้:

```bash
cd backend
npm test -- --runInBand --runTestsByPath \
  tests/unit/measurement-minutes.api.test.ts \
  tests/unit/measurement-minutes.repository.test.ts \
  tests/unit/measurement-minutes.openapi.test.ts \
  tests/integration/measurement-minutes.sql-server.test.ts \
  tests/unit/home-measurement-access.test.ts \
  tests/unit/parameter-values.home-handoff.test.ts \
  tests/unit/connected-measurement-points.route.test.ts \
  tests/unit/measurement-csv-export.route.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/laws-faqs.openapi.test.ts \
  tests/unit/home-handoff.openapi.test.ts \
  tests/unit/parameter-values.validator.test.ts \
  --coverage \
  --collectCoverageFrom=src/modules/parameter-values/measurement-minutes.ts \
  --collectCoverageFrom=src/modules/api-docs/measurement-minutes.openapi.ts
```

## ข้อจำกัดและการตรวจต่อ

- รัน SQL Server จริงครบ 3 tests แล้วบน SQL Server 2022 (`16.0.4255.1`) ใน local Docker โดยใช้ฐาน `poms_measurement_minutes_test` แยกและข้อมูลสมมติทั้งหมด ตรวจชั่วโมง 00/09/23 และ TIME(7) ผ่าน schema/table ของ test ถูกลบหลังจบ ส่วนฐานทดสอบเก็บไว้โดยไม่แตะข้อมูล production
- การรันซ้ำใช้ชุด opt-in โดยกำหนด `RUN_POMS_MINUTE_SQL_TEST=1` และ `POMS_MINUTE_SQL_TEST_HOST`, `POMS_MINUTE_SQL_TEST_USER`, `POMS_MINUTE_SQL_TEST_PASSWORD`, `POMS_MINUTE_SQL_TEST_DATABASE=poms_measurement_minutes_test` ใน environment; port เป็น optional ใช้ 1433 เป็นค่าเริ่มต้น ไม่ใส่ credentials ในเอกสารหรือคำสั่งที่บันทึกไว้
- ชุด SQL Server ตรวจชื่อฐานจริงก่อนเขียน ใช้ schema สุ่มเฉพาะ test และลบเฉพาะ schema/table ของตนเมื่อจบ ตรวจคอลัมน์ DATE/TIME(7), query bindings, ขอบเที่ยงคืน และการรักษาเศษวินาที ห้ามชี้ไป production
- Fixture SQLite ไม่รับรอง implicit conversions, query plans หรือ driver behavior ของ SQL Server; รอบนี้มีผล opt-in บน SQL Server 2022 เพิ่มแล้ว แต่ยังไม่ใช่ performance/driver verification ของ instance production
- repository มี docs guard specification แต่ยังไม่พบ executable guard จึงตรวจ relative links/reachability และใช้ registry/OpenAPI tests ในรอบนี้ ยังไม่ได้อ้างว่าผ่าน AST route extraction หรือ docs guard เต็มชุด
- ยังไม่ได้เชื่อม dialog ฝั่ง frontend หรือทดสอบ browser; ผล deployment, health และ runtime production OpenAPI ดู [หลักฐาน release](./hourly-minute-details-production.md)

## Documentation impact

```text
Docs impact: updated
Canonical docs: docs/backend/api/shared/connected-measurement-points/measurement-minutes.md
Reason: เพิ่มสัญญาอ่านรายนาทีหนึ่งชั่วโมง รวม request/response, permissions, validation, errors และ runtime OpenAPI
Client impact: frontend
Breaking change: no
```
