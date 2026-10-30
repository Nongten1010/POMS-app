# แก้ชื่ออำเภอและตำบลที่แสดงเป็นตัวเลข

สัญญาปัจจุบัน: [โรงงานเข้าข่าย](../../api/menus/eligible-factories/README.md#ชื่ออำเภอและตำบลในที่อยู่) และ [ข้อมูล current/live และฟอร์ม POMS](../../api/menus/master-data/factory-edit-requests.md#ชื่ออำเภอและตำบลในที่อยู่)

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

## ชื่อโรงงานที่ดูไม่เต็มบนหน้าจอ

ข้อมูลและ service ของโรงงานเป้าหมายมีชื่อเต็มตรงทะเบียนต้นทาง ไม่พบการตัดชื่อใน backend mapper. หน้าแผนที่ใช้ `whiteSpace: nowrap`, `overflow: hidden` และ `textOverflow: ellipsis` สำหรับชื่อรายการ จึงแสดง `...` ตามความกว้าง ส่วนฟอร์มคำขอใช้ช่องชื่อแบบบรรทัดเดียว. งานนี้ตรวจหาสาเหตุและไม่ได้แก้ frontend

Implementation: [formatter](../../../../backend/src/modules/eligible-factories/factory-address.ts), [source lookup](../../../../backend/src/modules/eligible-factories/eligible-factory-source-hydration.ts), [POMS service](../../../../backend/src/modules/poms-factories/poms-factories.service.ts), [migration](../../../../backend/src/db/migrations/0150_repair_factory_address_names.ts), [regression tests](../../../../backend/tests/unit/factory-address-names.test.ts), [migration tests](../../../../backend/tests/unit/factory-address-names.migration.test.ts)
