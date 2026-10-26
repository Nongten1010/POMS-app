# หลักฐานการล้างค่าทดสอบและเลิกใช้ Test mode

เมนูที่เกี่ยวข้อง: [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md)

สัญญา API: [ล้างค่าทดสอบเมื่อจุดใหม่เชื่อมต่อสำเร็จ](../../api/menus/connection-requests/measurement-cleanup.md)

## ชุดขึ้น production: เลิกใช้ Test mode และล้างเฉพาะพารามิเตอร์ใหม่

เตรียมเฉพาะ backend และเอกสารจาก `origin/main` ที่ `baa5128c` โดยคงสิทธิ์ ขอบเขตการอนุมัติ ownership และ protocol selection ล่าสุดของ main ไม่รวม frontend, workflow, dependency changes หรือ migration `0144` ของงานอื่น

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/connection-requests/parameter-values.md; docs/backend/api/menus/connection-requests/measurement-cleanup.md; docs/backend/api/menus/connection-requests/device-configs.md; docs/backend/api/integrations/device-configs/README.md; docs/backend/api/CHANGELOG.md#parameter-column-family-matching
Reason: connection-test คืนค่าคู่สถานะจาก real/1m, คง testMode เป็น false และล้างเฉพาะพารามิเตอร์ใหม่โดยใช้ receipt ป้องกันล้างซ้ำ
Client impact: frontend
Breaking change: yes
```

| รายการ | ผลตรวจชุดที่จะ deploy |
| --- | --- |
| Build / typecheck | ผ่านทั้งสองคำสั่ง |
| ชุดทดสอบรวมพร้อม coverage | 362 suites / 4,881 tests ผ่าน ไม่มี failure; 14 tests ข้ามตาม opt-in |
| Coverage | Statements 80.45%, lines 82.35%, functions 84.09%, branches 79.54% |
| Lint | ไม่มี error; 355 warnings ของชุด backend โดยไม่มีการแก้ formatting นอกขอบเขต |
| Regression บน main ล่าสุด | คง ownership/access guards; cleanup ใช้ canonical station และ baseline จาก point ที่ล็อกแล้ว; migration `0146` มี regression สำหรับ future/invalid `connected_at` |
| SQL Server แยก | พฤติกรรม cleanup เดียวกันผ่าน 10 integration tests บนฐานข้อมูลจำลองในการตรวจรอบพัฒนา ไม่ใช้ผลนี้แทนการยืนยันสถานะฐาน production |
| Diff / security / เอกสาร | เฉพาะ backend และ canonical docs, ไม่รวม secrets/generated files; diff whitespace และลิงก์เอกสารที่เปลี่ยนผ่าน |
| SQL preflight จากเครื่องพัฒนา | ตรวจซ้ำก่อน push แล้ว timeout ทั้งฐานหลักและฐานค่า จึงยังไม่ยืนยัน migration/permission ล่าสุดจากเครื่องนี้ |
| Production rollout | ก่อน push ยังไม่ได้ deploy; ต้องติดตาม workflow production ที่รัน `0145`/`0146`, health check และตรวจ runtime OpenAPI หลัง deploy |

การตรวจชุดนี้ใช้ environment สมมติและบัญชี loopback โดยกำหนด `NODE_ENV=test`, `PARAMETER_DB_SCHEMA=ingest`, `PUBLIC_BASE_URL=http://d-poms.diw.go.th` และปิด SQL integration ทั้งสองชุด ไม่คัดลอก `.env` จริงมาใน release worktree

ผล integration ของ `testMode: false` ใช้สัญญาเดียวกัน ดู [CHANGELOG](../../api/CHANGELOG.md#test-mode-retired) และ [ขั้นตอน audit/recovery](../../guides/parameter-measurement-cleanup-audit.md) การตรวจ production จะอ่าน health และ OpenAPI โดยไม่สร้างคำขอหรือล้างข้อมูลจุดจริงเพื่อทดสอบ

## ขอบเขต release ก่อนหน้า

Release ก่อนหน้านี้เตรียมจาก `origin/main` โดยรวมงาน backend สองเรื่องที่ได้รับอนุมัติ: ป้องกันอุปกรณ์และพารามิเตอร์ซ้ำใน [การตั้งค่าอุปกรณ์](../../api/menus/connection-requests/device-configs.md#การป้องกันพารามิเตอร์ซ้ำ) และล้างค่าทดสอบก่อนจุดใหม่เชื่อมต่อสำเร็จ พร้อมชุดทดสอบ สัญญา API และ runtime OpenAPI ที่เกี่ยวข้อง เอกสารนี้บันทึกหลักฐานเฉพาะงานล้างค่าทดสอบ

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/connection-requests/measurement-cleanup.md; docs/backend/api/menus/connection-requests/README.md; docs/backend/api/menus/connection-requests/parameter-values.md; docs/backend/api/menus/connection-requests/device-configs.md; docs/backend/api/CHANGELOG.md#new-point-measurement-cleanup; docs/backend/api/CHANGELOG.md#device-config-duplicate-parameters
Reason: ล้างข้อมูลทดสอบก่อน activate จุดใหม่ พร้อม receipt ป้องกันล้างซ้ำและ error 503 เมื่อยืนยันผลการล้างไม่ได้; ป้องกันอุปกรณ์และพารามิเตอร์ซ้ำในการตั้งค่า
Client impact: frontend
Breaking change: yes
```

รายการ breaking change: [ล้างค่าทดสอบ](../../api/CHANGELOG.md#new-point-measurement-cleanup) และ [ป้องกันอุปกรณ์/พารามิเตอร์ซ้ำ](../../api/CHANGELOG.md#device-config-duplicate-parameters)

คง fixes ของ main สำหรับสิทธิ์ ขอบเขตการอนุมัติ ownership ของจุด การส่งฟอร์มซ้ำ และประวัติ migration เดิม Release ก่อนหน้านี้ไม่แก้ frontend และไม่เพิ่ม migration ใหม่: `0143_create_connection_measurement_cleanup_receipts.ts` และ receipt schema มีอยู่บน main แล้ว

## กรณีที่ชุดทดสอบครอบคลุม

| กรณี | ชุดทดสอบ |
| --- | --- |
| ล้างครบ 6 ตารางของรหัสจุดใหม่ และคงจุดอื่น | `connection-measurement-cleanup.test.ts` |
| ข้าม `ADD_PARAMETER` และรหัสที่เคยเชื่อมต่อ รวมจุดเลิกใช้งานและคำขอที่มีทั้งจุดเก่า/ใหม่ | `connection-measurement-cleanup.test.ts` |
| คงข้อมูลหลังล้างเมื่อ retry รวม direct request ID ใหม่ และกรณีไม่ได้รับ commit acknowledgement | `connection-measurement-cleanup.test.ts` |
| การลบตารางใดหรือการเขียน receipt ล้มเหลว ทำให้ rollback ทุกจุดในรอบนั้น | `connection-measurement-cleanup.test.ts` |
| ข้ามตารางที่ไม่มี แต่ metadata อ่านไม่ได้ต้องตอบ 503 | `connection-measurement-cleanup.test.ts` |
| รหัส Unicode จุด เครื่องหมายคำถาม วงเล็บปิด และข้อความที่ดูเหมือน SQL เป็น identifier เดียว | `connection-measurement-cleanup.test.ts` |
| Verify, direct CONNECT และอนุมัติจุดยกเว้น เรียกล้างก่อนสร้าง live point; ล้มเหลวแล้วคืนสถานะ/ข้อมูลหลัก | `connection-requests.current-factory-profile.repository.test.ts`, `connection-requests.direct-connections.repository-happy-path.test.ts` |
| Maintenance sync ไม่ล้างย้อนหลัง | `connection-requests.current-factory-profile.repository.test.ts` |
| HTTP ส่ง error envelope 503 และ runtime OpenAPI ครบทุก endpoint ที่ activate จุดใหม่ | `connection-requests.direct-connections.integration.test.ts`, `connection-measurement-cleanup.openapi.test.ts` |
| Migration สร้างเฉพาะ receipt ในฐานค่าที่ตั้งไว้และไม่ล้างข้อมูล; rollback คง receipt | `connection-measurement-cleanup.migration.test.ts` |
| SQL Server จริง: concurrent insert ต้องรอ lock และคงข้อมูลหลังล้าง; deletion failure rollback ทั้งรอบ | `connection-measurement-cleanup.sql-server.test.ts` แบบ opt-in บนฐานสมมติเท่านั้น |

## ผลตรวจ release ก่อนหน้า

| รายการ | สถานะ |
| --- | --- |
| Typecheck และ build | `npm run typecheck` และ `npm run build` ผ่านกับชุด release |
| Unit/HTTP/OpenAPI tests และ regression tests ของ main | `npm test -- --runInBand`: 356 suites ผ่าน, 4,797 tests ผ่าน, 6 tests ถูกข้ามตาม opt-in ของชุดเดิมและ SQL Server integration |
| SQL Server integration | ยังไม่ได้รัน; เปิดได้เฉพาะฐานสมมติที่ผ่าน identity guard |
| เอกสารและ diff review | ตรวจ documentation-impact fields, ลิงก์/ตำแหน่ง/การเข้าถึงจาก hub ของ Markdown ที่เปลี่ยนทั้ง 7 ไฟล์ และ `git diff --check` ผ่าน; routes และ endpoint registry ไม่เปลี่ยนจาก main. Repository ยังไม่มี executable docs guard จึงตรวจขอบเขตนี้ด้วยตัวตรวจชั่วคราว |
| ฐานค่าก่อน deploy | ตรวจแบบอ่านอย่างเดียว: receipt table, `VIEW DEFINITION`, `SELECT`/`INSERT` ของ receipt และ `SELECT`/`DELETE` ของตารางค่าทั้ง 4,865 ตารางผ่านใน `parameter_ingest.ingest`; ไม่ล้างข้อมูลหรือเปลี่ยนสิทธิ์ |
| Production deployment และ runtime OpenAPI | ตรวจหลัง push และบันทึก workflow URL กับผล runtime contract ในสรุปส่งมอบ |

คำสั่งตรวจ รันจาก `backend/` ด้วยค่า environment สำหรับ fixture ที่ไม่มี credential production:

```bash
npm run typecheck
npm run build
npm test -- --runInBand
```

การทดสอบใช้ `NODE_ENV=test`, บัญชีสมมติและ host loopback, `PARAMETER_DB_SCHEMA=ingest`, `PUBLIC_BASE_URL=http://d-poms.diw.go.th` และ `POMS_CLEANUP_SQL_TEST_ENABLED=false` ผลจาก workspace เก่าหรือการเตรียมฐานก่อนหน้านี้ไม่ใช้แทนผลชุด release นี้ การตรวจ production หลัง push ใช้ health และ runtime contract โดยไม่สร้างการเชื่อมต่อจุดจริง

## ข้อจำกัดและเงื่อนไข production

- ล้างทุกแถวที่มีอยู่ ณ จังหวะจับล็อกในตาราง `real`, `1m`, `5m`, `60m`, `1day`, `test` ของรหัสจุดใหม่ตามสัญญา ไม่มีการสำรองค่าตรวจวัดใน receipt
- ฐานค่าตรวจวัดกับฐานหลักใช้ transaction แยกกัน การล้างอาจ commit แล้วสถานะในฐานหลัก rollback ได้; receipt ใช้ป้องกันการล้างซ้ำเมื่อลองใหม่
- ต้องมี receipt table และสิทธิ์ runtime ตาม [สัญญา API](../../api/menus/connection-requests/measurement-cleanup.md#ข้อมูลสำหรับ-backend-และผู้ดูแล) ก่อนเปิด application รุ่นนี้ ไม่รัน SQL หรือเปลี่ยนสิทธิ์ฐาน production โดยอัตโนมัติจากชุดทดสอบ
- Unit/HTTP tests ใช้ fixture จึงไม่ยืนยันพฤติกรรม locking ของ SQL Server จริง ชุด integration ใช้ credential แยก `POMS_CLEANUP_SQL_TEST_*`, ฐาน `poms_measurement_cleanup_test` และ extended property `PomsTestPurpose = measurement-cleanup-synthetic-only` เท่านั้น ห้าม fallback ไปฐาน application
- หลัง deploy ต้องตรวจ `/api/v1/openapi.json` ให้ตรงกับ canonical contract และตรวจสุขภาพ application โดยไม่ใช้การเชื่อมต่อจุดจริงเป็น smoke test เพราะจะล้างค่าตรวจวัด


## หลักฐานประกอบก่อนจัดชุด production

ผลด้านล่างมาจาก checkout พัฒนาเดิมก่อนย้ายเฉพาะ feature มาบน `origin/main` และไม่ใช่หลักฐานว่า candidate production ผ่าน checks หรือ deploy แล้ว ต้องตรวจ candidate แยกก่อนเผยแพร่

<a id="cleanup-receipt-audit-2026-10-26"></a>

## Snapshot การตรวจ migration และ receipt แบบอ่านอย่างเดียว — 2026-10-26

รอบตรวจหลังเชื่อม VPN ใช้ `SELECT` กับฐานหลักและฐานค่าที่ไม่ใช่ local ตาม configuration ที่กำหนด โดยไม่บันทึก hostname, credential หรือข้อมูลโรงงาน:

- ประวัติ migration ของฐานหลักยังไม่มี `0145_create_parameter_measurement_cleanup_receipts.ts` และ `0146_retire_device_channel_test_mode.ts`
- ไม่พบตาราง `parameter_measurement_cleanup_receipts` ใน source schema ที่กำหนด ณ เวลาตรวจ จึงไม่มี receipt ของ `0145` ในขอบเขตนั้นที่ต้องตัดสินใจซ่อมข้อมูลเก่า
- ผลนี้เป็น snapshot เฉพาะ connection/schema ที่ตรวจ ไม่ใช่ข้อยืนยันของทุก environment หรือการยืนยันว่ารัน migration/deploy แล้ว รอบตรวจนี้ไม่มี DML, DDL หรือการล้างข้อมูล

ดู [สัญญาการล้างเฉพาะพารามิเตอร์](../../api/menus/connection-requests/measurement-cleanup.md) และ [วิธี audit/recovery โดยไม่ลบ receipt หรือย้อนล้าง `CONNECTED`](../../guides/parameter-measurement-cleanup-audit.md) ก่อนเตรียม release

## ผลตรวจรอบเลิกใช้ Test mode และปิดช่องว่างการจับคู่พารามิเตอร์

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/connection-requests/parameter-values.md; docs/backend/api/menus/connection-requests/measurement-cleanup.md; docs/backend/api/menus/connection-requests/device-configs.md; docs/backend/api/integrations/device-configs/README.md
Reason: คืนค่าตรวจวัดคู่สถานะจาก real/1m, คง testMode เป็น false และล้างเฉพาะพารามิเตอร์ใหม่โดยไม่กระทบค่าที่เชื่อมต่ออยู่
Client impact: frontend
Breaking change: yes
```

ผลต่อ integration ใช้สัญญา `testMode: false` เดียวกัน ดูรายการเปลี่ยนพฤติกรรมที่ [การจับคู่คอลัมน์](../../api/CHANGELOG.md#parameter-column-family-matching), [เลิกใช้ Test mode](../../api/CHANGELOG.md#test-mode-retired), [ค่าคู่สถานะ](../../api/CHANGELOG.md#connection-test-measured-values) และ [ล้างเฉพาะพารามิเตอร์](../../api/CHANGELOG.md#add-parameter-measurement-cleanup)

| รายการ | ผลตรวจจาก workspace |
| --- | --- |
| Build / typecheck | ผ่านทั้งสองคำสั่ง |
| Lint | ไม่มี error; ทั้ง backend มี 374 warnings ส่วนไฟล์ mapping/cleanup และชุดทดสอบที่แก้ในรอบนี้ไม่มี warning |
| HTTP API และ migration ที่ตรวจซ้ำ | 6 suites / 168 tests ผ่าน รวม cleanup 23 กรณี, connection-test values 38 กรณี และ migration `0145` 5 กรณี |
| SQL Server แยกสำหรับข้อมูลจำลอง | 10 integration tests ผ่าน รวม lock/concurrent insert, rollback, commit acknowledgement หาย, mixed families, pH และการปกป้องพารามิเตอร์เดิม; รันร่วมกับ migration tests รวม 15 tests ผ่าน |
| ชุดทดสอบรวมรอบล่าสุด | 4,523 ผ่าน, 3 ล้มเหลว, 14 ข้าม; ข้อผิดพลาด 3 กรณีอยู่ใน HTTP transport ของ Chat และผ่านเมื่อรันตรวจซ้ำในชุด 168 tests ข้างต้น |
| Coverage ของชุดรวม | Statements 80.11%, lines 82.04%, functions 83.8%, branches 79.04% |
| Diff / เอกสาร / security scan | Diff whitespace ผ่าน; canonical links ที่เกี่ยวข้องตรวจแล้ว; ไม่พบ secret หรือ debug log ใน runtime ที่แก้ |

ยังไม่ถือว่าชุดทดสอบรวมผ่านทุกกรณีในครั้งเดียว: จำลอง `ECONNRESET`, HTTP `501` และ parse error ได้ด้วย Node HTTP server ขนาดเล็กที่ไม่มีโค้ด POMS โดย request ที่ผิดพลาดยังไม่ถึง handler ของ server จึงไม่มีการเพิ่ม retry หรือลด assertion เพื่อกลบอาการ และไม่มีการแก้ production runtime จากข้อสันนิษฐานเรื่อง transport นี้

SQL integration ใช้ฐานข้อมูลจำลองที่มี purpose marker และ credential เฉพาะชุดทดสอบ ลบ container และ credential ที่สร้างสำหรับรอบนี้แล้ว ไม่แตะ container เดิม ไม่รัน migration `0145`/`0146` หรือแก้ข้อมูลบนฐานที่ตั้งค่าไว้ และยังไม่ได้ deploy โค้ดรอบนี้

หลักฐานที่รันได้ซ้ำ: [HTTP cleanup](../../../../backend/tests/unit/add-parameter-cleanup.api.test.ts), [HTTP connection-test values](../../../../backend/tests/unit/parameter-values.connection-test-values.api.test.ts), [migration 0145](../../../../backend/tests/unit/parameter-measurement-cleanup.migration.test.ts) และ [SQL Server integration](../../../../backend/tests/integration/connection-measurement-cleanup.sql-server.test.ts)
