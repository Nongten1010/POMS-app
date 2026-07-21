# Connected Factory Profile Sync Workflow

Status: Ready for implementation

## Goal

เมื่อคำขอเชื่อมต่อสำเร็จ ให้ข้อมูลโรงงานล่าสุดจากคำขอถูกใช้เป็นข้อมูล current/live ในระบบ POMS และปรับข้อมูลโรงงานที่เข้าข่ายให้สอดคล้องกัน โดยไม่เขียนข้อมูลนี้ลง master table `factories`.

## Trigger

workflow เริ่มตั้งแต่ผู้ใช้ส่งคำขอ โดยมี eligibility gate ก่อนสร้าง request และ sync factory profile เมื่อคำขอเข้าสู่ `CONNECTED` จากหนึ่งในสอง flow:

1. คำขอปกติของผู้ประกอบการผ่าน `verifyConnection` จาก `CONNECTION_CONFIRMED` เป็น `CONNECTED`.
2. เจ้าหน้าที่สร้าง Direct Connection ซึ่งบันทึกคำขอเป็น `CONNECTED` ทันที.

## Canonical Data Meaning

- “โรงงานในระบบ POMS” หมายถึงข้อมูล current/live หลังเชื่อมต่อ ซึ่งใน schema ปัจจุบันอยู่กับ active rows ของ `cems_wpms_connected_measurement_points`.
- “โรงงานที่เข้าข่าย” หมายถึงข้อมูลใน `eligible_factories`.
- `factories` เป็น master identity/access data และอยู่นอกขอบเขตการ sync นี้.
- ข้อมูลคำขอใน `cems_wpms_connection_requests` ยังคงเป็น snapshot ตามเวลายื่นคำขอ.
- โรงงานในระบบ POMS เป็น subset ของโรงงานที่เข้าข่าย: ทุก factory ที่จะ materialize เป็น POMS current/live ต้อง resolve ไปยัง active `eligible_factories` ได้ก่อน.
- คำขอเชื่อมต่อทุกคำขอเป็น subset ของโรงงานที่เข้าข่ายเช่นกัน: โรงงานต้องมี active `eligible_factories` ก่อนจึงจะสร้าง request ได้.

## Fields To Synchronize

เมื่อเชื่อมต่อสำเร็จ ใช้ค่าจาก request snapshot ดังนี้:

| Field | POMS current/live | `eligible_factories` |
| --- | --- | --- |
| `latitude`, `longitude` | yes | yes |
| `eia`, `eiaOther`, derived `hasEia` | yes | yes |
| `projectName` | yes | yes |
| เอกสาร title `ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน` | yes | no |
| เอกสาร title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` | yes | no |

- `latitude` / `longitude` ในตารางข้างต้นคือพิกัดโรงงานจาก request factory profile เท่านั้น.
- ฝั่ง POMS ให้เขียนลง `factory_latitude` / `factory_longitude`; ฝั่ง eligible ให้เขียนลง `latitude` / `longitude`.
- ห้ามเปลี่ยน `cems_wpms_measurement_points.latitude` / `longitude` หรือพิกัด point-specific ใด ๆ เพราะเป็นพิกัดจุดตรวจวัดคนละความหมาย.
- เก็บ EIA แบบ categorical ตาม contract เดิม: `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ` และเก็บ `eiaOther` เฉพาะเมื่อเป็น `อื่นๆ`.
- `hasEia` ต้อง derive จาก categorical EIA ด้วยกติกาเดียวกับคำขอ.
- รูปหน้าโรงงานรองรับหลายรายการตาม validation เดิม; โลโก้รองรับได้หนึ่งรายการต่อคำขอ.
- เก็บ document metadata ที่ผ่าน validation เดิม เช่น `fileUrl`, `fileName`, `fileType`, `fileSize`, `link`, `description` โดยไม่ลดเหลือเพียง URL.

## Public API Contract

- ไม่เพิ่ม endpoint และไม่เปลี่ยน request payload.
- ใช้ action/endpoint เดิมที่ทำให้คำขอเข้าสู่ `CONNECTED`.
- endpoint สร้างคำขอปกติและ Direct Connection ต้องปฏิเสธโรงงานที่ไม่ใช่ active eligible factory ด้วย `404 Not Found` ใน project-standard error envelope และต้องไม่ทิ้ง partial records.
- การเพิ่ม factory-profile fields ใน response ที่เกี่ยวข้องเป็น backward-compatible addition และต้องใช้ envelope/status code เดิม.
- validation ของพิกัด, EIA และ document metadata ใช้ Zod contract เดิมของ connection request.

## Consistency Boundary

- ก่อน insert `cems_wpms_connection_requests` ต้อง resolve active eligible factory โดยใช้ identifier aliases เดิมของระบบ.
- request ต้องเก็บ `eligible_factory_id` ที่ resolve ได้เพื่อรักษาความสัมพันธ์จาก eligible selection ไปยัง request และ POMS current/live.
- หาก submission ไม่พบ eligible factory ห้ามสร้าง eligible row โดยอัตโนมัติและต้อง rollback โดยไม่ให้มี request ใหม่เกิดขึ้น.
- หาก action ของ request เดิมตรวจพบว่า eligible relationship ใช้ต่อไม่ได้ ห้าม materialize POMS rows และต้อง rollback โดยคงสถานะคำขอเดิม.
- การเปลี่ยนสถานะ, materialize connected points, sync POMS factory profile และ sync `eligible_factories` ต้องสำเร็จหรือ rollback ร่วมกัน.
- ทั้ง normal connection และ Direct Connection ต้องให้ผลเหมือนกันสำหรับ factory-profile sync.
- ใช้ `updated_by` จาก authenticated actor และอัปเดต audit timestamps.
- การจับคู่โรงงานรองรับ identifier aliases ที่ระบบใช้อยู่: POMS `factory_id` / `factory_registration_no` และ eligible `source_factory_id` / `factory_registration_no_new`.

## TDD Behaviors

ทำเป็น vertical slices ทีละ behavior:

1. เมื่อ normal connection สำเร็จ API เดิมอ่านกลับได้ว่าพิกัด factory profile ใน POMS และ eligible เป็นค่าจากคำขอ.
2. เมื่อ normal connection สำเร็จ EIA แบบเต็ม, `eiaOther`, `hasEia` และชื่อโครงการถูก sync ทั้งสองชุด.
3. เมื่อ normal connection สำเร็จ รูปหน้าโรงงานทั้งหมดและโลโก้ถูก sync เฉพาะ POMS.
4. Direct Connection ให้ผล factory-profile sync เดียวกันและยังคงตอบ `201 Created` ตาม contract เดิม.
5. ความล้มเหลวระหว่าง sync rollback สถานะและข้อมูล current/live ทั้งหมด.
6. โรงงานที่ไม่มี active eligible row ไม่สามารถเข้าสู่ POMS ได้ และ action ไม่ทิ้ง partial request/current rows.
7. การส่งคำขอปกติหรือ Direct Connection สำหรับโรงงานที่ไม่เข้าข่ายตอบ `404` และไม่สร้าง request/history/points.

## Resolved Decision: Factory Coordinates

- พิกัดที่ sync คือพิกัดโรงงาน ไม่ใช่พิกัดจุดตรวจวัด.
- เมื่อข้อมูลโรงงานใน POMS แสดงผ่านหลาย active connected-point rows ให้ทุกแถวของโรงงานใช้ factory-profile version เดียวกัน โดยคง point-specific coordinates เดิมไว้.

## Resolved Decision: Multiple Active POMS Points

โรงงานเดียวอาจมี active connected point หลายแถว แต่ข้อมูลชุดนี้เป็น factory profile หนึ่งชุด ต้องกำหนดว่าเมื่อคำขอล่าสุดเชื่อมต่อแล้วจะอัปเดตทุก active point ของโรงงาน หรือเฉพาะจุดจากคำขอล่าสุด.

Decision: อัปเดต factory-profile fields ของทุก active connected point ที่ match โรงงานเดียวกัน เพื่อไม่ให้ API ต่างจุดอ่านข้อมูลโรงงานคนละเวอร์ชัน โดยคง point-specific fields, point-specific coordinates และ `documents_json` เดิมของแต่ละจุดไว้.

## Resolved Decision: Missing Optional Values

- ใช้ patch semantics: ค่า optional ที่เป็น `null`, `undefined` หรือไม่มี document title ที่เกี่ยวข้องไม่ล้าง current factory profile เดิม.
- อัปเดตพิกัดโรงงานเมื่อ request มีทั้ง `latitude` และ `longitude`; หากขาดค่าหนึ่งให้คงพิกัดเดิมทั้งคู่เพื่อไม่สร้าง coordinate pair จากคนละเวอร์ชัน.
- หาก `eia` ไม่มีค่า ให้คง `eia`, `eiaOther` และ `hasEia` เดิมทั้งชุด.
- หาก `projectName` ไม่มีค่า ให้คงชื่อโครงการเดิม.
- หากไม่มีเอกสาร title `ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน` ให้คงภาพหน้าโรงงานเดิม.
- หากไม่มีเอกสาร title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` ให้คงโลโก้เดิม.
- ค่าใหม่ที่มีจริงแทนที่ค่าปัจจุบันของ field group นั้น และถูกใช้กับ POMS/eligible destinations ตามตาราง Fields To Synchronize.

## Resolved Decision: Eligible Factory Precondition

- โรงงานต้องมาจาก active `eligible_factories` ก่อนจึงจะส่งคำขอเชื่อมต่อได้.
- Normal request creation และ Direct Connection ใช้ eligibility precondition เดียวกันก่อนสร้าง request.
- request เก็บ `eligible_factory_id`; เมื่อเข้าสู่ POMS current/live ให้ connected rows สืบทอด identifier เดียวกัน.
- ไม่สร้างหรือ restore eligible factory จาก connection workflow เพราะการคัดเลือกโรงงานเข้าข่ายเป็น workflow แยก.
- หาก submission resolve ไม่พบ ให้ตอบ `404 Not Found` ด้วย project-standard error envelope และ rollback ทุก mutation ในรอบนั้น.
- Persistence ควรบันทึก `eligible_factory_id` ที่ resolve ได้ไว้กับ POMS current/live row เพื่อให้ตรวจ invariant และ join ได้โดยตรง ไม่อาศัย string aliases ทุกครั้ง.

## Resolved Decision: Eligibility Removed Before Connection

- ก่อน transition request เดิมเป็น `CONNECTED` ต้องตรวจว่า `eligible_factory_id` ยังชี้ไปยัง active `eligible_factories`.
- หาก eligible row ถูก soft-delete/ถอดออก ให้ตอบ `409 Conflict` ด้วย project-standard error envelope.
- คงสถานะคำขอเดิมและ rollback mutation ทั้งหมด; ห้าม materialize หรือแก้ POMS current/live.
- ผู้ใช้ต้องทำให้โรงงานกลับมาเป็น active eligible factory ผ่าน workflow คัดเลือกโรงงานก่อนจึงลองเชื่อมต่อใหม่ได้.

## Resolved Decision: Legacy POMS Eligibility Backfill

- Migration ต้อง backfill `eligible_factory_id` ให้ active POMS rows เดิมด้วย identifier aliases ที่กำหนดไว้.
- หากมี active POMS row ที่จับคู่กับ active `eligible_factories` ไม่ได้หรือจับคู่ได้ไม่เป็นเอกเทศ ให้ migration throw และ rollback ทั้ง migration.
- ข้อผิดพลาดต้องรายงานจำนวนและ identifiers ที่จำเป็นต่อการแก้ข้อมูล โดยไม่เปิดเผยข้อมูลลับ.
- ห้ามลบ/soft-delete POMS data และห้ามสร้าง/restore eligible factory อัตโนมัติเพื่อให้ migration ผ่าน.
- หลังแก้ข้อมูลผ่าน workflow โรงงานเข้าข่ายหรือแก้ identifier ต้นทางแล้ว ผู้ดูแลจึงรัน migration ใหม่.

## Migration Explanation

Migration ใน workflow นี้คือชุดคำสั่งที่ปรับ schema และข้อมูลเดิมของฐานข้อมูล POMS ให้รองรับกติกาใหม่ ไม่ใช่การย้ายระบบหรือย้ายฐานข้อมูลไปเครื่องอื่น. ระบบ deploy จะรัน migration หนึ่งครั้งก่อนใช้ backend รุ่นใหม่.

Migration นี้ต้อง:

1. เพิ่ม `eligible_factory_id` ให้ request และ POMS current/live เพื่อบันทึกความสัมพันธ์กับโรงงานเข้าข่ายโดยตรง.
2. เพิ่ม factory-profile fields ที่ยังไม่มีสำหรับ EIA, ชื่อโครงการ, รูปหน้าโรงงาน และโลโก้.
3. เพิ่ม EIA categorical และชื่อโครงการให้ `eligible_factories` โดยคง `has_eia` สำหรับ compatibility.
4. นำ active POMS rows เดิมมาจับคู่กับ active `eligible_factories` ผ่าน `factory_id`, `factory_registration_no`, `source_factory_id` และ `factory_registration_no_new`.
5. เติม `eligible_factory_id` เมื่อจับคู่ได้เพียงหนึ่งรายการ.
6. เพิ่ม foreign key และ active-row integrity checks หลัง backfill สำเร็จ.

หากมี active POMS row ที่จับคู่ไม่ได้หรือจับคู่ได้หลาย eligible rows ระบบจะ throw error และ rollback migration ทั้งชุด. ผลคือ schema และข้อมูลเดิมยังอยู่ครบ ไม่มีการอัปเดตครึ่งหนึ่ง, ไม่มีการลบ POMS data และไม่มีการสร้าง eligible factory เพื่อกลบปัญหา. ผู้ดูแลต้องแก้ eligibility/identifier ผ่าน workflow ที่ถูกต้อง แล้วรัน migration ใหม่.

ตัวอย่างข้อมูลที่จับคู่ได้:

```text
POMS factory_id: F000123
POMS factory_registration_no: 3-106-33/50สบ

eligible_factories.id: 25
eligible_factories.source_factory_id: F000123
eligible_factories.factory_registration_no_new: 3-106-33/50สบ
```

หลัง migration POMS row จะมี `eligible_factory_id = 25`. ถ้าไม่มี active eligible row ที่ตรงกัน migration ต้องหยุดพร้อมรายงาน identifiers ที่ใช้แก้ข้อมูล.

## Definition Of Done

- Workflow spec ไม่มี pending decision.
- Normal และ Direct request submission บังคับ active eligible factory ก่อนสร้าง request.
- Request และ active POMS rows เก็บ `eligible_factory_id` ที่ตรวจสอบย้อนกลับได้.
- ก่อนเข้าสู่ `CONNECTED` ตรวจ active eligibility ซ้ำ และตอบ `409` โดยไม่ mutate เมื่อ eligibility ถูกถอด.
- เมื่อเข้าสู่ `CONNECTED` สำเร็จ factory coordinates, EIA และ project name sync ไป POMS กับ eligible; factory photos/logo sync ไป POMS เท่านั้น.
- Missing optional values คง current values เดิม และ point-specific coordinates/documents ไม่ถูกแก้.
- Migration rollback เมื่อ legacy active POMS row จับคู่ eligible ไม่ได้.
- Public contract, canonical backend docs, typecheck, tests และ security checks ผ่าน.
