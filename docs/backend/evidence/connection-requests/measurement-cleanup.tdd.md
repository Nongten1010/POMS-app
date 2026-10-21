# หลักฐานการล้างค่าทดสอบเฉพาะจุดตรวจวัดใหม่

เมนูที่เกี่ยวข้อง: [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md)

สัญญา API: [ล้างค่าทดสอบเมื่อจุดใหม่เชื่อมต่อสำเร็จ](../../api/menus/connection-requests/measurement-cleanup.md)

## ขอบเขต release

Release นี้เตรียมจาก `origin/main` โดยรวมงาน backend สองเรื่องที่ได้รับอนุมัติ: ป้องกันอุปกรณ์และพารามิเตอร์ซ้ำใน [การตั้งค่าอุปกรณ์](../../api/menus/connection-requests/device-configs.md#การป้องกันพารามิเตอร์ซ้ำ) และล้างค่าทดสอบก่อนจุดใหม่เชื่อมต่อสำเร็จ พร้อมชุดทดสอบ สัญญา API และ runtime OpenAPI ที่เกี่ยวข้อง เอกสารนี้บันทึกหลักฐานเฉพาะงานล้างค่าทดสอบ

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/connection-requests/measurement-cleanup.md; docs/backend/api/menus/connection-requests/README.md; docs/backend/api/menus/connection-requests/parameter-values.md; docs/backend/api/menus/connection-requests/device-configs.md; docs/backend/api/CHANGELOG.md#new-point-measurement-cleanup; docs/backend/api/CHANGELOG.md#device-config-duplicate-parameters
Reason: ล้างข้อมูลทดสอบก่อน activate จุดใหม่ พร้อม receipt ป้องกันล้างซ้ำและ error 503 เมื่อยืนยันผลการล้างไม่ได้; ป้องกันอุปกรณ์และพารามิเตอร์ซ้ำในการตั้งค่า
Client impact: frontend
Breaking change: yes
```

รายการ breaking change: [ล้างค่าทดสอบ](../../api/CHANGELOG.md#new-point-measurement-cleanup) และ [ป้องกันอุปกรณ์/พารามิเตอร์ซ้ำ](../../api/CHANGELOG.md#device-config-duplicate-parameters)

คง fixes ของ main สำหรับสิทธิ์ ขอบเขตการอนุมัติ ownership ของจุด การส่งฟอร์มซ้ำ และประวัติ migration เดิม งานนี้ไม่แก้ frontend และไม่เพิ่ม migration ใหม่: `0143_create_connection_measurement_cleanup_receipts.ts` และ receipt schema มีอยู่บน main แล้ว

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

## ผลตรวจ release นี้

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
