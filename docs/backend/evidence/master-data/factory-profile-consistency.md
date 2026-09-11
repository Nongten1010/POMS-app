# หลักฐานตรวจข้อมูลทั่วไปโรงงานเข้าข่ายและ POMS

ขอบเขตคือคงข้อมูล 3 ส่วน: Fac60k ต้นทางอ่านอย่างเดียว, โรงงานเข้าข่าย และโรงงานใน POMS โดยสองส่วนหลังใช้ข้อมูลทั่วไปแหล่งเดียวกันเมื่อเปิด canonical mode. จุดตรวจวัดและประวัติคำขอยังแยกตามหน้าที่เดิม.

อ้างอิง [แผนเปิดใช้และข้อจำกัด](../../guides/factory-profile-consistency-rollout.md), [ข้อมูลพื้นฐาน POMS](../../api/menus/master-data/factory-edit-requests.md), [โรงงานเข้าข่าย](../../api/menus/eligible-factories/README.md) และ [คำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md).

## สภาพแวดล้อมและขอบเขตหลักฐาน

ตรวจใน worktree แยกจาก cached `origin/main` ที่ `ea87588479b40a9caf11888d590e26266cf81cee` เพื่อรักษางานเดิมใน checkout. ใช้ synthetic test environment, ไม่คัดลอก `.env` จริง และไม่ commit/push/deploy. `FACTORY_PROFILE_MODE` มีค่าเริ่มต้น `legacy`; tests เฉพาะ canonical เปิด mode ใน fixture อย่างชัดเจน.

ผล unit/service และ HTTP routes ใช้ mock repositories/services, stateful transaction doubles และ SQL compilation ด้วย Knex MSSQL. หลักฐานกลุ่มนั้นแยกจากชุด SQL Server จริง 20 รายการที่รันบนฐานสมมติแล้วลบตามหัวข้อด้านล่าง; ไม่อ้างว่า HTTP mocks เป็นการทดสอบ API กับฐานจริง.

## หลักฐาน RED → GREEN

| จุดที่ตรวจ | สิ่งที่ failing tests จับได้ก่อนแก้ |
| --- | --- |
| คำขอเชื่อมต่อและ direct connection | snapshot เก่าย้อนพิกัด/EIA/โครงการ, จุดใหม่ใช้ชื่อเก่า, ล้างค่าแล้วถูกเติมกลับ, first connection ไม่มี revision guard |
| ข้อมูลจุดตรวจวัดปัจจุบัน | ใช้พารามิเตอร์/เครื่องมือ/เอกสารจากคำขอเก่า, จุดถูกแทนแล้วยังแสดง, ใช้ชื่อใหม่แล้วหา config เดิมไม่พบ |
| ข้อมูลหลักและ projections | ไม่เรียก writer ร่วม, restore ใช้ค่าที่ส่งมาแทนข้อมูลหลัก, full PUT ทำค่าที่ไม่ส่งหาย, เวอร์ชันจุดตรวจวัดเปลี่ยนเพราะแก้ข้อมูลทั่วไป |
| แบบฟอร์มและโรงงานเข้าข่าย | บันทึก form สำเร็จก่อน eligible ล้มเหลว, hydration เติมที่อยู่ทับค่าที่ล้าง, ไม่แยก EIA ที่ไม่ส่งออกจาก `null` |
| อนุมัติ POMS | ไม่เก็บ revision, ยอมรับคำขอ stale, ใช้ timestamp ของจุดแทนข้อมูลทั่วไป, point-only request ถูกขัดขวางด้วยการแก้ profile พร้อมกัน |
| สิทธิ์และ API ปลายทาง | province/estate scope ใช้ master หรือ snapshot เก่า, เลขรายงานใหม่ใช้จังหวัดเก่า, ชื่อจาก canonical หายเมื่อไม่มี lookup master |
| Backfill/readiness | ไม่ตรวจ conflicts/aliases ทุกชุด, ไม่มี views หรือ revision column แล้วยังรายงานพร้อม, รหัสประเภท `88` กับ `00088` ถูกถือว่าต่าง |
| Schema/OpenAPI | module/metadata ยังไม่มี, view name ไม่ตรง migration, down ลบ views หลังมีข้อมูล, contract ไม่บอก revision/clear/current behavior |

Tests ของ module ใหม่บางส่วนเริ่ม RED จากการ compile ไม่พบ implementation; tests เชิงพฤติกรรมในตารางมี runtime RED ตามกรณีที่ระบุ ไม่อ้างว่า compile failure เป็นผลทดสอบฐานข้อมูล.

## ผลตรวจสุดท้าย

- Backend tests: **211 suites / 2,243 tests ผ่านทั้งหมด**, ไม่มี test ที่ skip.
- Build และ Typecheck ผ่านบนโค้ดหลังแก้กรณี recovery อ้างเลขทะเบียนเก่า.
- ESLint ผ่าน 47 ไฟล์ TypeScript ที่แก้ใน src/tests; สองไฟล์ของการแก้ recovery สุดท้ายตรวจซ้ำแล้วไม่มี warning.
- `git diff --check` ผ่าน; ลิงก์เอกสารที่เพิ่มไม่มีปลายทางขาด. พบลิงก์ PDF เก่าใน guides index ที่ไม่มีไฟล์อยู่แล้วใน base commit จึงไม่ได้แก้ในงานนี้.
- CLI `node --import tsx scripts/factory-profile-backfill.ts --help` รันได้จริงโดยไม่โหลดฐานข้อมูล.

คำสั่งทดสอบใช้ค่า DB/JWT สมมติใน environment ที่แยกจาก production พร้อม `NODE_ENV=test`, `PUBLIC_BASE_URL=http://fixture.invalid` และ `PARAMETER_DB_SCHEMA=ingest` ตาม fixture เดิม:

```bash
npm test -- --runInBand --cacheDirectory=/private/tmp/poms-jest-final
npm run build
npm run typecheck
```

การรันรวมครั้งแรกพบ 4 assertions เรื่องชื่อ schema เพราะ environment จำลองใช้ default dbo แต่ fixture คาด ingest; หลังตั้งค่าให้ตรง fixture ชุดนั้นผ่าน 36/36 แล้วรันรวมบนโค้ดสุดท้ายผ่านทั้งหมดตามจำนวนด้านบน ไม่แก้ business code หรือ assertions เพื่อกลบข้อผิดพลาดนี้.

## สิ่งที่ตรวจจากระบบจริงได้และไม่ได้

- ตรวจแบบอ่านอย่างเดียวได้ว่า health/OpenAPI ตอบ HTTP 200 ในรอบตรวจนี้ แต่ผลนี้ไม่ยืนยันข้อมูลโรงงานหรือ release SHA.
- หลังผู้ดูแลปรับ firewall TCP 1433 วันที่ 11 กันยายน 2026 เชื่อมต่อฐาน `poms` และรัน SELECT-only audit สำเร็จ รายละเอียดด้านล่าง.
- ไม่รัน backfill `--apply` หรือ migration บนฐาน production `poms`, ไม่แก้ผ่าน production API และไม่ deploy. การรันแบบเขียนทั้งหมดในรอบ SQL integration อยู่ในฐานสมมติที่ได้รับอนุมัติและลบแล้ว.
- ก่อนเปิด canonical ต้องทำตาม runbook: SQL Server integration tests, audit, จัดการ conflict ที่ยืนยันแล้ว, writer cutover และ authenticated smoke tests.

## ผลตรวจฐานข้อมูลจริง 11 กันยายน 2026

ตรวจรายละเอียดรอบนี้เวลา 17:39 น. (Asia/Bangkok) ด้วยเครื่องมือ dry-run หลังเพิ่ม validation ด้านล่าง; ผลตรวจซ้ำหลัง cleanup อยู่ท้ายหัวข้อ SQL integration. พอร์ต TCP 1433 และ login ใช้งานได้. SQL Server รายงานเวอร์ชัน `17.0.1000.7`, Standard Edition (64-bit), compatibility level 170. ไม่พิมพ์ credentials หรือค่าข้อมูลรายโรงงานลง log.

| สิ่งที่นับ | ผล |
| --- | ---: |
| โรงงานเข้าข่ายที่ยังไม่ลบ | 909 |
| โรงงาน POMS ตาม eligible ID ของจุด active | 12 |
| จุดตรวจวัด POMS ที่ยังไม่ลบ | 13 |
| แบบฟอร์มที่โรงงานเข้าข่ายผูกไว้ (distinct ID) | 907 |
| ความขัดแย้งด้านการเชื่อมรหัสโรงงาน | 0 |
| โรงงานที่ข้อมูลเข้าข่ายต่างจากแบบฟอร์มที่ผูก | 244 |
| โรงงานที่ผ่านเงื่อนไขสร้าง profile ในรายงานรอบนี้ | 665 |

คำว่า active ในรายงานนี้หมายถึง `deleted_at IS NULL`; ไม่ใช่การยืนยันสถานะการส่งข้อมูลของอุปกรณ์. จำนวน 13 คือจำนวนจุด ไม่ใช่จำนวนโรงงาน. ไม่ได้นับ Fac60k หรือเปรียบเทียบประวัติคำขอ.

ไม่พบ `CONNECTED_ELIGIBLE_MISMATCH` หรือ `CONNECTED_POINTS_MISMATCH` ในข้อมูลที่ตรวจ: ฟิลด์ทั่วไปร่วม 8 รายการ (ชื่อ, ที่อยู่, latitude, longitude, EIA assessment, EIA other, has EIA, ชื่อโครงการ) ตรงกันระหว่าง POMS กับโรงงานเข้าข่ายตามกติกาเปรียบเทียบของ audit. ผลนี้ไม่ยืนยันว่า writer/API เดิมทุกเส้นทางจะรักษาความตรงกันในการแก้ครั้งถัดไป.

ความต่างทั้ง 244 รายการเป็น `LINKED_FORM_MISMATCH` และกระทบ 244 eligible IDs ที่ไม่ซ้ำ:

| ฟิลด์ | จำนวนโรงงาน | ลักษณะที่พบ |
| --- | ---: | --- |
| ประเภทโรงงาน | 237 | ทั้งสองฝั่งมีค่า แต่ต่างกันหลัง normalize รหัสตาม domain |
| ที่อยู่ | 196 | ทั้งสองฝั่งมีค่า แต่ต่างกัน แม้ตัดความต่างด้านช่องว่างออก |
| ชื่อโครงการ | 3 | eligible มีค่า แต่แบบฟอร์มว่าง |
| EIA assessment | 4 | eligible มีค่า แต่แบบฟอร์มว่าง |
| latitude | 1 | eligible มีค่า แต่แบบฟอร์มว่าง |
| longitude | 1 | eligible มีค่า แต่แบบฟอร์มว่าง |

หนึ่งโรงงานอาจต่างหลายฟิลด์ จึงห้ามนำจำนวนในตารางมาบวกเป็นจำนวนโรงงาน. ยังไม่ได้ตัดสินว่าค่าฝั่งใดถูกต้อง และไม่ได้แก้ช่องว่าง/เติมค่า/ย้ายข้อมูลอัตโนมัติ.

ฐานจริงมี migration ล่าสุด `0113`; ยังไม่มี schema `0114`/`0115` หรือ profile ที่สร้างแล้ว. รายงานจึงเป็น `schemaReady=false`, `readyForCanonical=false`, `missingProfiles=909`, `insertedProfiles=0`. จำนวน 665 ที่ผ่าน audit ไม่ได้อนุญาตให้ apply บางส่วนข้าม conflict: เครื่องมือปฏิเสธ apply หากยังมี conflict ใดอยู่ทั้งชุด. การไม่มี schema ใหม่นี้เป็นสถานะก่อนเปิดใช้ ไม่ใช่หลักฐานว่าระบบ legacy เสีย.

SQL Server เปิด snapshot isolation และ read-committed snapshot ไว้เป็น OFF. Audit อ่านหลาย SELECT ต่อกัน จึงเป็นหลักฐาน ณ ช่วงเวลาตรวจ ไม่ใช่ consistent snapshot; ต้องรันซ้ำตาม runbook เมื่อควบคุม writer ก่อน cutover. ไม่ได้เปลี่ยน isolation settings.

### ตรวจเพิ่มก่อนใช้รายงานตัดสินความพร้อม

พบว่าการเท่ากันของสำเนายังไม่พอ หากทุกสำเนามีค่าที่ writer กลางไม่รองรับ. จึงเพิ่ม validation และ regression tests สำหรับพิกัดที่ขาดข้างหนึ่ง, EIA assessment/flag/other ที่ขัดกัน และชนิด JSON รูปภาพไม่ถูกต้อง. ใช้ `INVALID_PROFILE_VALUE` เดิมพร้อมชื่อฟิลด์ และเก็บค่าต้นฉบับโดยไม่ซ่อมอัตโนมัติ.

เพิ่ม 28 tests: RED 16 fail/57 pass ก่อนแก้ → GREEN 73/73 สำหรับ backfill; รวม CLI เป็น 2 suites/78 tests ผ่าน. Focused ESLint, backend Typecheck และ build ผ่านหลังแก้. ผลเต็ม 211 suites/2,243 tests ด้านบนเป็นรอบก่อนเพิ่ม 28 tests นี้; ไม่อ้างว่าได้รันชุดเต็มใหม่หลังเพิ่ม. Dry-run รุ่นล่าสุดกับฐานจริงได้ผล 244 conflicts ตามเดิมและไม่พบ `INVALID_PROFILE_VALUE`.

ภายหลังได้รับอนุมัติ ได้ทดสอบ migrations, rollback และ concurrent shared writers ในฐานสมมติที่แยกจาก `poms` ตามผลด้านล่าง. ยังต้องจัดทำรายการ reconciliation สำหรับ 244 โรงงานและตรวจตามขอบเขต schema/API จริงก่อนขออนุมัติเปลี่ยนข้อมูล production.

### การเตรียมฐานทดสอบที่ยังไม่มี

ตรวจเครื่อง local เป็น ARM64 และไม่พบ Docker/Podman/Colima/sqlcmd ใน PATH. ตรวจ metadata ของ SQL Server ยืนยันว่าชื่อ `poms_factory_profile_test` ยังไม่มีและบัญชีที่เชื่อมต่อมีสิทธิ์สร้างฐาน. เตรียม [สคริปต์ provision แบบ preview](../../../../backend/scripts/sql/create-factory-profile-test-database.sql) ตาม [ขั้นเตรียมฐานทดสอบ](../../guides/factory-profile-consistency-rollout.md).

รัน preview บน SQL Server สำเร็จด้วย `@PomsCreateApproved=0`: `created=false`, ไฟล์เริ่ม 48 MB/สูงสุด 768 MB และตรวจ `DB_ID` ก่อน/หลังเป็น null. นี่เป็นหลักฐานว่า preflight/preview ผ่าน ไม่ใช่หลักฐานว่า CREATE DATABASE, migrations หรือ integration tests ผ่าน. ในขั้น preview นี้ยังไม่ได้สร้างฐานใหม่; ภายหลังผู้ดูแลอนุมัติให้สร้าง ทดสอบ และลบเมื่อผ่านแล้วตามหัวข้อถัดไป. ตรวจ `git diff --check` และลิงก์เอกสารผ่าน.

## SQL Server integration และ cleanup ที่ดำเนินการแล้ว

ผู้ดูแลอนุมัติให้สร้างฐานทดสอบและลบเมื่อผ่าน. สร้าง `poms_factory_profile_test` เวลา 18:02 น. ทดสอบ 18:03 น. และลบเวลา 18:05 น. วันที่ 11 กันยายน 2026 (Asia/Bangkok). ใช้ SQL Server `17.0.1000.7` บน instance เดียวกับ production, collation `SQL_Latin1_General_CP1_CI_AS`, compatibility 170 และ snapshot settings OFF.

[สคริปต์ทดสอบ](../../../../backend/scripts/factory-profile-sql-verification.ts) ผ่าน **20/20 รายการ**. Run ID: `8f431319-efe6-4804-8177-1dca09f4391f`. ใช้ข้อมูลสมมติ 2 โรงงานเข้าข่าย, 2 จุด active, 1 จุดที่ลบแล้ว และ 1 แบบฟอร์ม พร้อมข้อมูลประวัติ/ทะเบียนสมมติสำหรับตรวจว่าไม่เปลี่ยน.

| กลุ่มที่ตรวจจริง | ผลที่ยืนยัน |
| --- | --- |
| Migrations 0114/0115 ผ่าน Knex | สร้าง tables/views/คอลัมน์ revision, down ตอนยังไม่มี canonical data และ up กลับสำเร็จ |
| Backfill | dry-run ไม่เขียน, conflict ปฏิเสธ apply, จำกัด batch, รันซ้ำไม่เพิ่มข้อมูล และ ready เฉพาะเมื่อครบ |
| SQL constraints และชนิดข้อมูล | unique/FK/check constraints ทำงาน, ภาษาไทยและ decimal 7 ตำแหน่งคงค่า |
| Writer ข้อมูลทั่วไป | profile, eligible, จุด active และแบบฟอร์มตรงกันใน transaction; จุดที่ลบแล้วและเวอร์ชันจุดไม่เปลี่ยน |
| Current views | canonical `null` ไม่ย้อนใช้ค่าค้างใน base table; no-op ไม่เพิ่ม revision หรือ audit |
| Rollback | exception หลัง writer และ constraint ที่ audit ล้มเหลว คืน profile/projections/audit ทั้งชุด |
| การเขียนพร้อมกัน | ใช้สอง SQL sessions จริงและเห็น lock wait ใน `sys.dm_exec_requests`; writer แรก commit, writer ที่สองถูกปฏิเสธ 409 เพราะ revision เก่า |
| ข้อมูลแยกส่วน | การเขียนเฉพาะตารางจุดไม่เปลี่ยน profile/eligible/form/history; ทะเบียนและ snapshot สมมติคงเดิม |
| Down หลังมี canonical data | ปฏิเสธด้วย 51142/51140 และยังคงข้อมูลกับ migration records ครบ |

ข้อความ `migration failed` ระหว่างกรณี down หลังมีข้อมูลเป็นผลที่คาดไว้และถูกตรวจรหัสข้อผิดพลาด ไม่ใช่ผลทดสอบล้มเหลว.

ชุด guard เริ่ม RED เพราะ module ยังไม่มี จากนั้นผ่าน 15/15 กรณี ตรวจชื่อฐานและ marker ที่ไม่ตรง, ไม่ fallback ไปใช้ DB config ของ application และปฏิเสธ settings ที่ไม่ครบ. หลังจัดรูปแบบ รันชุดที่เกี่ยวข้องรวม **5 suites / 120 tests ผ่าน** (รวม guard, backfill, CLI, repository และ migration unit tests); focused ESLint, format check และ CLI `--help` ผ่าน. TypeScript ของสคริปต์ถูกตรวจผ่านการ import ใน ts-jest; ไม่อ้างว่าได้รัน full suite ใหม่หลังเพิ่ม guard.

### ผลลบฐานทดสอบ

ใช้ [สคริปต์ cleanup](../../../../backend/scripts/sql/drop-factory-profile-test-database.sql) ตรวจ GUID ของฐานให้ตรงกับฐานที่สร้าง, purpose marker และ successful-run marker ก่อนลบ. ทดสอบส่ง GUID ผิดในโหมด preview แล้วถูกปฏิเสธ 51212 จากนั้น preview ที่ถูกต้องผ่านและจึงลบ. ไม่บังคับตัด connection และไม่ retry คำสั่งลบ.

- ฐานทดสอบถูกลบ: `dropped=true`, `DB_ID('poms_factory_profile_test')=NULL`.
- ไม่เหลือ file registrations ของ database ID เดิมใน `sys.master_files`: 0.
- ตรวจฐาน `poms` แบบอ่านอย่างเดียวหลัง cleanup: ONLINE, eligible 909 รายการ, จุด active 13 จุด, migration ล่าสุดยังเป็น `0113_create_poms_status_management.ts`.
- ไม่สร้าง login ใหม่, ไม่แก้ application environment, ไม่ start background jobs, ไม่ deploy หรือเปิด canonical ใน production.
- เก็บเฉพาะโค้ดทดสอบและหลักฐาน; ข้อมูลสมมติใน SQL ถูกลบไปกับฐานทดสอบแล้ว.

- รัน production dry-run ซ้ำเวลา 18:10 น.: eligible 909, POMS 12 โรงงาน/13 จุด, linked forms 907, conflict 244 รายการทั้งหมดเป็น `LINKED_FORM_MISMATCH`, `insertedProfiles=0`, `readyForCanonical=false`.

### ขอบเขตของผล SQL integration

ทดสอบ migrations ใหม่และ shared writer จริงกับ fixture schema เฉพาะตาราง/คอลัมน์ที่ต้องใช้ ไม่ใช่สำเนา schema production ทั้งหมดหรือการรัน migration ประวัติ 0001–0113. กรณี point-only เป็นการตรวจ storage isolation ด้วยการเขียนตารางจุดใน transaction; การอนุมัติผ่าน authenticated HTTP API และการตรวจสิทธิ์ทุก endpoint ยังต้องทำตาม runbook. ไม่ทดสอบโหลดขนาด production หรืออ้างว่า fixture ที่ชื่อ `fac_import` เป็นข้อมูล Fac60k จริง.

ผลผ่านนี้ไม่แก้ความต่าง 244 โรงงานใน production และไม่ทำให้ production `readyForCanonical` เป็น true. ยังต้องยืนยันค่าที่ถูกต้อง, ตรวจ schema/consumer compatibility, วางแผน cutover และรับอนุมัติก่อนเปลี่ยน production.

## ตรวจชุด release ก่อน push production

ผู้ดูแลสั่ง `push production` หลังตรวจข้อมูลและ SQL integration. Release นี้ส่งโค้ดพร้อม schema เพิ่มใหม่ 0114/0115 โดยคงค่าเริ่มต้น `FACTORY_PROFILE_MODE=legacy`; ไม่รัน backfill หรือเปิด canonical อัตโนมัติ.

- Fetch `origin/main` ล่าสุดแล้วตรงกับฐาน `ea87588479b40a9caf11888d590e26266cf81cee`; worktree มีเฉพาะงานนี้.
- ชุดสุดท้ายผ่าน **213 suites / 2,290 tests**, build และ typecheck. ESLint ผ่าน 49 ไฟล์ TypeScript ที่แก้ทั้งหมดโดยไม่มี warnings.
- เพิ่ม 4 กรณีตรวจ JavaScript ที่ workflow ใช้จริง: legacy ไม่โหลด DB, canonical ต้อง ready, มี conflict/missing profile ต้องหยุด และ audit error ต้องหยุดพร้อมปิด connection.
- ชุดทดสอบ release ครั้งแรกผ่านของเดิม 2,286 tests แต่เทส workflow ใหม่ compile ไม่ผ่านเพราะชนิด mock รับ arguments ไม่ตรง; แก้ชนิด mockและ lint warning แล้วรันรวมใหม่ผ่านครบตามจำนวนด้านบน. ไม่เปลี่ยน business assertions เพื่อข้ามข้อผิดพลาด.
- YAML workflow parse ผ่าน และ preflight อยู่หลัง migrations แต่ก่อนคัดลอก service files. Runtime preflight พิมพ์เฉพาะ mode และ readiness counts; ไม่พิมพ์ credentials.
- ตรวจไฟล์ 63 รายการแล้วไม่มีค่าของ production secrets ที่ใช้ตรวจพบอยู่ใน source; ไม่รวม `.env`, dependencies, dist หรือ runtime reports เข้า commit.
- สำรองฐาน `poms` บนเซิร์ฟเวอร์เดิมด้วย COPY_ONLY, CHECKSUM, COMPRESSION และ `RESTORE VERIFYONLY WITH CHECKSUM` ผ่านเวลา 18:25 น. วันที่ 11 กันยายน 2026. นี่เป็นการตรวจ backup ด้วย SQL Server ไม่ใช่การซ้อม restore production ทั้งระบบ.
- Baseline ก่อน push: `/health` และ `/api/v1/openapi.json` ตอบ 200; protected factory routes ตอบ 401. Migration production ก่อน release ยังเป็น 0113 และไม่มี canonical profiles.

ผล deployment ต้องตรวจจาก GitHub Actions run ที่ตรงกับ commit พร้อม production schema/health/OpenAPI หลัง push; รายการนี้บันทึกผลตรวจเตรียม release ไม่อ้างว่า deploy ผ่านล่วงหน้า.

## Documentation impact

- Docs impact: updated
- Canonical docs: สามหน้า API ที่ลิงก์ด้านบนและ [API changelog](../../api/CHANGELOG.md)
- Reason: เปลี่ยนแหล่งข้อมูลทั่วไปปัจจุบัน การป้องกัน stale writes และพฤติกรรม validation เมื่อเปิด canonical
- Client impact: คงรหัสและ payload เดิม; optional `eiaOther`, ข้อมูลปัจจุบัน/ประวัติแยกตาม contract และต้องรองรับ `409`/ขั้นส่งแบบใหม่ตามเอกสาร
- Breaking change: yes เมื่อเปิด canonical ตามขั้น cutover; ดูเงื่อนไขใน changelog. ค่าเริ่มต้นยังเป็น legacy.
