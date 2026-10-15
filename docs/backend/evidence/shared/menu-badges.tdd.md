# หลักฐาน TDD: จุด Badge บน Sidebar

[Canonical API contract](../../api/shared/menu-badges/README.md)

## ที่มาและขอบเขต

User journeys มาจาก [frontend handoff](../../../../frontend/md/frontend-handoff-14102026.md) ไม่ได้ใช้ไฟล์ `*.plan.md` งานนี้เพิ่ม `GET /api/v1/me/menu-badges` เฉพาะ backend พร้อมเอกสารกลางและ runtime OpenAPI ไม่แก้ frontend และช่วงพัฒนาไม่ได้ commit/push/deploy ตามคำสั่งเริ่มต้น ต่อมาผู้ใช้สั่ง push production จึงเตรียม release แยกจาก `origin/main` ที่ `4d638e94c3474d61341fbd3869fc952d5c640c81` โดยรวมเฉพาะ 26 ไฟล์ของงาน Badge

1. ผู้ใช้เห็นจุด Badge เฉพาะเมนูที่มีรายการตรงสถานะในขอบเขตของบัญชีปัจจุบัน
2. เจ้าหน้าที่/Director/แอดมินต้องมี view และ approve ของเมนูคำขอ ผู้ประกอบการใช้เกณฑ์ของตน และเหตุการณ์ไม่ต้องมี approve
3. การแจ้งเตือนใช้วันเหตุการณ์ของวันนี้ตามเวลาไทย รวมรอยต่อเที่ยงคืน โดยไม่มีผลค้างจาก cache
4. ข้อมูลที่ไม่มีสิทธิ์ไม่ปรากฏผ่าน boolean และความผิดพลาดไม่ถูกแปลงเป็นไม่มีงาน

ใช้ npm จาก `backend/package-lock.json` และ `backend/package.json`; runner คือ Jest + ts-jest ตาม `backend/jest.config.js` ไม่มี package-manager detector ใน repository จึงตรวจ runner จาก scripts/config โดยตรง ไม่ติดตั้งเครื่องมือเพิ่มเติม

## RED → GREEN

คำสั่งทั้งหมดรันจาก `backend/` และใช้ local fixture/mocks แทนฐานข้อมูล production

| พฤติกรรม | คำสั่งที่รัน | RED | GREEN / สิ่งที่รับประกัน |
| --- | --- | --- | --- |
| HTTP endpoint และ auth/errors | `npm test -- --runInBand --runTestsByPath tests/unit/menu-badges.route.test.ts` | 7 failed; endpoint ยังไม่มีจึงตอบ `404` แทน `200`/`401`/`500` | 7 passed; คืนครบ 6 boolean, ตรวจ auth ปัจจุบัน, ไม่เชื่อ identity/scope จาก query, no-store และ generic error |
| กติกาสถานะ สิทธิ์ และวันไทย | `npm test -- --runInBand --runTestsByPath tests/unit/menu-badges.service.test.ts tests/unit/menu-badges.openapi.test.ts` | Service เกิด compile-time RED เพราะ module/method ที่ทดสอบยังไม่มี; OpenAPI runtime RED เพราะ path เป็น `undefined` | Service 65 passed และ OpenAPI 1 passed ใน focused run สุดท้าย รวมกรณี approve ไม่มีค่า/false, Director ทุก role, admin precedence และเที่ยงคืนไทย |
| Factory/connection/KWP existence | `npm test -- --runInBand tests/unit/menu-badges.requests.repository.test.ts` | 29 failed เพราะ methods ยังไม่มี; เพิ่มกรณี creator bypass แล้ว 1 failed/28 passed ก่อนแก้ | 29 passed; ใช้ scope ของรายการ เลือก ID แรก ไม่ count/hydrate และไม่ใช้ pagination/creator bypass |
| BOD/COD/eligible/events existence | `npm test -- --runInBand --runTestsByPath tests/unit/menu-badges.events.repository.test.ts` | Compile-time RED TS2339 เพราะ 3 methods ยังไม่มี | 62 passed; ขอบเขตโรงงาน/พื้นที่ สถานะ และ eventDate/ระบบ/threshold ของ 10 เมนูย่อย |
| Eligible estate ไม่รั่วข้ามนิคม | `npm test -- --runInBand --runTestsByPath tests/unit/menu-badges.events.repository.test.ts` | ชุด estate 6 failed/7 passed: สิทธิ์ CENTRAL กลับเห็นคำขอ EAST | GREEN; lookup สำหรับ Badge จำกัดนิคมตั้งแต่ compilation แรก และครอบคลุม code/id/name/legacy alias/ไม่มี assignment |
| Registry และ runtime OpenAPI | ชุด `api-docs.openapi.test.ts`, `api-docs.route.test.ts`, `laws-faqs.openapi.test.ts` ใน full run | ก่อนปรับ assertion ของ route พบ 158/159 ไม่ตรงหลังเพิ่ม endpoint | ทั้งสาม suites ผ่านใน full run; 150 canonical endpoints / 159 Swagger operations / 13 tags |

มีการแก้ syntax ของ test setup ก่อนยืนยัน HTTP RED; failure จาก syntax ไม่ถูกนับเป็นหลักฐาน RED ไม่มี checkpoint commit เพราะผู้ใช้ระบุชัดว่าไม่ให้ commit

## Test specification

| สิ่งที่รับประกัน | Test target | ประเภท | ผล |
| --- | --- | --- | --- |
| ไม่มี view ไม่อ่านข้อมูลเมนูนั้น; view/edit อย่างเดียวไม่ให้ Badge งานเจ้าหน้าที่/แอดมิน/Director | `menu-badges.service.test.ts` | unit | PASS |
| approve ของเมนูอื่นไม่ข้ามเมนูที่ขาดสิทธิ์; false และไม่มี approve ให้ผล false | `menu-badges.service.test.ts` | unit + permission normalization | PASS |
| Operator และ Director ใช้สถานะตาม contract; admin ร่วม Director ใช้ชุด admin | `menu-badges.service.test.ts` | unit | PASS |
| token เดิมใช้สิทธิ์ปัจจุบันและไม่แชร์ผลระหว่างบัญชี | `menu-badges.route.test.ts`, `menu-badges.service.test.ts` | HTTP integration + unit | PASS |
| รายการที่มาทีหลังยังทำให้ true; รายการสุดท้ายเปลี่ยนสถานะแล้วได้ false; ถอน assigned factory แล้วไม่เห็นข้อมูล | `menu-badges.requests.repository.test.ts`, `menu-badges.events.repository.test.ts` | SQL fixture + unit | PASS |
| OWN_FACTORY, region/province/estate/type88 และ missing assignment ใช้ขอบเขตของเมนู | Repository tests ทั้งสองไฟล์ | SQL fixture / MSSQL query compilation | PASS |
| events ทั้ง 10 เมนูย่อยใช้ eventDate เท่านั้น; สร้างวันนี้แต่ eventDate วันอื่นไม่ถูกนับ; mismatch system/threshold ไม่ถูกนับ | `menu-badges.events.repository.test.ts` | SQL fixture | PASS |
| เปลี่ยนวันไทยตรงเที่ยงคืน โดยไม่ใช้ผล cache วันก่อน | `menu-badges.service.test.ts` | unit + controlled clock | PASS |
| ไม่มี/invalid token เป็น 401 และ query failure เป็น generic 500 ไม่กลายเป็น false | `menu-badges.route.test.ts` | HTTP integration | PASS |
| query เลือก ID แรก ไม่มี COUNT/order/pagination และไม่มีรายละเอียดส่วนบุคคล | Repository tests ทั้งสองไฟล์, route response assertion | MSSQL compilation + HTTP integration | PASS |
| runtime OpenAPI อธิบาย schemas, auth, errors และ Cache-Control ตรงกับ canonical contract | `menu-badges.openapi.test.ts`, API docs suites | contract | PASS |

## Coverage และ verification

Focused command สุดท้าย:

```bash
npm test -- --runInBand --runTestsByPath \
  tests/unit/menu-badges.route.test.ts \
  tests/unit/menu-badges.service.test.ts \
  tests/unit/menu-badges.openapi.test.ts \
  tests/unit/menu-badges.requests.repository.test.ts \
  tests/unit/menu-badges.events.repository.test.ts \
  --coverage --collectCoverageFrom='src/modules/menu-badges/*.ts' \
  --coverageDirectory=/private/tmp/poms-menu-badges-coverage \
  --coverageReporters=text --coverageReporters=json-summary
```

- **5 suites / 164 tests passed** ไม่มี skipped tests ในชุดใหม่
- Coverage ของโมดูลใหม่ `menu-badges`: lines **100%**, statements **97.36%**, branches **97.43%**, functions **100%**; service ครบ 100% ทุกหมวด
- ไม่อ้างว่า coverage ทั้ง repository หรือไฟล์ repository เดิมทั้งหมดถึง 80%; existence methods มี SQL/runtime tests แยกตามตาราง
- `npm run typecheck` ผ่าน; `npm run build` ผ่าน
- `npm run lint` ผ่านด้วย 0 errors และมี warnings เดิมใน workspace; หลังแก้ warning ใน test ใหม่แล้ว focused ESLint ของโมดูล/เอกสาร OpenAPI/test ใหม่ไม่มี findings
- `git diff --check` สำหรับส่วนงานผ่าน; ตรวจ task-only diff เทียบ snapshot ก่อนแก้เพื่อไม่รวมการเปลี่ยนแปลงค้างเดิมของผู้ใช้
- ตรวจลิงก์ไฟล์ที่เพิ่มและ index ที่แก้ รวมเส้นทางจาก shared/evidence indexes; repository ยังไม่มี executable docs guard จึงใช้ link/index check และ registry/OpenAPI tests

Full backend command `npm test -- --runInBand`: **319 suites passed / 1 failed; 3,995 tests passed / 1 failed (3,996 total)** ข้อผิดพลาดอยู่ใน test เดิม `device-config-approved-parameters.repository.test.ts`: mock chain ไม่มี `.orderBy()` จึงเกิด `TypeError` แทน `CONFLICT` ที่คาดไว้ ไฟล์ test และ device-connections repository ไม่ได้ถูกแก้ในงาน Badge นี้ จึงไม่ขยายงานไปแก้ส่วนดังกล่าว

การรัน HTTP tests ครั้งหนึ่งติด sandbox `listen EPERM` ก่อน execute test จึงรันใหม่โดยอนุญาต local test listener; failure นี้ไม่ถูกนับเป็น business RED หรือ regression ของ feature

## ตรวจ release บน main ล่าสุด

ผู้ใช้สั่ง push production หลังจบการพัฒนา จึงย้ายเฉพาะ patch ของงานนี้ 26 ไฟล์ไป checkout แยกจาก `origin/main` ที่ `4d638e94c3474d61341fbd3869fc952d5c640c81` โดยไม่รวมงานค้างใน workspace เดิม ไม่เปลี่ยน frontend, workflow, package files หรือ migrations

- `npm test -- --runInBand`: **329 suites / 4,342 tests passed** บน release checkout
- ใช้ค่าจำลอง DB/JWT ชั่วคราว ไม่คัดลอก credentials จริง พร้อม `PUBLIC_BASE_URL=http://d-poms.diw.go.th` และ `PARAMETER_DB_SCHEMA=ingest` ตามที่ tests เดิมคาดหวัง ค่าทั้งสองใช้สร้าง metadata/URL และไม่ทำให้ tests เขียนฐาน production
- `npm run typecheck` และ `npm run build`: PASS
- `npm run lint`: 0 errors / 343 warnings เดิมใน main; ไม่แก้ lint ที่ไม่เกี่ยวข้อง
- Test เดิมของ device configuration ที่ขาด `orderBy` ใน workspace เริ่มต้นถูกแก้ไว้ใน main ล่าสุดแล้ว จึงผ่านโดยไม่เพิ่มการแก้ไขนั้นใน release commit นี้
- ตรวจ task-only diff, documentation links, runtime OpenAPI registry และขอบเขตไฟล์ก่อน commit/push

## Security และข้อจำกัด

- ใช้ authenticate เดิมซึ่งโหลด authorization context ปัจจุบัน ไม่รับ ID/role/scope จาก client เป็น authority; Badge ไม่เปลี่ยนสิทธิ์บันทึก/อนุมัติ
- SQL binding ทุกสถานะ/วันที่/นิคมเป็น parameterized query; ชื่อคอลัมน์ของ estate lookup มาจากรายการคงที่ใน backend
- ไม่เพิ่ม secret, credential, รายการโรงงาน หรือข้อมูลส่วนบุคคลใน response และไม่มี shared server cache
- ตรวจพบ defect เดิมใน `eligible-factories.access.ts::resolveEstateAssignment`: callback ซ้อนแก้ outer builder ทำให้ query compilation ครั้งแรกไม่มีตัวกรองนิคม งานนี้ป้องกันเฉพาะ query Badge ด้วย lookup ที่จำกัด assignment ถูกต้อง โดยไม่เปลี่ยน API รายการเดิมตามขอบเขต handoff; การแก้ resolver เดิมเป็นงานแยก
- ใช้ SQLite fixture ตรวจผลของ query ที่รองรับ และ compile SQL Server query จริงเพื่อตรวจ `OUTER APPLY`/type88 ซึ่ง SQLite ไม่รองรับ ไม่ได้ตรวจ execution plan/latency บน SQL Server production
- ใช้ index สถานะ/วัน/โรงงานที่มีอยู่ใน migrations เดิม ไม่เพิ่ม migration และไม่เปลี่ยนข้อมูลธุรกิจ
- ไม่รัน browser E2E เพราะเป็นงาน backend เท่านั้น ใช้ HTTP integration แทน
- Local tests ไม่แทนการยืนยัน production `/api/v1/openapi.json`; ต้องตรวจ path/schema และ endpoint authentication หลัง deploy โดยรายงานผล release แยกใน change summary

## Documentation impact

Docs impact: updated
Canonical docs: docs/backend/api/shared/menu-badges/README.md
Reason: เพิ่ม API จุด Badge สำหรับบัญชีปัจจุบัน พร้อม runtime OpenAPI และ endpoint registry
Client impact: frontend
Breaking change: no

## Merge evidence

ช่วงพัฒนาไม่มี checkpoint commit ตามคำสั่งเริ่มต้นของผู้ใช้ เมื่อผู้ใช้สั่ง push production จึงจัด release commit เฉพาะงานนี้ พร้อมสรุป RED/GREEN และ documentation-impact fields ใน commit body รายงานนี้เก็บหลักฐานเดิมไว้ ไม่ใช้ประวัติ commit เก่ามาอ้างเป็น checkpoint ของ TDD
