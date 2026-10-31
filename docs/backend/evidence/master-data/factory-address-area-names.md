# แก้ชื่ออำเภอและตำบลที่แสดงเป็นตัวเลข

สัญญาปัจจุบัน: [โรงงานเข้าข่าย](../../api/menus/eligible-factories/README.md#ชื่ออำเภอและตำบลในที่อยู่) และ [ข้อมูล current/live และฟอร์ม POMS](../../api/menus/master-data/factory-edit-requests.md#ชื่ออำเภอและตำบลในที่อยู่)

ผล production ล่าสุดวันที่ 30 ตุลาคม 2026: deploy การป้องกันข้อมูลใหม่และรัน `0151/0152` ซ่อมข้อมูลประวัติครบ 18 แถวแล้ว พร้อม backup. ผลตรวจเวลา 17:58:28 น. `Asia/Bangkok` ไม่พบชื่อพื้นที่เป็นตัวเลขทั้งรายการ active และประวัติในขอบเขตที่ตรวจ และยืนยันที่อยู่โรงงาน `82250600225587` เป็น **ตำบลมาบยางพร อำเภอปลวกแดง** จากฐานและ deployed service; ไม่ใช่การยืนยันหน้าจอ browser. ดู [deployment สำเร็จ](https://github.com/Nongten1010/POMS-app/actions/runs/41043404448) และ [ผลตรวจฐานจริงหลัง deploy](https://github.com/Nongten1010/POMS-app/actions/runs/41044627551)

## สาเหตุและการแก้

โหมด `canonical` ข้ามการ hydrate ที่อยู่ทั้งหมด ส่วน POMS คืน `factory_address` ที่เก็บไว้โดยตรง จึงยังแสดง `ตำบล5 อำเภอ6` แม้มีชื่อในทะเบียนพื้นที่. โหมดเดิมยังสร้างที่อยู่ใหม่จากต้นทางจนรายละเอียดเพิ่มเติม เช่น `(ประตู 2)` หาย

ตัวแก้ใช้ FID/เลขทะเบียนเลือกโรงงาน และ `PROV + AMP + TUMBOL` เลือกชื่อจากทะเบียนพื้นที่. แทนเฉพาะป้ายที่เป็นตัวเลขเมื่อรหัสตรงกัน รักษาข้อความส่วนอื่น และไม่เติมที่อยู่ `null` ใน `canonical`. POMS list lookup เป็น batch เฉพาะรายการที่เป็นตัวเลข; ที่อยู่ที่อ่านได้ไม่เพิ่ม external query. การแสดงผลแยกจาก snapshot ที่ใช้ตรวจความเปลี่ยนแปลงใน write workflow จึงไม่บันทึก fallback กลับฐานข้อมูลหรือทำให้การเปรียบเทียบ snapshot ผิด

## ขอบเขตข้อมูลเก่า

Migration `0149` สร้าง `factory_address_names_repair_backup_0149`; `0150` ตรวจชื่อทั้งหมดก่อนเขียน และแก้แต่ละโรงงานใน transaction เดียวตามลำดับ eligible → profile → connected points → form → request:

| ตาราง | เงื่อนไข |
| --- | --- |
| `eligible_factories` | active และมีป้ายพื้นที่ตัวเลข |
| `factory_profiles` | ผูกกับ eligible ที่ active และมีป้ายพื้นที่ตัวเลข |
| `cems_wpms_connected_measurement_points` | active และผูก eligible ที่ active |
| `factory_monitoring_point_forms` | active รวมฟอร์มที่ยังไม่ผูก eligible |
| `cems_wpms_connection_requests` | active และสถานะไม่ใช่ `CANCELED`/`REJECTED` |

ทุกแถวเปรียบเทียบที่อยู่เดิมก่อนอัปเดต ป้องกันเขียนทับการแก้พร้อมกัน; profile เปรียบเทียบ revision เพิ่มอีกชั้น เพิ่ม revision และเก็บ full before/after ใน `factory_profile_events`. คง timestamp ของ connected points เพื่อไม่เปลี่ยนการเลือก current profile ในโหมดเดิม. เก็บ backup ทุกแถวที่เปลี่ยน; ไม่แก้ `factories`, ทะเบียนต้นทาง, snapshot JSON หรือ event เก่า. รันซ้ำหลังซ่อมสำเร็จไม่เปลี่ยนแถวที่อ่านได้แล้ว; หากโรงงานใดเปลี่ยนพร้อมการซ่อม transaction ของโรงงานนั้นยกเลิกและต้องตรวจแล้วรันใหม่

เมื่อหาโรงงาน/ชื่อไม่พบ รหัสไม่ตรง หรืออ่านต้นทางไม่ได้ migration ไม่เดาชื่อและไม่ใช้ fallback ของหน้าจอเป็นค่าที่จัดเก็บ. ไม่มีการ down ข้อมูลกลับเป็นตัวเลข; backup คงไว้สำหรับ forward recovery ที่ตรวจแล้ว

## การตรวจใน workspace

ชุด regression จำลองอาการเดิมผ่าน hydration และ POMS service จริง พร้อม stub เฉพาะแหล่งข้อมูล. ก่อนแก้พบ 8 กรณีล้มเหลวจากที่อยู่ตัวเลขและรายละเอียดที่อยู่หาย. ชุด migration ใช้ Knex MSSQL compiler ตรวจ parameter bindings, เงื่อนไข concurrent update, backup และ canonical event

```bash
cd backend
npm run typecheck
npm test -- --runInBand tests/unit/factory-address-names.test.ts tests/unit/factory-address-names.migration.test.ts tests/unit/eligible-factories.repository.test.ts tests/unit/poms-factories.service.test.ts tests/unit/poms-factories.openapi.test.ts
```

ผลตรวจ: ชุดที่เกี่ยวข้อง 9 suites / 165 tests ผ่าน รวม formatter, address storage/backfill เดิม และ canonical repository. `npm run typecheck`, ESLint ของไฟล์ TypeScript ที่แก้โดยไม่ยอมรับ warning, `git diff --check` และการตรวจ relative links ของเอกสารที่แก้ผ่าน; evidence ใหม่นี้เข้าถึงได้จาก backend hub ผ่าน evidence index. Repository มี specification ของ docs guard แต่ยังไม่มี executable guard ให้รัน จึงตรวจ placement, links และ reachability สำหรับเอกสารชุดนี้โดยตรง

## การตรวจชุด release

แยก worktree จาก `origin/main` ที่ `a50dd883c320bdc507d034088246ae3f49d05e8d` และนำเฉพาะงานแก้ชื่อพื้นที่ 16 ไฟล์เข้าชุด release. Build, typecheck และ ESLint ผ่าน; tests ทั้ง backend 382 suites / 5,107 tests ผ่าน โดยข้าม 2 suites / 18 integration tests ที่ต้องเปิดใช้ฐานทดสอบแยก. ปรับ test canonical เดิมให้ยังรักษา null/ชื่อที่อ่านได้ แต่ยอมซ่อมป้ายพื้นที่ตัวเลขตาม contract ใหม่

[Production checkout inspection](https://github.com/Nongten1010/POMS-app/actions/runs/41012971099) ยืนยัน server HEAD เดียวกับฐาน release และ `trackedChanges=[]` ก่อน deploy โดยยังไม่เขียนฐานข้อมูลหรือ restart service

## ผลยืนยันบน production

Deploy สำเร็จวันที่ 30 ตุลาคม 2026 เวลา 13:27 น. (`Asia/Bangkok`) ผ่าน [PR #34](https://github.com/Nongten1010/POMS-app/pull/34), release SHA `a21d02ea89ebdb4c4e05eaaae7ae4407d41b611c` และ [deployment run 41013533178](https://github.com/Nongten1010/POMS-app/actions/runs/41013533178). Tests บน Windows production runner ผ่าน 382 suites / 5,107 tests และข้าม 18 integration tests; migration batch `122` รันเฉพาะ `0149` และ `0150` สำเร็จ 2 รายการ. Service health เป็น `ok`; `/api/v1/openapi.json` ตอบ `200` และ field descriptions ใน `PomsFactoryProfile`, `PomsFactoryForm` และ `PomsFactoryEditRequestForm` ตรงกับ source ของ release

[Read-only production verification run 41014579726](https://github.com/Nongten1010/POMS-app/actions/runs/41014579726) ตรวจทะเบียน `82250600225587` บนฐานและ deployed service จริง โดยไม่สร้างบัญชีหรือ token และไม่แก้ข้อมูลเพิ่มเติม:

| รายการ | ผลที่ยืนยัน |
| --- | --- |
| ชื่อโรงงาน | `บริษัท อมตะ บี.กริม เพาเวอร์ (ระยอง) 5 จำกัด` ตรงกับ `Fac60k.FNAME` และชื่อที่คืนใน service ฟอร์มคำขอทั้งสองรายการ |
| ทะเบียนพื้นที่ | `PROV=21`, `AMP=6`, `TUMBOL=5` คืน `AMPNAME=ปลวกแดง`, `TUMNAME=มาบยางพร` |
| โรงงานเข้าข่าย | `eligible_factories.id=430` เก็บที่อยู่ชื่อจริงแล้ว |
| แบบฟอร์มข้อมูลจุดตรวจวัด | `factory_monitoring_point_forms.id=426` เก็บที่อยู่ชื่อจริงแล้ว |
| ฟอร์มคำขอ CEMS | `10376` / `CEMS-0254/2569` และ `10377` / `CEMS-0255/2569` ทั้งค่าที่จัดเก็บและ `connectionRequestsService.getForm` คืนชื่อพื้นที่ถูกต้อง |
| Backup | สำรองก่อนแก้รวม 16 แถวทั้ง migration; สำหรับโรงงานนี้มี 4 แถวที่ยืนยัน before/after ตรงกัน |
| Mode จริง | `legacy`; `canonical` ผ่าน regression tests โดยไม่ได้เปลี่ยน config production |

ที่อยู่ที่ยืนยันตรงกันทุกจุดข้างต้น:

```text
7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140
```

โรงงานนี้ยังมีคำขอสถานะ `WAITING_CONNECTION`, ไม่มี active `cems_wpms_connected_measurement_points` และยังไม่มี `factory_profiles` ของตัวเอง จึงตรวจ service ฟอร์มคำขอจริงแทนการอ้างว่าได้ทดสอบ POMS connected form สำหรับโรงงานนี้. ไม่ได้ยืนยันหน้าจอฟอร์มด้วยบัญชี browser เพราะบัญชีที่มีอยู่ไม่แสดงเมนูโรงงาน; หลักฐานข้างต้นเป็น database values, backups และ deployed internal read service เดียวกับ controller ของ endpoint

## ผลสแกนทั้งระบบก่อนซ่อมข้อมูลประวัติ

[Production audit run 41030444601](https://github.com/Nongten1010/POMS-app/actions/runs/41030444601) สแกนทั้งรูปแบบ `ตำบล5 อำเภอ6`, รูปย่อ, เลขไทย และช่อง `district_name`/`subdistrict_name` ที่มีใน schema. ตรวจตารางจริงและ views ของ `canonical` แยกกัน; ไม่เปลี่ยน mode production ซึ่งยังเป็น `legacy`

| แหล่งข้อมูล | แถวที่ใช้งานและอ่านได้ | แถวใช้งานที่เป็นตัวเลข | แถวประวัติที่เป็นตัวเลข |
| --- | --- | --- | --- |
| `eligible_factories` | 934 | 0 | 10 ที่ถูกลบ |
| `factory_profiles` | 0 | 0 | 0 |
| `cems_wpms_connected_measurement_points` | 37 | 0 | 0 |
| `factory_monitoring_point_forms` | 924 | 0 | 6 ที่ถูกลบ |
| `current_eligible_factories` | 934 | 0 | 10 เดียวกับตารางจริง |
| `current_connected_measurement_points` | 37 | 0 | 0 |
| `current_factory_monitoring_point_forms` | 924 | 0 | 6 เดียวกับตารางจริง |
| `cems_wpms_connection_requests` | 313 ที่อ่านได้ | 0 | 2 `CANCELED` |
| `cems_wpms_request_factory_snapshots` | 313 ที่อ่านได้ | 0 | 0 |

รายการที่ต้องซ่อมเพิ่มจริงมี 18 แถว ไม่ใช่ 34 แถว: ตัวเลขที่ซ้ำใน current views คือแถวเดียวกับ base table. ผู้ใช้อนุมัติให้ซ่อมทั้ง 18 แถวโดยคงสถานะลบ/ยกเลิกไว้. จับคู่ชื่อทั้งหมดได้จากจังหวัดและรหัสพื้นที่ในแต่ละแถวกับ `TUMBOL.PROV + AMP + TUMBOL`; ไม่ใช้ตำแหน่งปัจจุบันของโรงงานมาแทนที่อยู่ในประวัติ. ตัวอย่างจังหวัดอ่างทองรหัส `15`, อำเภอ `1`, ตำบล `11` ตรงกับ `เมืองอ่างทอง` / `โพสะ`

Migrations [0151](../../../../backend/src/db/migrations/0151_create_historical_address_repair_backup.ts) และ [0152](../../../../backend/src/db/migrations/0152_repair_historical_factory_address_names.ts) แยกสร้าง backup ออกจากการซ่อม. `0152` มี frozen manifest 18 แถว ตรวจชื่อกับทะเบียนพื้นที่ก่อนเขียน ตรวจ ID/เลขทะเบียน/ที่อยู่/สถานะเดิม และซ่อมแบบ transaction ต่อโรงงาน. บันทึกก่อน/หลังใน `factory_address_history_repair_backup_0151`; เปลี่ยนเฉพาะ `address`, ไม่แก้ `deleted_at`, สถานะ, timestamp, `factories`, profile revision, snapshot JSON หรือ event เก่า. รันซ้ำไม่สร้าง backup ซ้ำหรือเขียนทับแถวที่เปลี่ยนหลัง audit

รอบแรกใช้ `READPAST` เฉพาะคำขอและ factory snapshots เพราะมี transaction ของ backend ค้างและมีแถวที่อ่านไม่ได้; จึงยังไม่ถือเป็นผลสแกน committed ครบทุกแถวในเวลานั้น. ป้าย `DELETE` ในตัวตรวจเดิมใช้ substring ซึ่งอาจตรงกับชื่อคอลัมน์ `deleted_at` จึงไม่ใช่หลักฐานว่ามีคำสั่งลบจริง

ผลตรวจแบบอ่านอย่างเดียวต่อมาเวลา 16:18–16:32 น. `Asia/Bangkok`:

- [Session identity](https://github.com/Nongten1010/POMS-app/actions/runs/41032450072) พบ session เดิมของ backend PID `5036` สิ้นสุดแล้ว และหมายเลข `87` ถูกใช้ใหม่โดย Apache HTTP Server PID `9876` ตั้งแต่ 16:17:34 โดยไม่มี open transaction; ไม่ยกเลิก session ใหม่โดยอ้างหมายเลขเก่า
- [Committed scan](https://github.com/Nongten1010/POMS-app/actions/runs/41032969173) ไม่พบ transaction เดิมหรือ blocking request ของฐาน POMS และ backend connections ที่พบไม่มี open transaction. อ่านทั้ง 9 ตาราง/views แบบ committed ปกติ โดยไม่ใช้ `READPAST`/`NOLOCK`: คำขอ 383 แถว, factory snapshots 654 แถว. พบค่าตัวเลขเฉพาะ 18 base rows เดิม; แถวที่ซ้ำใน current views ไม่ใช่รายการซ่อมเพิ่ม
- [Safe error details](https://github.com/Nongten1010/POMS-app/actions/runs/41033723397) พบ log เวลา 15:17:00 จาก `POST /api/v1/cems-wpms-requests/measurement-points` ว่า rollback ถูกปฏิเสธเพราะยังมี request in progress และมี original SQL error `208`. Log ไม่เก็บ session ID, เลขคำขอหรือค่าพารามิเตอร์ จึงยังไม่ยืนยันว่าเป็นต้นเหตุของ session เดิมหรือระบุชุดรายการก่อน/หลังได้ครบ
- [Cleanup receipts](https://github.com/Nongten1010/POMS-app/actions/runs/41034111400) ไม่พบ receipt การล้างค่าตรวจวัดหรือ cleanup error log ของฐาน POMS นี้ระหว่าง 15:15–16:18 น.; ไม่ใช้ผลนี้รับรองว่าข้อมูลทุกประเภทไม่เคยเปลี่ยน

การตรวจดังกล่าวไม่ได้ `KILL`, rollback, restart, deploy หรือรัน data migration. การไม่พบ session เดิมไม่ได้พิสูจน์ว่าจบด้วย commit หรือ rollback และยังไม่ทราบชุดการเปลี่ยนแปลงย้อนหลังทั้งหมด. ปัญหาวงจร transaction แยกจากการแปลงชื่อพื้นที่; latest main มี [หลักฐานการแก้ transaction lifecycle](../connection-requests/transaction-lock-recovery.md) ของ PR #37 แล้ว

Tests ของ migration: [historical-factory-address-repair.test.ts](../../../../backend/tests/unit/historical-factory-address-repair.test.ts) ตรวจทั้งสองโหมด การคงสถานะเดิม การเปลี่ยนพร้อมกัน การรันซ้ำ และการหยุดก่อนเขียนเมื่อชื่อพื้นที่ไม่ตรงทะเบียน

## ป้องกันข้อมูลใหม่และผล release 0151/0152

แพตช์รอบนี้เพิ่ม shared normalization ก่อนบันทึกข้อมูลทั่วไปที่แก้ไขได้ และก่อนแสดง address/ชื่อพื้นที่ ทั้ง `legacy` และ `canonical`. แปลงเฉพาะป้ายหรือช่องชื่อที่เป็นตัวเลขเมื่อจับคู่จังหวัด+อำเภอ+ตำบลกับ `TUMBOL` ได้อย่างไม่กำกวม; รักษาเลขบ้าน หมู่ ซอย ถนน รหัสไปรษณีย์ ช่องรหัส ชื่อที่อ่านได้ และ null ตาม contract เดิม. รหัสไม่ตรง/ไม่พอระบุชื่อให้หยุดก่อนเขียนด้วย `400 BAD_REQUEST`, `details.reason = UNRESOLVED_ADMINISTRATIVE_AREA`; แหล่งทะเบียนขัดข้องตอบ `503 FACTORY_AREA_LOOKUP_UNAVAILABLE`. GET ไม่เขียนกลับฐานหรือประวัติ ส่วน POMS edit snapshots ที่กำหนดอ่านอย่างเดียวคงกติกาเดิม ดู [contract ร่วม](../../api/menus/eligible-factories/README.md#ป้องกันรหัสตัวเลขในข้อมูลที่บันทึกใหม่)

Release SHA `167679a69b0cea9f0e6c54f58f2be4b9d3727379` จาก [PR #36](https://github.com/Nongten1010/POMS-app/pull/36) และ [PR #38](https://github.com/Nongten1010/POMS-app/pull/38) deploy สำเร็จผ่าน [run 41043404448](https://github.com/Nongten1010/POMS-app/actions/runs/41043404448). Windows runner ผ่าน tests ทั้ง backend 388 suites / 5,222 tests โดยข้าม 18 integration tests ที่ต้องเปิดใช้แยก; service health เป็น `ok` เวลา 17:54:51 น. `Asia/Bangkok`

[Preflight](https://github.com/Nongten1010/POMS-app/actions/runs/41039452892) และ [การตรวจยืนยันก่อน deploy](https://github.com/Nongten1010/POMS-app/actions/runs/41039935122) รวม [preflight รอบสุดท้ายก่อนปล่อย](https://github.com/Nongten1010/POMS-app/actions/runs/41043260595) ยืนยัน manifest เดิม 18/18 แถวและไม่พบ open Knex transaction/blocking request. Migrations `0151_create_historical_address_repair_backup.ts` และ `0152_repair_historical_factory_address_names.ts` รันสำเร็จใน batch `123` เวลา 17:54:37 และ 17:54:38 น. ตามลำดับ

[Read-only verification run 41044627551](https://github.com/Nongten1010/POMS-app/actions/runs/41044627551) เวลา 17:58:28 น. ยืนยัน:

- `factory_address_history_repair_backup_0151` มี 18 แถวพอดี: `eligible_factories` 10, `factory_monitoring_point_forms` 6 และ `cems_wpms_connection_requests` 2. ที่อยู่หลังแก้ตรงกับ manifest ทุกแถว
- เปรียบเทียบ SHA-256 ของทุกคอลัมน์ที่ไม่ใช่ `address` ก่อน/หลังทั้ง 18 แถว ไม่พบค่าต่าง; ตรวจ `DATETIME2` ของ `deleted_at` แบบเต็มความละเอียดและสถานะเดิมตรงกัน. แถวที่ถูกลบยังถูกลบ และคำขอที่ยกเลิกยังเป็น `CANCELED`
- สแกน 9 ตาราง/views ที่จำเป็นและ `eligible_factory_add_requests` เพิ่มเติมด้วย committed read ปกติ ไม่ใช้ `READPAST`/`NOLOCK`: พบป้าย/ช่องชื่อพื้นที่ที่เป็นตัวเลข **0 active / 0 historical**. ตรวจทั้งป้ายเต็ม รูปย่อ เลขไทย และช่องชื่อที่มีใน schema

จำนวนแถว ณ เวลาสแกนหลัง deploy:

| แหล่งข้อมูล | แถวทั้งหมด | Active | ชื่อพื้นที่เป็นตัวเลข active / historical |
| --- | --- | --- | --- |
| `eligible_factories` | 956 | 934 | 0 / 0 |
| `factory_profiles` | 0 | 0 | 0 / 0 |
| `cems_wpms_connected_measurement_points` | 37 | 37 | 0 / 0 |
| `factory_monitoring_point_forms` | 938 | 924 | 0 / 0 |
| `current_eligible_factories` | 956 | 934 | 0 / 0 |
| `current_connected_measurement_points` | 37 | 37 | 0 / 0 |
| `current_factory_monitoring_point_forms` | 938 | 924 | 0 / 0 |
| `cems_wpms_connection_requests` | 388 | 318 | 0 / 0 |
| `cems_wpms_request_factory_snapshots` | 664 | 318 | 0 / 0 |
| `eligible_factory_add_requests` | 7 | 7 | 0 / 0 |

Current views เป็นมุมอ่านของข้อมูลเดียวกับ base tables จึงไม่รวมเป็นจำนวนแถวที่ซ่อมซ้ำ. ผลนี้ตรวจปัญหาชื่อพื้นที่ที่เป็นตัวเลข ไม่ใช่การตรวจความถูกต้องทางภูมิศาสตร์ของข้อความที่อยู่ทุกแถว

สำหรับโรงงานทะเบียน `82250600225587`, `eligible_factories.id=430`, แบบฟอร์ม `426` และคำขอ `10345`, `10346`, `10376`, `10377` เก็บชื่อโรงงานเต็ม `บริษัท อมตะ บี.กริม เพาเวอร์ (ระยอง) 5 จำกัด` และที่อยู่ `7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140` ถูกต้อง. สถานะคำขอ `10345/10346` ยังคง `CANCELED`; `10376/10377` ยังคง `WAITING_CONNECTION`

Deployed `connectionRequestsService.getForm` ของ `10376/10377` คืนชื่อโรงงานเต็มและ `address` ดังกล่าวทั้ง `legacy` และ `canonical` ใน audit process. ช่องแยก `districtName` และ `subdistrictName` ของ snapshot คำขอเก่าเหล่านี้ยังเป็น `null` ตามเดิม; ไม่ได้เติมชื่อให้ช่อง null และไม่อ้างว่าช่องดังกล่าวถูก backfill. Config production ยังคง `legacy`; เปลี่ยน mode เฉพาะใน process ตรวจสอบ ไม่ได้สลับบริการจริงหรือยืนยันหน้าจอด้วย browser

เรียก deployed [shared normalizer](../../../../backend/src/modules/eligible-factories/factory-area-names.ts) แบบไม่บันทึกข้อมูลด้วยตัวอย่างป้าย/ช่องชื่อที่เป็นรหัส: ได้ `ปลวกแดง` / `มาบยางพร` ทั้งสองโหมด โดยรักษา internal `provinceCode=1021`; รหัส `999` ถูกปฏิเสธด้วย `400 BAD_REQUEST`, `reason = UNRESOLVED_ADMINISTRATIVE_AREA`. การตรวจหลัง deploy ไม่มี database mutation เพิ่มเติม. [Runtime OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) ตอบ `200` และตรวจพบ 400/503 contract ของ 10 write operations พร้อมคำอธิบายการรักษาเลขบ้าน/ถนนตรง source

[Deployment รอบแรก 41041800714](https://github.com/Nongten1010/POMS-app/actions/runs/41041800714) ถูกยกเลิกก่อนหยุดบริการหรือรัน migrations เพื่อแก้ขอบเขตคำบนชื่อถนนใน PR #38. [Audit รอบแรก 41044239342](https://github.com/Nongten1010/POMS-app/actions/runs/41044239342) ล้มเพราะข้อความไทยใน PowerShell ของชุดตรวจถูกแปลงอักขระ; แก้เฉพาะชุดตรวจเป็น ASCII escapes แล้วรันซ้ำสำเร็จ ไม่ใช่การแก้แอปหรือข้อมูล production เพิ่มเติม

Tests เพิ่มเติม: [shared normalization](../../../../backend/tests/unit/factory-area-names.test.ts), [request writes](../../../../backend/tests/unit/connection-request-area-writes.test.ts), [request reads](../../../../backend/tests/unit/connection-request-area-reads.test.ts) และ [runtime OpenAPI](../../../../backend/tests/unit/factory-area-names.openapi.test.ts) ตรวจค่าตัวเลข รหัสผิด การอ่านทะเบียนไม่ได้ การรักษาข้อความที่อยู่/ช่องรหัส และ error schemas ทั้งกรณีใหม่และ measurement cleanup เดิม

## การเติมช่องชื่อพื้นที่ว่างในแพตช์ถัดจาก release 0151/0152

ผลตรวจ release วันที่ 30 ตุลาคมในหัวข้อก่อนหน้ายืนยัน `address` ถูกต้อง แต่ `districtName` และ `subdistrictName` ใน snapshot คำขอ `10376/10377` ยังเป็น `null`; ไม่ใช่หลักฐานว่าช่องชื่อแยกถูกเติมแล้ว. แพตช์รอบถัดไปเพิ่มการเติมเฉพาะ `provinceName`, `districtName` และ `subdistrictName` ที่มี property เดิมและยังว่าง จากพื้นที่ที่บันทึกใน address/รหัส/ชื่อเดิมซึ่งตรวจยืนยันกับทะเบียนได้

การเติมชื่อว่างไม่ใช้ตำแหน่งปัจจุบันของ Fac60k แม้ทราบ identity โรงงาน เพื่อรักษาสถานที่ในประวัติ; การ fallback ของตัวแก้ป้ายตัวเลขเดิมยังคงตาม contract เดิม. กรณีทราบเพียงจังหวัดและไม่มีข้อมูลท้องถิ่น เติมได้เฉพาะจังหวัดจาก mapping ที่ยืนยันได้. เมื่อมีข้อมูลอำเภอ/ตำบล ต้องมีแถวทะเบียนตรงกับ context ทั้งหมดก่อน; หากขัดแย้งหรือไม่มีแถวตรงให้คงชื่อว่างทั้งหมดแม้พอระบุจังหวัดได้. เมื่อมีหลายแถวที่ตรงกัน ชื่อเติมแยกตามความไม่กำกวม จึงอาจเติมจังหวัดและอำเภอได้แต่ตำบลยังว่าง. ข้อมูลไม่พอหรือชื่อยังกำกวมให้คงช่องนั้นว่าง; read lookup ขัดข้องคงว่าง. ไม่เพิ่ม DTO field ที่ไม่มีเดิม ไม่เปลี่ยนรหัส ชื่อที่อ่านได้ เลขบ้าน/หมู่/ซอย/ถนน/ไปรษณีย์ หรือ `address = null`. Numeric writes ยังคง error 400/503 เดิม; การเขียนช่องชื่อว่างที่มีรหัสหรือชื่อใน address ระบุพื้นที่เดิมได้ชัดเจนและต้องอ่านทะเบียนแต่ต้นทางขัดข้องตอบ 503 เช่นเดียวกัน

[Production preflight 41154352573](https://github.com/Nongten1010/POMS-app/actions/runs/41154352573) และ [การตรวจประวัติเพิ่มเติม 41154660971](https://github.com/Nongten1010/POMS-app/actions/runs/41154660971) วันที่ 31 ตุลาคม 2026 ตรวจแบบอ่านอย่างเดียวพบ snapshot ที่ยังไม่ถูกลบ 391 แถว ซึ่งที่อยู่ที่บันทึกไว้มีชื่อพื้นที่เพียงพอให้ตรวจและเติมช่องชื่อแยกได้. Snapshot active `10639/10640` ของคำขอ `10377/10376` ของโรงงานเป้าหมายอยู่ในขอบเขตนี้. จำนวน 391 เป็นผลคาดหมายจาก preflight ไม่ใช่จำนวนที่อ้างว่า migration รันสำเร็จแล้ว

Snapshot ที่ถูกลบ 276 แถวมีเพียงจังหวัด โดยไม่มีรหัส/ที่อยู่ท้องถิ่นของตัวเองที่พอพิสูจน์ได้ และแบบฟอร์มทดสอบ `4/15` ว่างโดยตั้งใจ ไม่ผูก eligible และไม่พบ exact source match. ไม่พบประวัติที่อยู่คำขอที่ยืนยันได้จาก history notes หรือ linked JSON; backup `0149` ของคำขอ `10376/10377` มีอยู่ แต่เวลาเขียนแบบ UTC เทียบกับเวลาลบไม่ใช่หลักฐานว่าที่อยู่ตรงกับ historical snapshot แต่ละแถว. จึงคงชื่อท้องถิ่นที่พิสูจน์ไม่ได้ว่างไว้ ไม่ใช้ที่อยู่ปัจจุบันมาเติม และไม่อ้างว่ารู้ชื่อครบทุกแถว

เตรียม migrations `0153/0154` แยก backup schema ออกจากการเติมชื่อที่ยืนยันได้ โดยเก็บค่าก่อน/หลังและรักษารหัสกับข้อมูลอื่น; ต้องยืนยันจำนวนที่แก้จริงและผล preservation หลัง deploy. ตัวอย่าง response fields และ fallback อ้าง [contract ร่วม](../../api/menus/eligible-factories/README.md#ป้องกันรหัสตัวเลขในข้อมูลที่บันทึกใหม่). หลักฐาน production ของการเติมชื่อว่างยังต้องยืนยันหลัง deploy แพตช์นี้แยกจากผลการซ่อม 18 แถวด้านบน; ไม่ใช้ผล release `0151/0152` อ้างว่าช่อง null ถูกเติมแล้ว และไม่อ้างว่าได้สลับ config production เป็น canonical หรือยืนยันหน้าจอ browser

## การแสดงชื่อโรงงานบนหน้าจอ

ข้อมูลและ service ของโรงงานเป้าหมายมีชื่อเต็มตรงทะเบียนต้นทาง ไม่พบการตัดชื่อใน backend mapper. หน้าแผนที่ใช้ `whiteSpace: nowrap`, `overflow: hidden` และ `textOverflow: ellipsis` สำหรับชื่อรายการ จึงแสดง `...` ตามความกว้าง ส่วนฟอร์มคำขอใช้ช่องชื่อแบบบรรทัดเดียว. งานนี้ตรวจหาสาเหตุและไม่ได้แก้ frontend

Implementation: [formatter](../../../../backend/src/modules/eligible-factories/factory-address.ts), [source lookup](../../../../backend/src/modules/eligible-factories/eligible-factory-source-hydration.ts), [POMS service](../../../../backend/src/modules/poms-factories/poms-factories.service.ts), [migration](../../../../backend/src/db/migrations/0150_repair_factory_address_names.ts), [regression tests](../../../../backend/tests/unit/factory-address-names.test.ts), [migration tests](../../../../backend/tests/unit/factory-address-names.migration.test.ts)
