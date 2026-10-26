# ส่ง backend ขึ้น production ผ่าน Git

[กลับสารบัญคู่มือ](./README.md)

บันทึก source, migration, ชุดทดสอบ และเอกสารที่เกี่ยวข้องเป็น commit และ push เข้า Git ก่อนเปลี่ยนไฟล์ application บนเซิร์ฟเวอร์ ให้ production ใช้ commit เดียวกับที่ตรวจแล้วผ่าน [Deploy POMS workflow](../../../.github/workflows/deploy.yml) เพื่อให้ตรวจย้อนหลังและส่งรุ่นถัดไปได้จาก Git

## ขั้นตอนปกติ

1. จัดชุดเปลี่ยนแปลงจาก `main` ล่าสุด ตรวจรายการไฟล์และ diff ให้ตรงขอบเขตงาน รวม canonical docs และ runtime OpenAPI เมื่อ contract เปลี่ยน
2. ตรวจ build, typecheck, lint และ tests ที่เกี่ยวข้อง พร้อมทบทวน migration และผลต่อข้อมูลเดิมก่อน commit/push
3. Push ชุดที่ตรวจแล้วเข้า `main` ตามวิธีส่งงานที่ผู้ใช้อนุญาต การ push ที่มีไฟล์ `backend/` จะเริ่ม workflow ปกติ ส่วนการสั่งเองใช้ `Deploy POMS`, branch `main`, `deploy_target: backend`
4. Workflow sync checkout, build/test, เตรียม release, หยุด backend ก่อน migration, ติดตั้งรุ่นใหม่ และตรวจ health ตามขั้นตอนใน workflow การ migration ใช้ประวัติที่ฐานบันทึกไว้ จึงต้องมีไฟล์ migration ใน Git ครบก่อนเริ่ม
5. ตรวจผล workflow, commit ใน deploy marker, health และ [production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) ให้ตรงกับ canonical contract แล้วบันทึกหลักฐาน release จึงถือว่า deploy สำเร็จ

การทดสอบ backend บน runner ที่ให้บริการ production ใช้ worker เดียว เพื่อจำกัดการแย่งทรัพยากรระหว่างเริ่มต้น test fixtures และคงการตรวจครบทั้งชุด

หาก checkout บนเซิร์ฟเวอร์มีการแก้ source โดยตรง ให้ตรวจและนำการแก้นั้นกลับเข้า Git ตามขั้นตอนถัดไปก่อน sync ทับ

## ตรวจ source ที่เคยแก้บนเซิร์ฟเวอร์

เรียก [Inspect production checkout](../../../.github/workflows/inspect-production-checkout.yml) แบบ manual บน branch `main` งานนี้อ่าน checkout โดยไม่แก้ source, ฐานข้อมูล หรือสถานะ service และเก็บเฉพาะ source ที่กำหนดไว้ 6 paths:

- `backend/src/modules/api-docs/poms.openapi.ts`
- `backend/src/modules/device-connections/device-connections.repository.ts`
- `backend/src/modules/integrations/integration-device-configs.controller.ts`
- `backend/src/modules/integrations/integration-device-configs.repository.ts`
- `backend/src/modules/integrations/integration-device-configs.service.ts`
- `backend/src/db/migrations/0144_track_device_config_request_source.ts`

Artifact `production-source-audit-<attempt>` เก็บ source, patch และ `manifest.json` ที่มี checkout HEAD, รายการ tracked changes, สถานะของ paths ที่ตรวจ และ SHA-256 ของแต่ละไฟล์ เก็บ 3 วันตาม workflow ไม่รวม `.env` หรือ credentials ให้ดาวน์โหลดและตรวจภายในอายุ artifact

ตรวจ hash ของไฟล์ artifact กับ manifest ก่อนเทียบกับ candidate แล้วทบทวนว่ารวมการแก้ที่ยังใช้งานจริงกลับเข้า Git ครบ รวม migration ที่อาจยังเป็น untracked บนเซิร์ฟเวอร์ หากมี path อื่นหรือเนื้อหาต่างจากที่ตรวจไว้ ให้หยุดและทำ audit ใหม่ ไม่ใช้ manifest เก่ารับรองการแก้เพิ่ม

## Sync checkout หลังนำการแก้เดิมเข้า Git แล้ว

หลัง commit/push candidate ที่รวม source เดิมครบและตรวจแล้ว ให้เรียก `Deploy POMS` แบบ manual บน `main`:

| Input | ค่า |
| --- | --- |
| `deploy_target` | `backend` |
| `reconcile_server_changes` | `true` เฉพาะรอบที่ต้องเก็บการแก้เดิมบนเซิร์ฟเวอร์ก่อน sync |
| `server_snapshot_manifest` | JSON ทั้งฉบับของ manifest ที่ตรวจแล้วจาก artifact |

[Helper สำหรับ reconcile](../../../backend/deploy/windows/reconcile-production-checkout.cjs) ตรวจ snapshot, target commit และ `main` ก่อนจัดเก็บ backup นอก webroot พร้อม stash เฉพาะ tracked changes และเก็บ migration `0144` ที่เป็น untracked แยกใน backup แล้วจึงเลื่อน checkout แบบ fast-forward ขั้นตอนนี้ไม่ใช้ `reset`/`clean` เพื่อล้างการแก้และไม่ `stash pop` กลับมาทับ source รุ่นใหม่ รายละเอียดเงื่อนไขและรูปแบบ metadata ให้ยึด helper กับ workflow ที่ commit นั้น

หาก HEAD, hash, path หรือ target ไม่ตรงกับข้อมูลที่ตรวจไว้ ให้หยุดการ reconcile และสร้าง audit ใหม่ การได้ backup หรือ stash ยังไม่ใช่ผลยืนยันว่า deploy สำเร็จ ต้องตรวจขั้นตอน build/tests, migration, health และ production OpenAPI หลังจากนั้นครบตาม workflow

เมื่อ checkout สะอาดแล้ว รอบถัดไปใช้เส้นทางปกติโดยไม่เปิด `reconcile_server_changes` การเปลี่ยน source ครั้งต่อไปเริ่มจาก Git ก่อนเสมอ เก็บ backup และ metadata สำหรับตรวจย้อนกลับโดยไม่ส่ง credentials หรือ response ที่มี `dbPass` ลง log

ดู [หลักฐานการนำ integration config กลับเข้า Git](../evidence/integrations/device-config-request-status.tdd.md) สำหรับ snapshot ของรอบที่ตรวจจริง หลักฐานแต่ละรอบยืนยันเฉพาะ commit และเวลาที่ระบุ
