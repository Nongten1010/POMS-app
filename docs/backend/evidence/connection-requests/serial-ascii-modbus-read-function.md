# ผลตรวจ Serial ASCII และฟังก์ชันอ่าน Modbus

สัญญาหลักอยู่ที่ [ตั้งค่าอุปกรณ์ของจุดตรวจวัด](../../api/menus/connection-requests/device-configs.md) เอกสารนี้บันทึกขอบเขตและหลักฐานการทดสอบ โดยไม่แทนสัญญา API

## ขอบเขตที่ยืนยัน

- `POST` → `GET` ของ device-configs ทั้งคำขอและจุดที่เชื่อมต่อแล้ว: ตรวจค่าบันทึก/โหลดกลับ, validation, สิทธิ์และข้อมูลเก่า
- `GET /api/v1/openapi.json`: ตรวจ enum, settings ตาม protocol, optional field, ตัวอย่าง และ permission/status เดิม
- migration `up` / `down`: ตรวจ SQL ที่สร้าง และเตรียมชุดทดสอบกับฐาน SQL Server แยก

API tests ใช้ routes, validators, services และ repositories จริงผ่าน Supertest โดยให้ SQL ที่ Knex สร้างทำงานกับฐาน SQLite ในหน่วยความจำ และใช้ account fixture ของชุดทดสอบเดิม ไม่มีการเชื่อม application database หรือ production และไม่ทดสอบการสื่อสารกับอุปกรณ์จริง

## หลักฐาน TDD

1. ก่อนเพิ่ม protocol เทสต์ Serial ASCII ตอบ `400` แทน `201`; หลังเพิ่ม types, validator และ form mapper บันทึก/โหลดกลับได้ทั้งสองบริบท
2. ก่อนแก้ response mapper บันทึก `readFunction` ได้แต่ GET ไม่คืนค่าใน `connectionForms[].values`; หลังแก้ คืนค่าตามแต่ละอุปกรณ์ได้
3. ก่อนเพิ่ม validation ค่า `READ_COILS` ถูกบันทึกด้วย `201`; หลังแก้ Modbus รับเฉพาะ `READ_INPUT` / `READ_HOLDING` และข้อมูลเดิมไม่ถูกแทนที่เมื่อ payload ผิด
4. ก่อนแก้ OpenAPI ไม่มี `SERIAL_ASCII` และไม่มีข้อกำหนด settings แยกตาม protocol; หลังแก้สัญญาที่เสิร์ฟจาก endpoint ตรงกับ validation

Regression ครอบคลุม config เดี่ยว, batch และ form wrapper; หลาย protocol; `0`, `null`, optional settings; การเปลี่ยนค่าและล้าง `readFunction`; ไม่มี default; validation ของ Serial ASCII; batch ที่มีค่าผิด; token/permission, ขอบเขตพื้นที่, station และสถานะคำขอ

## คำสั่งตรวจ

รันจาก `backend/` ใน environment ทดสอบสังเคราะห์ โดยตั้ง `PARAMETER_DB_SCHEMA=ingest` และ `PUBLIC_BASE_URL=http://d-poms.diw.go.th` ตามสมมติฐานของชุดทดสอบเดิม ไม่ใช้ credentials ของ production:

```bash
npm test -- --runInBand tests/unit/device-config-protocols.api.test.ts tests/unit/device-config-protocols.openapi.api.test.ts tests/unit/serial-ascii-protocol.migration.test.ts
npm run build
npm run typecheck
npm run lint
npm run test:coverage -- --runInBand
npm audit --omit=dev
```

## ผล verification

| รายการ | ผล |
| --- | --- |
| Build | PASS |
| Typecheck | PASS |
| Lint ทั้ง backend | ไม่มี error; มี warning เดิม 355 รายการบน main ล่าสุด |
| Lint ไฟล์ TypeScript ที่แก้ในงานนี้ | PASS ด้วย `--max-warnings 0` 12 ไฟล์; service มี warning เดิมจาก main ที่อยู่นอกบรรทัดที่แก้ |
| Test suite ทั้ง backend | ผ่าน 4,941 ข้อ, ล้มเหลว 0 ข้อ, ข้าม 18 ข้อ; ผ่าน 368 suites |
| เทสต์ใหม่ที่รันได้ | API 25 ข้อ, OpenAPI endpoint 2 ข้อ, SQL generation 2 ข้อ; ผ่านทั้งหมด |
| SQL Server tests ที่ข้าม | migration ใหม่ 4 ข้อ; cleanup เดิม 10 ข้อ; chat เดิม 4 ข้อ |
| Coverage ทั้ง backend | statements 80.61%, branches 79.7%, functions 84.21%, lines 82.5% |
| Security review ของส่วนที่เพิ่ม | ไม่พบ secret-shaped literal, dynamic execution หรือ logging ใหม่; raw SQL ใช้เฉพาะ identifiers/protocol คงที่; validation และสิทธิ์มี API tests |
| ลิงก์เอกสารและ index | relative links ของ Markdown ที่แก้มีปลายทางจริง และ evidence ใหม่นี้ reachable จาก backend hub |
| ขอบเขต diff | 19 ไฟล์: backend 15 และ canonical Markdown 4; ไม่มี frontend; รวมการแก้ runtime dependencies ที่ผู้ใช้ขอ |

ผล SQL-generation test และ coverage ของ migration ไม่ยืนยันว่า SQL Server engine รัน migration ผ่าน ยังต้องตรวจตามหัวข้อถัดไปก่อนนำ migration ขึ้นใช้งาน ส่วน docs guard ใน repository มี specification แต่ยังไม่มี script สำหรับรัน จึงตรวจ links, reachability, placement และ declaration โดยตรง

### การแก้ช่องโหว่ runtime dependencies

อัปเดต `package.json` และ lockfile โดยจำกัดการเปลี่ยนที่ runtime dependency tree; `npm audit --omit=dev --json` หลังติดตั้งชุดส่ง production พบช่องโหว่ **0 รายการ** เทียบกับ baseline เดิม 11 รายการ:

| Severity เดิม | Dependencies ที่แก้ |
| --- | --- |
| Critical (1) | `proxy-addr` |
| High (7) | `@azure/identity`, `@azure/msal-node`, `body-parser`, `compression`, `multer`, `nodemailer`, `zod` |
| Moderate (3) | `ip-address`, `moment`, `qs` |

Direct dependency floors เป็น `compression ^1.8.2`, `multer ^2.5.0`, `nodemailer ^10.2.1` และ `zod ^4.6.7`. กำหนด overrides `@azure/identity 4.13.1` และ `@azure/msal-node 7.1.2` เพื่อใช้ MSAL ที่แก้ advisory พร้อมคง Node.js 20 ตาม engine ของ backend. ตรวจ dependency tree และติดตั้งจาก lockfile ในโฟลเดอร์ชั่วคราวด้วย `npm ci --ignore-scripts` ผ่าน

Nodemailer 10 เพิ่มชนิดข้อมูล envelope ในผลลัพธ์ จึงเพิ่ม envelope สมมติใน email route fixture; ตรวจ offline stream transport และสร้าง Azure credential/client แบบ offline ผ่าน โดยไม่ส่งอีเมลหรือขอ Azure token จริง การเปลี่ยน MSAL major กระทบ interactive browser/loopback flow ตาม migration guide; backend นี้ใช้ SQL user/password และไม่มี interactive flow ดังกล่าว

Full audit ซึ่งรวม devDependencies ยังมีอีก 11 รายการ (low 6, moderate 1, high 3, critical 1) ใน tooling เช่น Jest, deepmerge, handlebars, js-yaml, browserslist, baseline-browser-mapping และ brace-expansion; เป็นคนละชุดกับ runtime 11 รายการที่แก้ ไม่ได้เปลี่ยน devDependencies ในงานนี้

## SQL Server: ข้อจำกัดและวิธีเปิดใช้

เครื่องที่ตรวจไม่มี Docker daemon ที่ทำงานและไม่มีค่าการเชื่อมต่อฐาน SQL Server ทดสอบแยก จึงยังไม่ได้รัน migration กับ SQL Server จริง SQL-generation tests ไม่ยืนยันการทำงานของ engine และการข้าม SQL integration suite ไม่นับเป็นผ่าน

ชุดทดสอบ [`serial-ascii-protocol.sql-server.test.ts`](../../../../backend/tests/integration/serial-ascii-protocol.sql-server.test.ts) เปิดใช้เฉพาะ `POMS_DEVICE_CONFIG_SQL_TEST_ENABLED=true`; ค่าอื่นนอกจาก `true` / `false` ทำให้ล้มเหลว ถ้าเปิดใช้แต่ข้อมูลเชื่อมต่อไม่ครบจะล้มเหลวและไม่ fallback ไป application DB

ผู้ดูแลฐานทดสอบต้องเตรียมค่าผ่าน environment โดยไม่บันทึกรหัสผ่านใน Git:

| ตัวแปร | เงื่อนไข |
| --- | --- |
| `POMS_DEVICE_CONFIG_SQL_TEST_ENABLED` | `true` |
| `POMS_DEVICE_CONFIG_SQL_TEST_DATABASE` | ต้องเป็น `poms_device_config_test` |
| `POMS_DEVICE_CONFIG_SQL_TEST_HOST` | SQL Server ทดสอบที่เข้าถึงได้และมี TLS certificate ที่ตรวจสอบได้ |
| `POMS_DEVICE_CONFIG_SQL_TEST_PORT` | optional, default `1433`, จำนวนเต็ม `1`–`65535` |
| `POMS_DEVICE_CONFIG_SQL_TEST_USER` | บัญชีสำหรับฐานทดสอบแยก |
| `POMS_DEVICE_CONFIG_SQL_TEST_PASSWORD` | secret ของบัญชีทดสอบ |

ก่อนสร้าง fixture ชุดทดสอบตรวจ `DB_NAME()` และ database extended property `PomsTestPurpose = device-config-synthetic-only` และปฏิเสธเมื่อมีตาราง `device_connection_configs` อยู่แล้ว สร้าง/ลบเฉพาะตารางสมมติที่ตัวเองสร้าง และไม่อ่าน application `DB_*` หรือ `.env`

```bash
npm test -- --runInBand tests/integration/serial-ascii-protocol.sql-server.test.ts
```

ชุด SQL Server ตรวจว่า `up` เพิ่ม protocol โดยคงของเดิม, ค่าไม่รู้จักถูก constraint ปฏิเสธ, `down` ปฏิเสธทั้งแถวปกติและ soft-deleted ที่ยังเป็น Serial ASCII โดยข้อมูลยังอยู่ และคืน constraint เดิมได้เมื่อไม่มีข้อมูล Serial ASCII

## การนำขึ้นใช้งาน

ต้องรัน migration `0147_allow_serial_ascii_device_protocol` ก่อนรับ payload ใหม่ ชุดส่ง production แยกจาก workspace เดิมและประกอบจาก `origin/main` เพื่อรักษาการเปลี่ยนของทีม รวมเฉพาะ backend และ canonical Markdown รวม 19 ไฟล์ ไม่รวม frontend

ส่งผ่าน Git และ Deploy POMS ตาม [คู่มือ production](../../guides/production-git-delivery.md); หลัง workflow สำเร็จต้องตรวจ migration, health, deploy marker และ `/api/v1/openapi.json` บน production แล้วบันทึก commit และ workflow run ที่ยืนยันผลจริง

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/connection-requests/device-configs.md, docs/backend/api/integrations/device-configs/README.md
Reason: เพิ่ม protocol Serial ASCII และ optional Modbus readFunction พร้อมข้อกำหนด validation/response
Client impact: frontend
Breaking change: no
```
