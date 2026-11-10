# ผลตรวจคีย์แถวโรงงานผู้ประกอบการบน production

[กลับสารบัญหลักฐาน](../README.md) · [สัญญา API](../../api/menus/connection-requests/README.md#operator-factory-row-id) · [ผลกระทบต่อ client](../../api/CHANGELOG.md#operator-factory-row-id)

หลักฐานการส่ง backend วันที่ 10 พฤศจิกายน 2569 และตรวจ HTTP หลัง deploy เวลา 09:57:37 น. `Asia/Bangkok` (`2026-11-10T02:57:37Z`). เป็นผล ณ เวลาที่ตรวจ ไม่ใช้แทน canonical contract

## ชุดที่ส่งและขั้นตอนตรวจ

- Implementation: [`39a94570`](https://github.com/Nongten1010/POMS-app/commit/39a94570032fc516f9e611fab4265b21f0ac892c)
- Commit ที่ติดตั้ง: [`28a41abd`](https://github.com/Nongten1010/POMS-app/commit/28a41abd7fdb3fb5ad57b4c02f3714e55de983ba) ซึ่งรวมการแก้ assertion ใน OpenAPI test ของเมนูข้อมูลพื้นฐานให้ตรงกับ schema ที่แยกใหม่
- ช่วงเปลี่ยนแปลง `17c26fa7..28a41abd` มี 9 ไฟล์ เฉพาะ backend, tests และ canonical docs; ไม่มี frontend, migration, dependency หรือ environment เปลี่ยนแปลง
- [ตรวจ checkout ก่อนส่ง](https://github.com/Nongten1010/POMS-app/actions/runs/42744741155) พบ production HEAD `6a56dbc0`, ไม่มี tracked changes หรือ untracked backend source และตรวจ SHA-256 ของ source ใน artifact ครบ 11 ไฟล์
- [รอบ CI แรก](https://github.com/Nongten1010/POMS-app/actions/runs/42745047985) พบ assertion เก่าที่คาด `ConnectionRequestFactoryTableResponse` สำหรับรายการผู้ประกอบการ และหยุดก่อน production install. แก้เฉพาะ test ใน commit `28a41abd` แล้วทำซ้ำกรณีล้มให้ผ่านพร้อมชุดที่เกี่ยวข้อง 102 tests
- [Deploy POMS รอบที่สำเร็จ](https://github.com/Nongten1010/POMS-app/actions/runs/42745631073) ใช้ `workflow_dispatch`, branch `main`, `deploy_target=backend`; CI build และทดสอบ commit ที่ติดตั้งก่อนส่ง artifact ให้ production

## ผล CI และติดตั้ง

| รายการ | ผลที่ยืนยัน |
| --- | --- |
| Build บน CI | ผ่าน |
| ชุดทดสอบทั้งหมดบน CI | 417 suites ผ่าน, 2 suites ข้าม; 5,761 tests ผ่าน, 18 tests ข้าม, ไม่มี failure |
| เลือกส่วนงาน | `backend_changed=true`, `frontend_changed=false` |
| ตรวจ artifact | production ใช้ verified backend artifact ของ commit `28a41abd` และตรวจ manifest ก่อนติดตั้ง |
| Server checkout | เลื่อนไป `28a41abd7fdb3fb5ad57b4c02f3714e55de983ba` |
| Migrations | `Already up to date`; ชุดแก้นี้ไม่มี migration ใหม่ |
| Backend health | `success=true`, `status=ok` เวลา `2026-11-10T02:56:39.223Z` |
| ขั้นตอน frontend | `Build frontend` และ `Deploy frontend to IIS site root` ถูกข้าม |

## ผล HTTP และ runtime OpenAPI

| การตรวจ | ผลที่ยืนยัน |
| --- | --- |
| [Production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) | HTTP 200; มี 143 paths และ 273 schemas |
| [Swagger](https://d-poms.diw.go.th/api/v1/docs/) | HTTP 200 |
| Response schema ของ `GET /cems-wpms-requests/operator-factories` | `#/components/schemas/OperatorFactoryListResponse` |
| Schema ของคีย์แถว | `OperatorFactoryListRow.properties.id.oneOf` รองรับ positive integer หรือข้อความ `factory-<factoryId>` และไม่รับ `null` |
| เทียบกับ build ที่ตรวจแล้ว | `components.schemas` และ `paths` ทุกส่วนตรงกับ verified local build |
| เทียบกับ production ก่อนส่ง | เพิ่มเฉพาะ `OperatorFactoryListRow`, `OperatorFactoryListResponse`; เปลี่ยน path contract เฉพาะ `/cems-wpms-requests/operator-factories` |
| Contract เมนูอื่น | `OperatorFactoryTableRow` และ `ConnectionRequestFactoryTableRow` ตรงกับก่อนส่ง |
| เรียกรายการผู้ประกอบการโดยไม่มี token | HTTP 401 และ `error.code=UNAUTHORIZED` |
| Flags เดิม | `x-poms-eligible-operator-access-enabled` และ `x-poms-factory-status-sync-enabled` ไม่เปลี่ยน |
| Frontend deploy marker | ตรงกับก่อนส่งทุกไบต์: SHA `98d51ee1e027a176ecdb02e8206e9f05e2c20994`, run `42739346474` |

SHA-256 ของ OpenAPI snapshot ที่ตรวจคือ `1a7cb02577e04ab3e3f03f3f33869f64a83330b8474d1999015321a49c18b28c`. เครื่องตรวจมีปัญหากับ DNS resolver ปกติ จึงยืนยัน A record `110.78.4.84` จาก Google DNS และ Cloudflare แล้ว override เฉพาะการ resolve ของ process โดยคง hostname/SNI และการตรวจใบรับรอง HTTPS ไม่แก้ DNS ของระบบ

[การตรวจ production แบบอ่านอย่างเดียวหลัง deploy](https://github.com/Nongten1010/POMS-app/actions/runs/42746071712) ยืนยัน backend deploy marker เป็น commit `28a41abd` และ frontend marker ยังคงเป็น `98d51ee1` โดยใช้ action `inspect` ไม่เปิด/ปิด configuration

## ขอบเขตหลักฐาน

ก่อนส่งตรวจ local build, typecheck, lint, tests ที่เกี่ยวข้อง 409 tests และนำ response ผ่าน HTTP ของแอปที่ทดสอบไปใช้กับ mapper/DataGrid เดิมได้ โดยไม่แก้ frontend. Regression tests อยู่ใน [service tests](../../../../backend/tests/unit/connection-requests.service.test.ts), [HTTP/runtime OpenAPI tests](../../../../backend/tests/unit/connection-requests.operator-factory-ids.route.test.ts) และ [OpenAPI contract tests](../../../../backend/tests/unit/api-docs.openapi.test.ts)

การตรวจ production รอบนี้อ่าน public contract, Swagger, unauthenticated response, health และ deploy markers. ไม่ได้ใช้ session ผู้ประกอบการจริงเรียกข้อมูลโรงงาน `40490171025682`; ผล HTTP 401 ยืนยันการป้องกัน endpoint เท่านั้น ส่วนรูปแบบ ID และการคง ID ตัวเลขเดิมตรวจด้วย regression tests และ verified release artifact
