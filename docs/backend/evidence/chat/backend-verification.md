# ผลตรวจ backend Chat / Ticket

อ้างอิง [สัญญา API เมนู Chat](../../api/menus/chat/README.md) และ frontend handoff `frontend/md/frontend-handoff-17102026.md` ที่ดึงจาก `origin/main` commit `6a22b5ec5caf9d4000fd59f91048784b42969adc` ก่อนเริ่ม implementation

## ขอบเขตและวิธีทดสอบ

เพิ่ม API 9 operations, migration `0141_create_chat_tickets.ts`, สิทธิ์โรงงาน, ประวัติข้อความและเหตุการณ์, idempotency, pagination, เลข Ticket รายปี และ runtime OpenAPI โดยไม่เปลี่ยน frontend ในรอบ implementation นี้

ใช้ทักษะ `mattpocock-skills:tdd`, `ecc:api-design`, `ecc:verification-loop` และ `ecc:security-review` ทดสอบที่ขอบเขต HTTP, persistence/transaction และ runtime OpenAPI ตามแผน ใช้ข้อมูลสมมติและแทนเฉพาะขอบเขตฐานข้อมูล/เวลา/การเขียน log; HTTP tests ใช้ middleware และตัวคำนวณสิทธิ์ปัจจุบันจริง

ตัวอย่างรอบ RED → GREEN ที่ตรวจเห็นจริง:

| พฤติกรรม | ก่อนเพิ่มการรองรับ | ผลหลังแก้ |
| --- | --- | --- |
| เข้าถึง chat โดยไม่เข้าสู่ระบบ | ได้ `404` แทน `401` | ต้องยืนยันตัวตน |
| token เดิมหลังถอน `chat:view` | ได้ `404` แทน `403` | ตรวจสิทธิ์ปัจจุบันทุก request |
| เปิดเรื่องด้วยข้อความว่าง | endpoint ยังไม่ปฏิเสธด้วย validation | `400 VALIDATION_ERROR` |
| ส่งคำขอซ้ำหลังปิดเรื่อง | ทดสอบที่ persistence boundary ก่อนเพิ่ม replay | คืนข้อความเดิม โดยยังตรวจสิทธิ์ปัจจุบัน |
| identity โรงงานกำกวมหรือทะเบียนถูกใช้ซ้ำ | ผู้ประกอบการอาจเห็นโรงงานอื่นจากการจับคู่ทะเบียน | ปฏิเสธเมื่อจับคู่ master ไม่ชัดเจน รวมประวัติที่ถูกลบ |
| database error มีข้อความแชตอยู่ภายใน | synthetic private text ปรากฏใน log | ตัดข้อมูล error ดิบก่อนส่งเข้า logger |
| JSON ผิดรูปแบบก่อนเข้า router | `500` และ error มี raw body | `400 BAD_REQUEST` โดยไม่บันทึก raw body |
| write request ครั้งที่ 31 ในหนึ่งนาที | ยังประมวลผลตามปกติ | `429` ต่อบัญชี พร้อม `Retry-After`; ยังอ่านได้ |
| รูปแบบ global rate-limit response | contract ระบุ `text/plain` | ตรวจ HTTP จริงแล้วแก้เป็น `text/html` |

## ผลตรวจจาก workspace

รันจาก `backend/`:

| การตรวจ | คำสั่ง | ผล |
| --- | --- | --- |
| Build | `npm run build` | ผ่าน |
| Types | `npm run typecheck` | ผ่าน |
| Lint ทั้ง backend | `npm run lint` | ผ่านโดยไม่มี error; มีคำเตือนเดิมนอกส่วน Chat |
| Lint ไฟล์ Chat/migration/fixture/contract tests ใหม่ | `npx --no-install eslint ...` ตามรายชื่อไฟล์ด้านล่าง | ผ่าน ไม่มี warning |
| ทดสอบทั้ง backend | `npm test -- --runInBand` | 329 suites ผ่าน; 4,121 tests ผ่าน, 4 tests ข้าม, ไม่มี test ล้มเหลว |
| ทดสอบ Chat พร้อม coverage | คำสั่งด้านล่าง | 5 suites ผ่าน; 71 tests ผ่าน, 4 tests ข้าม |
| เอกสาร | ตรวจ relative links, JSON examples, registry และ OpenAPI references | ผ่าน |
| ขอบเขตการแก้ไข | เทียบ checksum กับก่อนเริ่มงาน และตรวจ diff | เฉพาะ `backend/` กับ `docs/backend/`; frontend ไม่เปลี่ยน |

```bash
npm test -- --runInBand --runTestsByPath \
  tests/unit/chat.routes.test.ts \
  tests/unit/chat.repository.test.ts \
  tests/unit/chat-factories.repository.test.ts \
  tests/unit/chat.openapi.test.ts \
  tests/integration/chat.sql-server.test.ts \
  --coverage --collectCoverageFrom='src/modules/chat/**/*.ts'
```

Coverage ของ `src/modules/chat/`: statements **93.52%**, branches **86.64%**, functions **100%**, lines **98.1%** ตัวเลขนี้ไม่รวมการยืนยัน SQL Server dialect หรือ concurrency จริง

ไฟล์หลักสำหรับตรวจซ้ำ:

- [HTTP และ security tests](../../../../backend/tests/unit/chat.routes.test.ts)
- [Persistence tests](../../../../backend/tests/unit/chat.repository.test.ts)
- [Factory/point access tests](../../../../backend/tests/unit/chat-factories.repository.test.ts)
- [Runtime OpenAPI tests](../../../../backend/tests/unit/chat.openapi.test.ts)
- [Migration](../../../../backend/src/db/migrations/0141_create_chat_tickets.ts)

## ผลตรวจชุด release บน main ล่าสุด

เตรียม branch `backend/chat-tickets` จาก `origin/main` commit `6a22b5ec5caf9d4000fd59f91048784b42969adc` โดยย้ายเฉพาะการเปลี่ยนแปลง Chat 27 ไฟล์ ไม่รวมงานค้างอื่นใน workspace, frontend, package dependencies หรือ deployment workflow

- `npm ci --ignore-scripts`, build และ typecheck ผ่านบน dependency lockfile ของ main
- Lint ผ่าน: 0 errors; 346 warnings เดิมนอก Chat
- รันทดสอบทั้งหมด 338 suites: 335 suites ผ่านทันที อีก 3 suites มี 10 assertions ที่ต้องใช้ `PUBLIC_BASE_URL` และ `PARAMETER_DB_SCHEMA=ingest`; หลังใส่ค่าทดสอบ รัน 3 suites นั้นซ้ำผ่านทั้ง 115 tests โดยไม่แก้ application code
- ผลรวมจาก full run และ targeted rerun: 338 suites ผ่าน, 4,452 tests ผ่าน, 4 SQL Server integration tests ข้าม; ใช้ DB/JWT จำลอง ไม่ใช้ credentials production
- ตรวจ deployment ล่าสุดที่แตะ backend: run `38900838578`, commit `028fb97bf559dcd44790aefeee59e19b9f8b986a`; ไม่มี backend delta จาก commit นั้นถึง main ก่อน Chat จึงเพิ่ม migration `0141` เพียงรายการเดียวใน release นี้
- Migration เพิ่มตาราง Chat 4 ตารางและ index/FK โดยไม่แก้ข้อมูลธุรกิจเดิม; หากคืน application ต้องคง migration/schema Chat ไว้ ไม่ใช้ `down` เพื่อลบข้อมูล

## ผลตรวจ release ก่อนหน้า: การเปิดเรื่องตามสิทธิ์

release ก่อนหน้าแก้กรณีเจ้าหน้าที่ที่มี `chat:ask` เปิด Ticket ไม่ได้ โดยขณะนั้นกำหนดว่า: เปิดเรื่องต้องมี `chat:view` และ `chat:ask`; ส่งข้อความ/ปิดเรื่องใช้ `chat:ask` หรือ `chat:answer` เพิ่มจากสิทธิ์อ่าน ขอบเขตโรงงานและความสัมพันธ์โรงงานของผู้ประกอบการยังตรวจตามเดิม ไม่แก้สิทธิ์หรือประเภทบัญชีจริง

- Regression ผ่าน HTTP พบก่อนแก้ว่าเจ้าหน้าที่มี `chat:ask` แต่ได้ `403`; หลังแก้ได้ `201` และ `/options` คืน `canCreate=true`
- กรณีเจ้าหน้าที่มี `chat:ask` อย่างเดียวเคยได้ `canReply=false`/`canClose=false`; หลังแก้ส่งข้อความและปิดเรื่องได้
- ตรวจถอนสิทธิ์หลังออก token, custom permissions, โรงงานนอกจังหวัด, ผู้ดูแลที่ไม่มี `chat:ask` และเจ้าหน้าที่ที่มีเฉพาะ `chat:answer` ผ่าน
- Chat HTTP/persistence/factory/OpenAPI regression: 4 suites, 72 tests ผ่านด้วยข้อมูลสมมติ ไม่มีการสร้าง token แทนบัญชีจริงหรือเขียนข้อมูลทดสอบลง production
- Runtime OpenAPI และ canonical contract ปรับกติกาสิทธิ์ตรงกันแล้ว; independent diff/security review ไม่พบข้อบกพร่องที่ต้องแก้

## ตรวจสิทธิ์จากช่องมีสิทธิ์ใช้งาน

ข้อกำหนดปัจจุบันคือ `permissions.chat.view` / `chat:view` ใช้เปิด Ticket ส่งข้อความ และปิดเรื่องภายในขอบเขตโรงงานเดิม ทั้งบัญชีที่บันทึกสิทธิ์ไว้แล้วและการบันทึกใหม่ ไม่ต้องเพิ่ม `chat:ask` หรือ `chat:answer` ไม่แก้ role สิทธิ์รายบัญชี หรือข้อมูล production เพื่อให้ผ่านการตรวจสิทธิ์

- Runtime OpenAPI test ที่ `GET /api/v1/openapi.json` พบก่อนแก้ว่าสัญญาเปิด Ticket ยังบังคับ `chat:ask`; หลังแก้ระบุ `chat:view` และ `eligible_factories:view` ตามขอบเขตจริง
- Runtime OpenAPI test ส่งข้อความ/ปิดเรื่องพบก่อนแก้ว่า metadata ยังบังคับ legacy ask/answer; หลังแก้ใช้ `chat:view`
- Runtime OpenAPI test ของ editable permission matrix พบว่าช่อง Chat ไม่มีคำอธิบายการใช้งาน; หลังแก้อธิบาย `view` สำหรับเปิดเรื่อง/สนทนา/ปิด และ `edit` ยังคง map `chat:answer` โดยไม่เปลี่ยน role
- Canonical Chat และ Permission Management อธิบาย checkbox และ legacy grants ตรงกับ runtime OpenAPI; ขอบเขตโรงงานและข้อกำหนดความสัมพันธ์โรงงานไม่เปลี่ยน
- Runtime OpenAPI ของ Chat และสัญญารวม: 2 suites, 85 tests ผ่าน; lint source OpenAPI และ Chat contract tests ไม่มี error/warning ส่วน test สัญญารวมมี non-null assertion warnings เดิม 2 รายการนอกบรรทัดที่แก้; relative links และ JSON examples ในเอกสารที่แก้ครบ 3 ไฟล์ผ่าน
- ระหว่างรันสอง OpenAPI suites ครั้งแรก health check ใน rate-limit test ได้ `501` หนึ่งครั้ง; ตรวจ route เดิมและรัน Chat suite แยกผ่าน 9 tests จากนั้นรันสอง suites ร่วมกันซ้ำผ่าน 85 tests โดยไม่แก้ application code
- HTTP regression ยืนยัน RED ว่าบัญชี custom ที่มีเพียง `chat:view` ได้ `canCreate=false`; หลังแก้เปิดเรื่อง ส่งข้อความ อ่านประวัติ และปิดเรื่องได้ รวมถึงกรณี legacy ask/answer ถูก deny ขณะที่การถอน `chat:view` หลังออก token และโรงงานนอกขอบเขตยังถูกปฏิเสธ
- Final backend verification: build/typecheck ผ่าน; 338 suites, 4,460 tests ผ่าน และ SQL integration 4 tests ข้ามเพราะไม่มีฐานทดสอบแยก ใช้ค่า environment จำลองตามที่ชุดทดสอบคาดหมาย (`PUBLIC_BASE_URL` และ `PARAMETER_DB_SCHEMA`) โดยไม่เชื่อม production
- Lint ทั้ง backend ไม่มี error; warning เดิมนอกส่วนแก้ยังคงอยู่ ไม่มี warning เพิ่มในส่วนแก้ ตรวจ diff และ review ด้านสิทธิ์โดยอิสระไม่พบข้อบกพร่อง
- Deployment และการทดสอบด้วยการล็อกอินปกติของบัญชี production ยังรอยืนยัน ณ เวลาเตรียม release นี้ ยังไม่อ้างว่าเปิด–ตอบ–ปิดบน production ผ่านหรือมีข้อมูลทดสอบที่ล้างแล้ว

## ข้อจำกัดและการส่งต่อ

SQL Server integration tests 4 ข้อถูกข้ามอย่างชัดเจน เพราะยังไม่มีฐานทดสอบแยกที่ตั้งค่าไว้ และ Docker daemon ไม่ทำงาน การทดสอบ SQL.js ไม่ยืนยัน lock/concurrency/deadlock/dialect ของ SQL Server ดู [วิธีเตรียมและรันฐานทดสอบ SQL Server](./sql-server-verification.md) ก่อนนำขึ้นใช้งานจริง

Release แรก deploy ผ่าน [run 39033795135](https://github.com/Nongten1010/POMS-app/actions/runs/39033795135) แล้ว และตรวจ production พบ migration 0141, ตาราง 4 ตาราง, indexes 11 รายการ, foreign keys 9 รายการ และ check constraints 4 รายการครบและใช้งานอยู่ การตรวจนี้ยังไม่ใช่ authenticated HTTP lifecycle test; frontend ยังเป็น mockup และยังไม่เชื่อม API หลังแต่ละ deployment ต้องตรวจ runtime `/api/v1/openapi.json` ว่าตรงกับสัญญา canonical ก่อนถือว่าปล่อยใช้งานครบ

Docs impact: updated

Canonical docs: [Chat API](../../api/menus/chat/README.md), [จัดการสิทธิ์การใช้งาน](../../api/menus/permissions/README.md)

Reason: ปรับสิทธิ์ใช้งาน Chat ให้ตรงกับ checkbox มีสิทธิ์ใช้งาน พร้อม runtime OpenAPI และ canonical contract

Client impact: บัญชีที่มี chat:view ใช้เปิดเรื่อง/สนทนา/ปิดเรื่องได้ภายในขอบเขตเดิมโดยไม่ต้องเพิ่ม legacy grants; UI เดิมยังไม่ได้ wire ในงานนี้

Breaking change: no
