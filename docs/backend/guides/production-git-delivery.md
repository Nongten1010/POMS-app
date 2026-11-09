# ส่ง backend ขึ้น production ผ่าน Git

[กลับสารบัญคู่มือ](./README.md)

บันทึก source, migration, ชุดทดสอบ และเอกสารที่เกี่ยวข้องเป็น commit และ push เข้า Git ก่อนเปลี่ยนไฟล์ application บนเซิร์ฟเวอร์ ให้ production ใช้ commit เดียวกับที่ตรวจแล้วผ่าน [Deploy POMS workflow](../../../.github/workflows/deploy.yml) เพื่อให้ตรวจย้อนหลังและส่งรุ่นถัดไปได้จาก Git

## ขั้นตอนปกติ

1. จัดชุดเปลี่ยนแปลงจาก `main` ล่าสุด ตรวจรายการไฟล์และ diff ให้ตรงขอบเขตงาน รวม canonical docs และ runtime OpenAPI เมื่อ contract เปลี่ยน
2. ตรวจ diff, lint และ tests ที่เกี่ยวข้องตามความเสี่ยง พร้อมทบทวน migration ก่อน commit/push; ไม่รันชุดทดสอบ backend ทั้งหมดซ้ำในเครื่องเพียงเพื่อส่ง deploy เมื่อ CI จะตรวจ commit นั้นอยู่แล้ว สำหรับการแก้ deployment helpers ให้รัน `node --test backend/deploy/detect-changes.test.cjs backend/deploy/release-artifact.test.cjs` และตรวจ syntax ของ workflow
3. Push ชุดที่ตรวจแล้วเข้า `main` ตามวิธีส่งงานที่ผู้ใช้อนุญาต การแก้ backend application, migrations, package files, deployment helpers หรือ workflow นี้จะตรวจและส่ง backend; การแก้เฉพาะ tests จะตรวจ CI แต่ไม่ restart production ส่วนการสั่งเองใช้ `Deploy POMS`, branch `main`, `deploy_target: backend`
4. Job `backend_ci` บน GitHub-hosted Ubuntu ติดตั้งตาม lockfile, build และรัน tests ทั้งหมดครั้งเดียวด้วย 2 workers พร้อมข้อมูลทดสอบและ JWT keys ชั่วคราว โดยไม่อ่าน production `.env` แล้วส่ง compiled `dist`, package files และ manifest ของ commit นั้นเป็น artifact. Job production เริ่มได้เฉพาะ `main` หลัง CI สำเร็จ ตรวจ commit/checksum และ package metadata ก่อน stage release จากนั้น sync checkout, เตรียม Windows runtime dependencies, หยุด backend ก่อน migration, ติดตั้ง และตรวจ health. การ migration ยังคงใช้ไฟล์ TypeScript และประวัติเดิมในฐาน จึงต้องมี migration ใน Git ครบ
5. ตรวจผล workflow, commit ใน deploy marker, health และ [production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) ให้ตรงกับ canonical contract แล้วบันทึกหลักฐาน release จึงถือว่า deploy สำเร็จ

## การลดเวลารอและขอบเขตการตรวจ

- Production ไม่ build หรือรัน tests backend ซ้ำ ใช้ artifact ที่ผูก `github.sha` เดียวกับ checkout และตรวจ SHA-256 ของทุกไฟล์ผ่าน [release helper](../../../backend/deploy/release-artifact.cjs) ก่อนแตะ service; ไม่ยอมรับ artifact ขาดไฟล์ เพิ่มไฟล์ แก้เนื้อหา หรือมาจาก commit อื่น
- Artifact ไม่รวม production `.env` หรือ `node_modules`; ไม่คัดลอก native dependencies ของ Linux ไป Windows
- Migrations ใช้ `ts-node` แบบ transpile-only บน production เพราะ CI build ตรวจ TypeScript รวม migrations แล้ว จึงไม่ต้องติดตั้ง dev dependencies หรือ typecheck ซ้ำระหว่างหยุด service
- Windows cache runtime dependencies ตาม package-lock และ Node ABI; ติดตั้ง `npm ci --omit=dev` เฉพาะ cache ไม่ตรง และคัดลอกไป backend target เฉพาะ target ยังไม่มีชุดเดียวกัน จึงไม่ติดตั้ง dependencies สองรอบต่อ release
- Checkout บน production โหลด Git LFS เฉพาะรอบที่ deploy frontend; frontend ยัง build ด้วย `.env.production` บน Windows ตามเดิม เพราะ configuration นี้อยู่เฉพาะเซิร์ฟเวอร์ ไม่มีการย้าย credentials ไป CI
- CI ยกเลิกงานตรวจเก่าที่ถูกแทนที่ได้ แต่ production deploy เรียงทีละงานและไม่ถูกยกเลิกกลาง migration/restart เมื่อมี push ใหม่
- PR และ manual run บน feature branch ตรวจ hosted CI ได้ แต่ไม่เข้าถึง production job. Docs-only changes ไม่ deploy application
- ทดสอบเงื่อนไขเลือกส่วนงานและความครบถ้วนของ artifact ด้วย [deployment tests](../../../backend/deploy/release-artifact.test.cjs), [change detection tests](../../../backend/deploy/detect-changes.test.cjs); การส่ง artifact ระหว่าง jobs ใช้ [GitHub Actions artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)

เวลาจริงขึ้นอยู่กับ npm cache และ runner ให้ดูระยะ `backend_ci` แยกจาก production install ใน workflow run เพื่อระบุคอขวด โดยไม่ตัดการตรวจทั้งชุดเพื่อให้ deploy ผ่าน

หาก checkout บนเซิร์ฟเวอร์มีการแก้ source โดยตรง ให้ตรวจและนำการแก้นั้นกลับเข้า Git ตามขั้นตอนถัดไปก่อน sync ทับ

## ตรวจ source ที่เคยแก้บนเซิร์ฟเวอร์

เรียก [Inspect production checkout](../../../.github/workflows/inspect-production-checkout.yml) แบบ manual บน branch `main` งานนี้อ่าน checkout โดยไม่แก้ source, ฐานข้อมูล หรือสถานะ service และเก็บเฉพาะ source ที่กำหนดไว้ 11 paths และรายชื่อ untracked backend source โดยไม่อ่านไฟล์ environment:

- `backend/src/shared/services/factory-source-provinces.ts`
- `backend/src/config/env.ts`
- `backend/src/modules/auth/identity-provider/diw-user-login.identity-provider.ts`
- `backend/src/modules/auth/identity-provider/index.ts`
- `backend/src/modules/eligible-factories/eligible-factories.service.ts`
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

หาก HEAD, hash, path หรือ target ไม่ตรงกับข้อมูลที่ตรวจไว้ ให้หยุดการ reconcile และสร้าง audit ใหม่ การได้ backup หรือ stash ยังไม่ใช่ผลยืนยันว่า deploy สำเร็จ ต้องตรวจผล CI build/tests, artifact verification, migration, health และ production OpenAPI หลังจากนั้นครบตาม workflow

เมื่อ checkout สะอาดแล้ว รอบถัดไปใช้เส้นทางปกติโดยไม่เปิด `reconcile_server_changes` การเปลี่ยน source ครั้งต่อไปเริ่มจาก Git ก่อนเสมอ เก็บ backup และ metadata สำหรับตรวจย้อนกลับโดยไม่ส่ง credentials หรือ response ที่มี `dbPass` ลง log

ดู [หลักฐานการนำ integration config กลับเข้า Git](../evidence/integrations/device-config-request-status.tdd.md) สำหรับ snapshot ของรอบที่ตรวจจริง หลักฐานแต่ละรอบยืนยันเฉพาะ commit และเวลาที่ระบุ
