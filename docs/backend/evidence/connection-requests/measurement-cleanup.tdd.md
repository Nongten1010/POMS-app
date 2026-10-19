# หลักฐานการล้างค่าทดสอบเฉพาะจุดตรวจวัดใหม่

เมนูที่เกี่ยวข้อง: [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md)

เอกสารรายละเอียดที่เตรียมใน workspace: `docs/backend/api/menus/connection-requests/measurement-cleanup.md`

> การเผยแพร่รอบนี้รวมเฉพาะเอกสารสรุปนี้และลิงก์ในสารบัญ โค้ด backend, ชุดทดสอบ และเอกสารสัญญา API ของ feature ยังไม่ได้รวมใน commit นี้ ผลตรวจด้านล่างเป็นหลักฐานจาก workspace และการเตรียมฐานตามที่ผู้ใช้อนุญาต ไม่ใช่หลักฐานว่า backend รุ่นใหม่ถูก deploy แล้ว

## ขอบเขตงานใน workspace

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/connection-requests/measurement-cleanup.md; docs/backend/api/menus/connection-requests/README.md; docs/backend/api/menus/connection-requests/parameter-values.md; docs/backend/api/CHANGELOG.md#new-point-measurement-cleanup
Reason: ล้างข้อมูลทดสอบก่อน activate จุดใหม่ พร้อม receipt ป้องกันล้างซ้ำและ error 503 เมื่อยืนยันผลการล้างไม่ได้
Client impact: frontend
Breaking change: yes
```

รายการ breaking change ที่เตรียมใน workspace: `docs/backend/api/CHANGELOG.md#new-point-measurement-cleanup` ยังไม่ได้รวมใน commit เผยแพร่สรุปรอบนี้

รอบพัฒนาแก้เฉพาะ backend และเอกสาร backend โดยยังไม่รัน migration หรือ deploy/commit/push ชุดทดสอบ SQL Server จริงปิดไว้โดยค่าเริ่มต้นและใช้ credential แยกตาม contract หลังผู้ใช้อนุญาตให้เตรียมฐานจริง จึงรันเฉพาะ migration `0143` และเพิ่มสิทธิ์ตามผลตรวจด้านล่าง โดยไม่ล้างค่าตรวจวัด

## กรณีที่ตรวจ

| กรณี | หลักฐาน |
| --- | --- |
| ล้างครบ 6 ตารางของรหัสจุดใหม่ และคงจุดอื่น | `connection-measurement-cleanup.test.ts` |
| ข้าม `ADD_PARAMETER` และรหัสที่เคยเชื่อมต่อ รวมจุดเลิกใช้งานและคำขอที่มีทั้งจุดเก่า/ใหม่ | `connection-measurement-cleanup.test.ts` |
| คงข้อมูลหลังล้างเมื่อ retry รวม direct request ID ใหม่ และกรณีไม่ได้รับ commit acknowledgement | `connection-measurement-cleanup.test.ts` |
| การลบตารางใดหรือการเขียน receipt ล้มเหลว ทำให้ rollback ทุกจุดในรอบนั้น | `connection-measurement-cleanup.test.ts` |
| ข้ามตารางที่ไม่มี แต่ metadata อ่านไม่ได้ต้องตอบ 503 | `connection-measurement-cleanup.test.ts` |
| รหัส Unicode, จุด, เครื่องหมายคำถาม, วงเล็บปิด และข้อความที่ดูเหมือน SQL เป็น identifier เดียว | `connection-measurement-cleanup.test.ts` |
| Verify, direct CONNECT และอนุมัติจุดยกเว้น เรียกล้างก่อนสร้าง live point; ล้มเหลวแล้วคืนสถานะ/ข้อมูลหลัก | `connection-requests.current-factory-profile.repository.test.ts`, `connection-requests.direct-connections.repository-happy-path.test.ts` |
| Maintenance sync ไม่ล้างย้อนหลัง | `connection-requests.current-factory-profile.repository.test.ts` |
| HTTP ส่ง error envelope 503 และ runtime OpenAPI ครบทุก endpoint ที่ activate จุดใหม่ | `connection-requests.direct-connections.integration.test.ts`, `connection-measurement-cleanup.openapi.test.ts` |
| Migration สร้างเฉพาะ receipt ในฐานค่าที่ตั้งไว้และไม่ล้างข้อมูล; rollback คง receipt | `connection-measurement-cleanup.migration.test.ts` |

## คำสั่งตรวจ

รันจาก `backend/` โดยชุดทดสอบ HTTP ใช้พอร์ตชั่วคราวในเครื่องและข้อมูลจำลอง:

```bash
npm run typecheck
npx jest --runInBand tests/unit/connection-requests tests/unit/connection-measurement-cleanup tests/unit/parameter-values.connection-test.openapi.test.ts tests/unit/api-docs.openapi.test.ts tests/unit/api-docs.route.test.ts tests/unit/alert-parameter-activations.point-hooks.test.ts tests/integration/connection-measurement-cleanup.sql-server.test.ts
```

ผลรวมสุดท้าย: 42 suites ผ่าน, 768 tests ผ่าน; ชุด SQL Server จริง 1 suite / 2 tests ถูกข้ามเพราะไม่ได้เปิดใช้ฐานสมมติเฉพาะ `typecheck` ผ่าน ตรวจ lint ของไฟล์ที่แตะแล้วไม่มี error โดยมี warning เดิมใน fixture โรงงาน 3 จุด

ข้อจำกัดหลักฐาน: การ rollback ในฐานหลักตรวจด้วย persisted-row fixture; การล้างในฐานค่าตรวจด้วย transaction fixture ที่จำลอง commit/rollback และตรวจ SQL lock hints จึงยังไม่ใช่หลักฐานว่ารันพร้อมกันผ่าน SQL Server จริงแล้ว ต้องรัน `backend/tests/integration/connection-measurement-cleanup.sql-server.test.ts` จากชุดโค้ดใน workspace บนฐานสมมติที่ผ่าน identity guard ก่อนถือว่าตรวจ locking กับ driver/database จริงครบ ไม่รันชุดนี้กับฐาน application

## ผลเตรียมฐานจริง 19 ตุลาคม 2026

ผู้ใช้อนุญาตให้รัน `0143` และเตรียมสิทธิ์ฐานค่าตาม contract ตรวจเป้าหมายจาก configuration ที่ใช้อยู่และยืนยัน identity ของฐานก่อนดำเนินการ โดยไม่บันทึก credential หรือชื่อบัญชีจริงในเอกสาร

| รายการ | ผลตรวจ |
| --- | --- |
| ฐานหลัก | `poms` |
| ฐานค่า / schema | `parameter_ingest.ingest` |
| Migration | `0143_create_connection_measurement_cleanup_receipts.ts` บันทึกสำเร็จ batch `117` |
| Migration อื่นที่รันในรอบนี้ | ไม่มี |
| Receipt table | `ingest.connection_measurement_cleanup_receipts` สร้างสำเร็จ ตรวจครบทั้ง 6 คอลัมน์ และมี 0 แถว ณ เวลาตรวจ |
| สิทธิ์ที่เพิ่ม | `VIEW DEFINITION` บน schema `ingest` ให้ database principal ของบัญชี runtime เดิม |
| สิทธิ์ runtime ที่ตรวจผ่าน | `SELECT`/`INSERT` ของ receipt และ `SELECT`/`DELETE` ของตารางค่าตรวจวัดครบ 4,862 ตาราง |
| การล้างค่าตรวจวัด / เปลี่ยนรหัสผ่าน / deploy | ไม่ได้ดำเนินการ |

ตัวเรียก migration ปกติหยุดในรอบแรกเพราะฐานบันทึก `0125_reuse_deleted_local_user_identity.ts` และ `0135_expand_user_prename.ts` ไว้แล้ว แต่สองไฟล์นี้ไม่มีใน checkout ปัจจุบัน ตรวจแล้วรอบแรกยังไม่สร้าง receipt และยังไม่บันทึก `0143` จึงรันผ่าน `migrate.up` โดยระบุชื่อ `0143` เท่านั้น และยกเว้นการตรวจหาไฟล์ประวัติที่หายเฉพาะคำสั่งนี้ ก่อนรันยืนยันว่ามี pending migration เพียง `0143` หลังรันเปรียบเทียบทะเบียนแล้วเพิ่มเฉพาะรายการนี้ ไม่ลบหรือแก้ประวัติเก่า และไม่เปลี่ยน configuration การตรวจ migration ปกติของ application

ข้อจำกัดที่ยังมีอยู่: การรัน migration แบบปกติจาก checkout นี้ยังต้องจัดหาไฟล์ประวัติ `0125` และ `0135` กลับมาก่อน การเตรียมฐานรอบนี้ไม่ได้แก้หรือสร้าง migration เก่าสองรายการแทน

## ตรวจทานตาม agent-self-evaluation ในรอบพัฒนา

```text
AGENT SELF-EVALUATION REPORT
Summary: Overall score 4.2/5 across 5 quality axes.

Accuracy         4/5 — Unit/HTTP/OpenAPI/typecheck ผ่าน; ยังไม่ได้รัน SQL Server จริง
  Improvement: รัน opt-in suite บน poms_measurement_cleanup_test ที่มี purpose marker
Completeness     5/5 — ครอบคลุมขอบเขตที่ยืนยันทั้ง 6 ตาราง ทุก flow และ failure/retry/audit
Clarity          4/5 — มี quick start, error fields และข้อจำกัดแยกชัด; ผู้ดูแลยังต้องเข้าใจ receipt namespace
  Improvement: ตรวจ namespace เดิมทุกครั้งที่ย้าย host/ชื่อฐาน ก่อนเปิดรับคำขอ
Actionability    4/5 — มี migration และสิทธิ์ที่ต้องใช้; ยังไม่ได้ provision/deploy เพราะไม่อยู่ในคำสั่ง
  Improvement: ใช้ขั้นตอน migration/permissions ใน canonical contract เมื่อเตรียม release
Conciseness      4/5 — ใช้ helper เดียวกับ 3 activation paths; เอกสารผู้ดูแลยาวขึ้นเพื่ออธิบายสอง transaction
  Improvement: ให้ frontend อ่าน quick start และ error contract ส่วนผู้ดูแลอ่านหัวข้อฐานข้อมูล

OVERALL          4.2/5
CRITICAL ISSUES: None
Self-check: Would the user agree? ควรยอมรับได้ เพราะระบุชัดว่าปกป้องจุดเดิมและยังไม่ได้แตะฐานจริง
TOP IMPROVEMENTS: ตรวจ SQL Server concurrency บนฐานสมมติก่อน release
VERDICT: ส่งมอบโค้ด/เอกสารพร้อมข้อจำกัดการตรวจจริง ก่อน deploy ต้อง provision receipt และสิทธิ์
```
