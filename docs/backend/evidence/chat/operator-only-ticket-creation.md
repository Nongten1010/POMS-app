# Chat: หลักฐานการตรวจสิทธิ์เปิดเรื่องเฉพาะผู้ประกอบการ

อ้างอิง [สัญญา Chat API](../../api/menus/chat/README.md#chat-operator-only-creation), [breaking change และขั้นตอนย้าย client](../../api/CHANGELOG.md#chat-operator-only-creation) และ [frontend handoff วันที่ 18 ตุลาคม 2026](https://github.com/Nongten1010/POMS-app/blob/main/frontend/md/frontend-handoff-18102026.md)

หลักฐานนี้ครอบคลุมการเปลี่ยนสิทธิ์เปิดเรื่องใน backend, canonical docs และ runtime OpenAPI เท่านั้น ผลตรวจ implementation เดิมอยู่ที่ [หลักฐาน Chat รอบก่อน](./backend-verification.md) และไม่ใช้แทนผลตรวจรอบนี้

## ขอบเขตที่ตรวจ

- ผู้ประกอบการที่มี `chat:view` เปิดเรื่องได้โดยไม่ต้องมี legacy `chat:ask` หรือ `chat:answer`
- เจ้าหน้าที่ ผู้ดูแล และบัญชี custom ที่ไม่ใช่ผู้ประกอบการได้ `canCreate=false` และเปิดเรื่องไม่ได้แม้เรียก API ตรงหรือมี legacy permissions ครบ; การปฏิเสธไม่สร้าง Ticket ข้อความ เหตุการณ์ หรือเลขลำดับ
- เจ้าหน้าที่และผู้ดูแลยังอ่าน ตอบ และปิดเรื่องด้วย `chat:view` และขอบเขตโรงงานปัจจุบันตามเดิม รวมบัญชีที่ถอน legacy permissions แล้ว
- ตรวจสิทธิ์จริงจาก server แทน role ใน token และตรวจสิทธิ์ใหม่ระหว่าง session รวมการส่งซ้ำเพื่อสร้างเรื่อง ส่งข้อความ และปิดเรื่อง
- โรงงานนอกขอบเขตไม่ปรากฏในรายการ และเรียกรายละเอียด ประวัติ ตอบ หรือปิดไม่ได้
- โรงงานที่เข้าข่ายแต่ยังไม่เชื่อมต่อและไม่มีจุดตรวจวัดเปิดเรื่องระดับโรงงานด้วย `measurementPoint: null` ได้
- รายการโรงงาน 30 แห่งแบ่งเป็น 25 และ 5 รายการ ไม่ซ้ำ ไม่ตกหล่น และการถอนสิทธิ์ระหว่างโหลดหน้ามีผลกับคำขอถัดไป
- หัวข้อทั้ง 6 รหัส, โครงสร้าง payload/response, pagination, idempotency และสถานะหลังปิดเรื่องคงเดิม
- Runtime OpenAPI ประกาศสิทธิ์ `chat:view` พร้อมขอบเขตโรงงานโดยไม่เติม `chat:ask` กลับ; ข้อจำกัด `userType=operator` อยู่เฉพาะการสร้าง Ticket

ใช้ HTTP tests กับ middleware ยืนยันตัวตนและการคำนวณสิทธิ์ปัจจุบันจริง ข้อมูลโรงงาน ผู้ใช้ และข้อความเป็นข้อมูลสมมติใน SQL.js fixture เท่านั้น ไม่มีการเชื่อมต่อหรือเขียนฐาน production

## หลักฐานก่อนปรับพฤติกรรม

ก่อนแก้ implementation เพิ่มกรณีผู้ประกอบการที่มีเพียง `chat:view` แล้วรัน:

```bash
npm test -- --runInBand tests/unit/chat.routes.test.ts -t 'lets an operator with chat:view open'
```

ผลล้มเหลวที่ `canCreate`: คาด `true` แต่ได้ `false` เพราะ workspace เดิมยังบังคับ `chat:ask` เพิ่ม หลังแก้ตัวคำนวณสิทธิ์จึงผ่านโดยไม่ต้องเพิ่ม legacy permissions

ชุด Chat เดิมก่อนแก้ผ่าน 66 ข้อและล้มเหลว 1 ข้อที่การทดสอบ global rate limit ใช้ `/health` เป็นคำขอเริ่มต้น แต่ endpoint ตอบ `501` ใน workspace นี้ ปรับเฉพาะ test ให้ใช้ unauthenticated `GET /chat/options` ที่คาด `401` ก่อนครบเพดาน แล้วตรวจ `429` และ media type จริง โดยไม่เปลี่ยน health endpoint หรือ rate-limit policy

## ผลตรวจใน workspace ก่อนเตรียม release

รันจาก `backend/` ด้วย dependencies ที่ติดตั้งอยู่ โดยไม่ติดตั้งหรืออัปเดต package เพิ่ม:

| การตรวจ | วิธีตรวจ | ผล |
| --- | --- | --- |
| ชนิดข้อมูล | `npm run typecheck` | ผ่าน |
| ทดสอบ backend ทั้งชุด | `npm test -- --runInBand` พร้อมเก็บผล JSON ในไฟล์ชั่วคราวนอก repository | 329 suites ผ่าน; 4,138 tests ผ่าน; 4 tests ข้าม; ไม่มีข้อผิดพลาด |
| Chat ภายในผลทดสอบทั้งชุด | HTTP, persistence, factory access, runtime OpenAPI และ SQL test harness | 5 suites; 88 tests ผ่าน; 4 tests SQL Server ข้าม |
| Lint เฉพาะไฟล์ TypeScript ที่เปลี่ยน | `npx --no-install eslint src/modules/chat/chat.access.ts src/modules/api-docs/chat.openapi.ts src/modules/api-docs/poms.openapi.ts tests/unit/chat.routes.test.ts tests/unit/chat.openapi.test.ts` | ไม่มี error; มี warning รูปแบบเดิม 1 จุดใน `poms.openapi.ts` ซึ่งตรงกับ baseline และอยู่นอกส่วนที่แก้ |
| ลิงก์และการเข้าถึงเอกสาร | ตรวจ Markdown 125 ไฟล์ใต้ `docs/backend/` และเส้นทางจาก backend hub | เอกสารที่แก้ไม่มีลิงก์เสีย; active documents ไม่มี orphan; พบลิงก์ PDF เดิมที่หายใน `guides/README.md` ซึ่งไม่ได้แก้ในงานนี้ |
| ตัวอย่างและลิงก์ breaking change | parse JSON examples ในเอกสารที่แก้ และตรวจ anchor ใหม่ | ตัวอย่าง JSON 14 ชุดผ่าน; anchor ตรงกัน |
| Endpoint registry | อ่าน AST ของ Chat router แล้วเทียบกับ `api/ENDPOINTS.md` | 9 operations ตรงกัน ไม่มีรายการหาย เกิน หรือซ้ำ |
| ตรวจทานอิสระ | เทียบ code, tests, OpenAPI และ canonical docs กับ baseline ก่อนเริ่มงาน | ไม่พบข้อบกพร่องที่ต้องแก้ |

คำขอ HTTP ภายใน tests ต้องเปิดพอร์ตชั่วคราวบนเครื่อง การรันเต็มครั้งแรกถูก sandbox ปฏิเสธการเปิดพอร์ต จึงรันซ้ำด้วยสิทธิ์ที่รองรับพอร์ตภายในเครื่องและได้ผลผ่านข้างต้น ไม่ได้เปลี่ยน tests หรือ application เพื่อข้ามข้อจำกัดนั้น

Repository ยังไม่มี package script `docs:check` จึงใช้การตรวจเอกสารแบบอ่านอย่างเดียวตามรายการข้างต้น ไม่อ้างว่ารัน CI documentation guard ครบทุกส่วน ลิงก์เดิมที่พบคือ `docs/backend/guides/integrations/integration-alert-events-production-test-guide.pdf`

## ผลตรวจชุดเตรียม production

แยก checkout จาก `main` commit `e9580424966d21f8925aa2bac466b2567301a1ae` เพื่อรักษางานค้างใน workspace เดิม แล้วนำเฉพาะการเปลี่ยนสิทธิ์ Chat มารวมกับ contract และ tests ล่าสุดของ `main` ติดตั้ง dependencies ด้วย `npm ci` ตาม lockfile เดิมของ `main` โดยไม่เปลี่ยน package files

| การตรวจ | ผล |
| --- | --- |
| Build และ typecheck | `npm run build` และ `npm run typecheck` ผ่าน |
| Lint ไฟล์ TypeScript ที่เปลี่ยน | ผ่าน ไม่มี error หรือ warning |
| Chat HTTP regression | 55 tests ผ่าน รวม checkbox cases เดิมบน `main` |
| Chat runtime OpenAPI | 9 tests ผ่าน รวม editable permission matrix เดิมบน `main` |
| Chat ทั้ง 5 suites ในการรันเต็ม | 97 tests ผ่าน และ SQL Server 4 tests ข้าม |
| Backend ทั้งชุด | 338 suites: 336 suites ผ่าน; 4,475 tests ผ่าน; 3 tests ได้ HTTP `501`/socket hang up ในสอง suites นอก Chat; 4 SQL tests ข้าม |
| ตรวจซ้ำสอง suites ที่ได้ผลไม่คงที่ | `measurement-csv-export.route.test.ts` และ `poms-factories.route.test.ts` ผ่านทั้งสอง suites รวม 49 tests โดยไม่เปลี่ยนโค้ด |
| เอกสาร | Markdown 124 ไฟล์ไม่มี active orphan; เอกสารที่แก้ไม่มีลิงก์เสีย; JSON examples 15 ชุดผ่าน; ลิงก์ PDF เดิมที่หายยังเป็นข้อจำกัดนอกงานนี้ |
| Endpoint registry และ diff | Chat 9 operations ตรงกับ router AST; `git diff --check` ผ่าน; ตรวจทานอิสระแล้วไม่พบประเด็นที่ต้องแก้ |

ชุดทดสอบรันด้วยค่า DB/JWT จำลอง ไม่คัดลอก `.env` หรือ credentials จริง การรันเต็มครั้งแรกพบ tests เดิมอิง `PUBLIC_BASE_URL` และ `PARAMETER_DB_SCHEMA` จึงกำหนดค่าจำลอง `http://d-poms.diw.go.th` และ `ingest` ให้ตรงกับ expectation ก่อนรันเต็มและตรวจซ้ำตามผลข้างต้น ค่าทั้งสองใช้เป็น metadata ใน tests ไม่ได้ใช้ส่งคำขอไป production

ผลทดสอบชุดเตรียม release นี้ยังไม่ใช่หลักฐานว่า deployment สำเร็จ ต้องตรวจผล build/test/restart/health ของ workflow สำหรับ commit ที่ส่ง และตรวจ runtime OpenAPI ตามสัญญาหลัง deployment

## ไฟล์สำหรับตรวจซ้ำ

- [ตัวคำนวณสิทธิ์ Chat](../../../../backend/src/modules/chat/chat.access.ts)
- [HTTP และ authorization regression tests](../../../../backend/tests/unit/chat.routes.test.ts)
- [Persistence และ idempotency tests](../../../../backend/tests/unit/chat.repository.test.ts)
- [ขอบเขตโรงงานและจุดตรวจวัด](../../../../backend/tests/unit/chat-factories.repository.test.ts)
- [Runtime OpenAPI tests](../../../../backend/tests/unit/chat.openapi.test.ts)
- [ฐานทดสอบสมมติและข้อจำกัด SQL Server](./sql-server-verification.md)

## ข้อจำกัดและการส่งต่อ

ยังไม่มีการกำหนด `CHAT_SQL_TEST_ENABLED` หรือค่าฐานทดสอบ `POMS_SQL_TEST_*` ใน environment นี้ จึงยังไม่ยืนยัน concurrency, lock หรือ dialect บน SQL Server จริง การทดสอบ SQL.js ไม่ใช้แทนหลักฐานดังกล่าว งานนี้ไม่ได้เปลี่ยน transaction หรือ schema ของ Chat

การเปลี่ยนนี้อยู่ใน backend และเอกสารกลาง ไม่เพิ่ม migration ผลทดสอบในเอกสารเก็บก่อน commit/push/deploy หลัง deployment ต้องตรวจ `/api/v1/openapi.json` และการใช้งานร่วมกับ frontend ด้วยบัญชีทดสอบก่อนยืนยัน authenticated behavior บน production

Docs impact: updated

Canonical docs: [Chat API](../../api/menus/chat/README.md), [จัดการสิทธิ์การใช้งาน](../../api/menus/permissions/README.md)

Reason: จำกัดผู้เปิดเรื่องเฉพาะผู้ประกอบการ พร้อมรักษาสิทธิ์อ่าน ตอบ และปิดเรื่องตามเดิม และปรับ runtime OpenAPI ให้ตรงกัน

Client impact: frontend

Breaking change: yes

ดู [รายการ breaking change](../../api/CHANGELOG.md#chat-operator-only-creation)
