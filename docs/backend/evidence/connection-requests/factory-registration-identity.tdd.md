# เลขทะเบียนใหม่และเลขเดิมในคำขอเชื่อมต่อ

สนับสนุน [contract คำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#factory-registration-identity) และ [contract โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md#selection-registration-numbers). หลักฐานการตรวจ production เป็นข้อมูล ณ 6 ตุลาคม 2026; ไม่ยืนยัน payload ที่ส่งตอนสร้างคำขอในอดีต และไม่ถือว่าการแก้ local code ยืนยันผลหลัง deploy แล้ว

## อาการที่ยืนยันก่อนแก้

คำขอ `CEMS-0020/2569` และ `CEMS-0021/2569` ของโรงงาน FID `91120225825674` แสดง `factoryId` เป็น `?3-59-7/67??`. โรงงานเข้าข่าย ID `940` เก็บเลขเดิม `ข3-59-7/67ปจ` ใน `factory_registration_no_new` และมี `factory_registration_no_old = null` ทั้งที่ `source_factory_id` เป็น FID ที่ถูกต้อง

เรียก `findDirectConnectionFactory` แบบอ่านอย่างเดียวด้วย `factoryId = 91120225825674` และ `factoryRegistrationNo = ข3-59-7/67ปจ` แล้ว selector รุ่นก่อนแก้คืน `factoryId` และ `newRegistrationNo` เป็นเลขเดิม. เส้นทาง `createMeasurementPointRequest` ที่ส่ง `REQUEST_FACTORY_REVISION` นำค่าจาก selector ไปทับ `input.factoryId` ก่อนบันทึก; คำขอจริงทั้งสองอยู่ประเภท `ADD_MEASUREMENT_POINT` และสถานะ `WAITING_FACTORY_REVISION` ซึ่งใช้เส้นทางนี้

คอลัมน์ `factory_id` ของคำขอเป็น `varchar(64)` ใช้ collation `SQL_Latin1_General_CP1_CI_AS`; การทดลองอ่านอย่างเดียว `CONVERT(varchar(64), N'ข3-59-7/67ปจ')` ได้ `?3-59-7/67??` ตรงกับข้อมูลจริง ส่วนเลขทะเบียนสำหรับแสดงผลเก็บใน `nvarchar`. จึงยืนยันกลไกที่ backend ทำให้ input เลขใหม่ถูกต้องกลายเป็นเลขเดิมและเสียอักขระได้ โดยไม่สรุปว่าผู้ใช้กรอกผิด

อีกเส้นทางหนึ่งพบว่า factory summary ของโรงงานที่ยังไม่เข้าข่ายนำ `factories.code` ซึ่งเป็นเลขเดิมมาเป็น `newRegistrationNo` แล้ว service คำขอเพิ่มโรงงานบันทึกลง `factory_snapshot_json.factoryRegistrationNoNew`. `sourceFactoryId` ใน snapshot ยังเป็น FID ที่ถูกต้อง

## ขอบเขตการตรวจข้อมูลจริง

ตรวจ 18 ตารางที่เก็บ identity ทะเบียนหรือสำเนาประวัติ โดยใช้ aggregate และอ่านเฉพาะทะเบียนที่ผิดเกณฑ์ ไม่ส่งออก payload ทั้งก้อนหรือข้อมูลติดต่อ. เทียบ FID ตัวเลข 14 หลักที่ไม่ซ้ำในข้อมูลที่ยังไม่ถูกลบ 1,212 ค่า กับ Fac60k แล้วพบครบทุกค่า

| กลุ่ม | จำนวนแถวผิดเกณฑ์ | ขอบเขต |
| --- | --- | --- |
| `eligible_factories` ยังอยู่ในรายการ | 2 | ID `940`, `941` เก็บเลขเดิมในช่องเลขใหม่ |
| `eligible_factories` ที่ soft-delete | 12 | ID `12`–`18`, `933`–`936`, `939`; ไม่พบ active request/current POMS point ที่อ้างแถวเหล่านี้ |
| `cems_wpms_connection_requests` | 2 | ID `10043`, `10044`; `factory_id` เสียอักขระ |
| snapshot คำขอเพิ่มโรงงาน | 13 | ID `1`–`13`; `APPROVED` 12, `REJECTED` 1 ไม่มี `PENDING_REVIEW` ในชุดนี้ |

รวม 29 แถว ไม่ใช่จำนวนโรงงานที่ไม่ซ้ำ. ไม่พบอาการเดียวกันใน active current/live POMS points 21 แถว หรือคำขอเชื่อมต่ออื่นนอกสองรายการที่แจ้ง. จำนวนแจ้งเตือนเปลี่ยนระหว่างตรวจและตรวจซ้ำก่อนสรุป จึงไม่กล่าวอ้างว่า production หยุดนิ่งตลอดการตรวจ

เลขเดิมใน generic `factory_registration_no` เป็นเลขสำหรับแสดงผลตาม contract จึงไม่ถือว่าผิดเพียงเพราะไม่ใช่ FID. `factory_id` แบบ BIGINT ของ BOD/COD เป็น internal FK ไม่ใช้กฎ FID แทน. แบบฟอร์มและ eligible ที่ใช้ namespace ข้อมูลทดสอบแยกไว้ ไม่เดาเลขโรงงานจริงให้รายการเหล่านั้น

## พฤติกรรมที่แก้และ regression

การแก้รักษา `factoryId` และ `newRegistrationNo` ของ Fac60k เป็น FID/เลขใหม่ แยกเลขเดิมไว้ใน `oldRegistrationNo`. สำหรับแถว legacy ที่สลับช่อง ใช้ `source_factory_id` ตามแหล่งข้อมูลที่ตรวจแล้ว ไม่จับคู่ด้วยชื่อบริษัท; โรงงานชื่อเดียวกันอาจเป็นคนละ FID. ค่า generic `factoryRegistrationNo` ใช้เลขเดิมเมื่อมี มิฉะนั้นเลขใหม่

ชุด [repository/service regression](../../../../backend/tests/unit/factory-registration-identity.repository.test.ts) ใช้ selector จริงและเส้นทาง `REQUEST_FACTORY_REVISION` จริง โดยจำลองผลฐานข้อมูล ไม่ใช้ mock selector ที่คืนเลขใหม่ถูกต้องอยู่แล้ว. ก่อนแก้ test ทำซ้ำอาการที่ service ทับ numeric FID ด้วย `ข3-59-7/67ปจ` ได้

การส่งแบบแก้ไขคำขอเดิม (`resubmit`) รักษา `factoryId` และเลขแสดงตาม snapshot เดิม โดยเติมเฉพาะการอ้างอิง eligible; การเลือกเลขใหม่จาก eligible ใช้กับการสร้างคำขอใหม่ จึงไม่ขัดกับกฎห้ามเปลี่ยนทะเบียนของคำขอเดิม. Regression ทดสอบกรณี snapshot เก็บ FID เป็นเลขแสดง แต่ eligible มีเลขเดิมภาษาไทย

การ review คำขอเพิ่มโรงงานยังเปลี่ยนสถานะอย่างเดียว ไม่สร้าง ไม่ restore และไม่แก้ `eligible_factories`. การแก้ mapping ไม่เปลี่ยน permission, scope, สถานะคำขอ หรือโครงสร้าง response และไม่เพิ่ม field ใน `/table-rows`

## การซ่อมข้อมูลเฉพาะรายการ

[Migration 0132](../../../../backend/src/db/migrations/0132_create_factory_registration_repair_backup.ts) เตรียมตารางสำรองสำหรับการซ่อม, [migration 0133](../../../../backend/src/db/migrations/0133_allow_duplicate_deleted_factory_registrations.ts) รักษา uniqueness เฉพาะ eligible ที่ active และ [migration 0134](../../../../backend/src/db/migrations/0134_repair_factory_registration_identity.ts) ซ่อมตาม manifest ของ 29 แถวที่ยืนยันเลขต้นทางแล้ว ภายใน transaction พร้อมตรวจค่าก่อนเขียนและจำนวนแถว. [Migration regression](../../../../backend/tests/unit/factory-registration-identity-repair.migration.test.ts) ตรวจเงื่อนไขการซ่อม การรันซ้ำ และการเก็บหลักฐานสำรอง

การลองซ่อม production ครั้งแรกพบ `uq_eligible_factory_registration_new` บังคับเลขใหม่ไม่ซ้ำรวมแถวที่ soft-delete แล้ว ทำให้เลขใหม่ที่ซ่อมในประวัติชนกับรายการเดิม. Transaction rollback ทั้งหมด; ตรวจตามหลังแล้วไม่มีข้อมูลซ่อม ตารางสำรอง หรือ migration record ของชุดนี้ถูกนำไปใช้. Data migration ที่ยังไม่ได้ apply จึงเปลี่ยนชื่อเป็น `0134` เพื่อให้แก้เงื่อนไข index ใน `0133` ก่อน

| eligible ประวัติที่ต้องซ่อม | แถวที่มี FID เดียวกันอยู่แล้ว | สถานะของแถวที่ชน |
| --- | --- | --- |
| `12` | `616` | active |
| `17` | `21` | soft-delete |
| `933` | `938` | active |
| `936` | `937` | soft-delete |

Migration 0133 สร้าง unique index ใหม่ด้วย `WHERE deleted_at IS NULL AND factory_registration_no_new IS NOT NULL` ก่อนถอด index เดิม จึงคงข้อห้ามมีสอง active row ของเลขเดียวกันไว้ตลอด ตรวจรูปแบบ index เดิมและ FK ก่อนทำงาน ไม่เปลี่ยน PK/ID หรือย้ายการอ้างอิงของประวัติ. การ `down` ปฏิเสธหากประวัติมีเลขซ้ำซึ่ง index เดิมรองรับไม่ได้ ดู [index migration regression](../../../../backend/tests/unit/eligible-factory-active-registration-index.migration.test.ts)

| กลุ่ม | Field ที่ซ่อม | ข้อมูลที่คงเดิม |
| --- | --- | --- |
| eligible 14 แถว | `factory_registration_no_new = FID`, `factory_registration_no_old = เลขเดิม` | source identity, soft-delete, ข้อมูลทั่วไปและเวลาเดิม |
| คำขอ CEMS 2 แถว | `factory_id = 91120225825674` | generic เลขแสดง, สถานะ, จุดตรวจวัดและเวลาเดิม |
| snapshot เพิ่มโรงงาน 13 แถว | JSON `factoryRegistrationNoNew = FID`, `factoryRegistrationNoOld = เลขเดิม` | JSON key อื่น, generic คอลัมน์เลขแสดง/เลขเดิม, สถานะและเวลาพิจารณา |

ไม่ซ่อมตาราง `factories` หรือ active current/live POMS points โดยอนุมาน. หากข้อมูลไม่ตรงกับ manifest หรือการอ้างอิงเปลี่ยนไปต้องหยุดและตรวจใหม่; ห้ามขยาย ID ใน migration เอง. เมื่อมีข้อมูลสำรองแล้ว การคืนข้อมูลต้องใช้ forward migration ที่ตรวจข้อมูลปัจจุบันและหลักฐานสำรอง ไม่ลบตารางสำรองเพื่อย้อน version

เมื่อเลขซ้ำในประวัติได้ lookup สำหรับเลือกโรงงานกลับเข้าข่ายต้องเลือกประวัติล่าสุดที่ตรง source และ form ที่ระบุ ไม่เลือกแถวแรกแบบไม่มีลำดับ. [Eligible identity regression](../../../../backend/tests/unit/eligible-factory-registration-identity.test.ts) ตรวจ mapping เลขใหม่/เลขเดิมและ query restore ที่กรอง identity พร้อม `deleted_at DESC, id DESC`

## การตรวจผลและข้อจำกัด

คำสั่งตรวจ local code และ contract:

```bash
cd backend
npm run typecheck
npm test -- --runInBand tests/unit/factory-registration-identity.repository.test.ts tests/unit/eligible-factory-registration-identity.test.ts tests/unit/factory-registration-identity-repair.migration.test.ts tests/unit/eligible-factory-active-registration-index.migration.test.ts tests/unit/api-docs.openapi.test.ts
```

ตรวจ release ที่แยกจาก `main` commit `e7a598575ea3fa3bf6032c6a5e7f50260d425418` ด้วย dependencies ตาม lockfile ของ release: `npm run typecheck`, `npm run build` และ `npm test -- --runInBand --silent` ผ่านทั้งหมด 301 suites รวม 3,756 tests. ชุดนี้รวม regression เลขทะเบียน, การรักษา snapshot เมื่อ resubmit, migration guards และ OpenAPI contract. การ review release ไม่พบ correctness blocker

ผล full test suite ของ workspace เก่าที่ใช้ diagnosis เคยมี failure นอกชุดทะเบียนสองกรณี จึงไม่ใช้ผลจาก workspace นั้นยืนยัน release; ตรวจใหม่บน `main` ล่าสุดแล้วผ่านทั้งชุดตามข้างต้น

ผล regression ที่ใช้ฐานข้อมูลจำลองไม่ยืนยันว่า migration ทำงานบน SQL Server จริง. ตาราง fixture ที่สร้างด้วย `SELECT INTO` ไม่คัดลอก unique index หรือ FK ของต้นทาง การตรวจ SQL จึงต้องสร้าง constraint/index ที่เกี่ยวข้องเองและใส่แถวชนทั้งสี่กรณี เพื่อให้การทดสอบครอบคลุมเงื่อนไขที่ทำให้ production rollback ด้วย

ทดสอบบน SQL Server ด้วยตารางจำลองใน connection เดียวที่คัดลอกข้อมูลเฉพาะรายการเป้าหมาย 29 แถวและแถว eligible ที่ชนอีก 4 แถว รวม eligible 18 แถว พร้อม index ที่เกี่ยวข้อง ผ่านทั้ง 6 สถานการณ์:

| สถานการณ์ | ผลที่ยืนยัน |
| --- | --- |
| unique index เดิมรวมประวัติ | การซ่อมชน `2601` และ rollback ได้ตรงกับ production ครั้งแรก |
| เปลี่ยน index, ซ่อม, คืนข้อมูลและรันซ้ำ | ค่า registry/ข้อมูลสำรองและ schema เปลี่ยนตามแต่ละขั้นโดยไม่แตะข้อมูลอื่น |
| source identity ไม่ตรง manifest | ปฏิเสธด้วย `51331` |
| สถานะเปลี่ยนก่อนคืนข้อมูล | ปฏิเสธด้วย `51346` ไม่เขียนทับ workflow ใหม่ |
| มีเลขใหม่ซ้ำใน active row | unique index ใหม่ยังปฏิเสธด้วย `2601` |
| คืน index เดิมขณะที่ประวัติมีเลขซ้ำ | ปฏิเสธด้วย `51365` |

หลังการทดสอบ ตรวจตารางจริงซ้ำแล้วสองคำขอและ eligible 14 แถวยังมีค่าเดิม ไม่มีตารางสำรองหรือ migration record ใหม่ของชุดซ่อม จึงไม่ถือว่าผล fixture เป็นการซ่อม production

Workspace เก่าที่ใช้ diagnosis ขาดไฟล์ `0125_reuse_deleted_local_user_identity.ts` แต่ `main` ที่ใช้ release มี migration ประวัติครบ จึงใช้ `npm run db:migrate` ผ่าน workflow ปกติและคงการตรวจ migration history ไว้. ชุด pending ของการแก้ทะเบียนนี้มีเพียง `0132_create_factory_registration_repair_backup.ts`, `0133_allow_duplicate_deleted_factory_registrations.ts` และ `0134_repair_factory_registration_identity.ts`; ไม่ใช้สคริปต์ bypass validation กับ release

ผู้ใช้อนุมัติซ่อมข้อมูล 29 แถวและสั่ง push production หลังได้รับรายละเอียดการเปลี่ยน unique index. Release ใช้ workflow production เดิม ซึ่งทดสอบ backend ก่อนหยุด service, รัน migrations, วาง release, เริ่ม service และตรวจ health. ก่อนเผยแพร่ได้ตรวจฐานข้อมูลจริงซ้ำ: active current/live POMS points 21 แถวมี source FID ตัวเลข 14 หลักครบ, active eligible ไม่มีเลขใหม่ซ้ำ และยังไม่มี migration หรือ backup ของชุดซ่อม

หลัง workflow สำเร็จต้องอ่านค่า 29 แถวและข้อมูลสำรองจากฐานข้อมูลจริง ตรวจ index กับ migration records และตรวจ `GET /api/v1/openapi.json` ให้ตรงกับ contract. `/api/v1/cems-wpms-requests/table-rows` ต้องตรวจภายใต้สิทธิ์จริง; การตรวจ SQL หรือ OpenAPI ไม่ถือเป็นการทดสอบ HTTP ของ endpoint นี้แทน

## ผล production หลัง release

[Workflow 37405606388](https://github.com/Nongten1010/POMS-app/actions/runs/37405606388) deploy backend commit `6ddfd9ddefa1cd9442b635623deea6d3d4a2ea35` สำเร็จ. เครื่อง production ทดสอบผ่าน 301 suites / 3,756 tests, migration batch `108` รันสาม migrations ของชุดนี้ และ health check คืน `success: true`, `status: ok`

อ่านข้อมูลจริงหลัง deploy แล้วตรวจตรง manifest ครบ 29 แถว: eligible 14 แถว, snapshot เพิ่มโรงงาน 13 แถว และคำขอ CEMS 2 แถว. ตารางสำรองมี `eligible = 14`, `addition = 13`, `request = 2` รวม 29 แถว; migration records มี `0132`, `0133`, `0134` ครบ. Index ปัจจุบันคือ `uq_eligible_factory_registration_active_new` ตาม filter ที่กำหนด และไม่พบกลุ่มเลขทะเบียนซ้ำใน active eligible

| คำขอ | `factory_id` หลังซ่อม | เลขแสดงที่รักษาไว้ | สถานะที่รักษาไว้ |
| --- | --- | --- | --- |
| `CEMS-0020/2569` | `91120225825674` | `ข3-59-7/67ปจ` | `WAITING_FACTORY_REVISION` |
| `CEMS-0021/2569` | `91120225825674` | `ข3-59-7/67ปจ` | `WAITING_FACTORY_REVISION` |

[Runtime OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) ตอบสำเร็จ และ `components.schemas` กับ `paths` ตรงกับ JSON contract ของ build release ทุกส่วน. การเรียก `/api/v1/cems-wpms-requests/table-rows` โดยไม่มี token ตอบ `401` ตาม authentication contract; ยังไม่ได้ตรวจ HTTP response ของ endpoint นี้ผ่าน session ผู้ใช้จริง. ผล SQL ยืนยันค่าที่บันทึก ส่วน regression ยืนยัน mapping ของ table row จึงรายงานขอบเขตการตรวจทั้งสองส่วนแยกกัน

## การประกาศผลกระทบของการแก้ไข

Docs impact: updated

Canonical docs: [คำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md), [โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md)

Reason: แก้การสลับเลขทะเบียนใหม่กับเลขเดิม และกำหนด uniqueness ของข้อมูลปัจจุบันกับประวัติให้ตรงกัน

Client impact: fields และรูปแบบ response คงเดิม; เลขใหม่เป็น FID เลขเดิมแยกสำหรับแสดงผล และทะเบียนในคำขอเดิมคงตาม snapshot เมื่อ resubmit

Breaking change: no
