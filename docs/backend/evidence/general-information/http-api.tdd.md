# หลักฐาน TDD ของรายงานข้อมูลทั่วไป

สัญญาอ้างอิง: [ข้อมูลทั่วไป](../../api/menus/general-information/README.md)

## ขอบเขตที่ยืนยันก่อนทดสอบ

ผู้ใช้ยืนยันให้ทดสอบผ่าน HTTP endpoint และเพิ่ม backend, canonical docs และ runtime OpenAPI โดยไม่แก้ frontend

- เรียก `createApp()` ผ่าน Supertest ใช้ routing, middleware, JWT signature, current authorization resolver, aggregation และ Knex query ของระบบจริง
- ใช้ข้อมูลบัญชีสมมติจาก fixture เดิม รัน SQL ที่ Knex สร้างผ่าน SQL.js โดยแทนเฉพาะ database boundary ด้วย `createKnexSqliteFixture` ไม่ mock ผลลัพธ์ service/repository ของรายงาน
- ตรวจ OpenAPI ผ่าน `GET /api/v1/openapi.json` ซึ่งเป็น HTTP boundary ของ contract ที่ frontend ใช้
- ไม่ได้ทดสอบข้อมูล production หรือ concurrency/collation บน SQL Server จริง การแปลง SQL dialect ใน fixture ไม่ใช่หลักฐานว่า production data พร้อมจัดหมวดครบทุกจุด

## รอบ Red → Green

เพิ่มหนึ่งพฤติกรรมแล้วรันให้ล้มเหลวก่อนเพิ่ม implementation ของพฤติกรรมนั้น ไม่เขียน test ทั้งชุดก่อน implementation

| พฤติกรรม | Red ที่พบ | Green |
| --- | --- | --- |
| บังคับ login | endpoint ตอบ `404` แทน `401` | mount route และใช้ authentication |
| ปฏิเสธผู้ประกอบการ/ประชาชน | ตอบ `501` แทน `403` | ตรวจ account/role ปัจจุบันที่ server |
| ชุดว่างจริง | ตอบ `501` แทน `200` | ครบ 6 ภาค 2 กลุ่มนิคม พร้อม 0/null |
| ตรวจ query | query ผิดยังตอบ `200` | enum `CEMS/WPMS` ค่าเดียวและ reject query เกิน |
| ยอดโรงงาน/จุด | จำนวนเป็นศูนย์แทนข้อมูล fixture | อ่าน connected points และนับ distinct/latest รวม deleted rows |
| รวมหน่วยรายพารามิเตอร์ | parameters ว่าง | CO ต่างหน่วยรวมกัน แยก CO2 และไม่บวกโรงงานซ้ำ |
| อัตราการระบาย | ทุกค่าเป็น null | ปรับหน่วย รักษา 0 แยกค่าขาด และเฉลี่ยจากทุกจุด |
| ข้อมูลต้นทางผิด | JSON ผิดตอบ `500` | `503 GENERAL_INFORMATION_DATA_INCOMPLETE` โดยไม่คืนยอดบางส่วน |
| Canonical / ขีดแทนชื่อนิคม | ขีด em dash ถูกนับเป็นนิคม | อ่าน current views และจัด placeholder เป็นนอกนิคม |
| Runtime contract | ไม่พบ `/general-information` | เผยแพร่ schema, query, สิทธิ์และ error ใน OpenAPI |
| หมวด/ตัวตนไม่ชัดเจน | ข้อความ `ไม่ทราบ` ยังตอบ `200` | ตอบ `503` โดยไม่เพิ่มหมวดใหม่ |
| ชื่อพารามิเตอร์มาตรฐาน | Flow เกิดสองแถวชื่อเดียวกัน | รวม alias เป็นกลุ่มเดียวและปฏิเสธ parameter ที่มีแต่หน่วย |

## คำสั่งตรวจสอบ

รันจาก `backend/`:

```bash
npm run build
npm run typecheck
npm run lint
npx --no-install eslint src/modules/general-information/*.ts src/modules/api-docs/general-information.openapi.ts tests/unit/general-information.api.test.ts --max-warnings 0
npm test -- --runInBand --runTestsByPath tests/unit/general-information.api.test.ts tests/unit/api-docs.openapi.test.ts tests/unit/api-docs.route.test.ts tests/unit/laws-faqs.openapi.test.ts tests/unit/alert-email.openapi.test.ts --coverage --collectCoverageFrom='src/modules/general-information/**/*.ts'
npm test -- --runInBand --coverage --collectCoverageFrom='src/modules/general-information/**/*.ts'
```

## ผลตรวจ

| Phase | ผล |
| --- | --- |
| Build | PASS |
| Types | PASS |
| Lint | PASS; global lint รอบสุดท้าย 0 errors / 370 warnings เดิม; โค้ดใหม่ targeted lint ใช้ `--max-warnings 0` ผ่าน |
| HTTP / OpenAPI ที่เกี่ยวข้อง | PASS: 5 suites / 107 tests รวม HTTP รายงาน 12 กรณี; coverage โค้ดใหม่ statements 98.33%, branches 88.88%, functions/lines 100% |
| ชุดทดสอบรวม | PASS บน GitHub CI ของ release: 412 suites ผ่าน / 2 ข้าม; 5,706 tests ผ่าน / 18 ข้าม รวม 5,724 tests; ไม่มี failures |
| Security | ตรวจโค้ดเพิ่มใหม่: authentication/authorization จาก server, strict input validation, parameterized SQL, ไม่ส่งข้อมูลรายโรงงาน/บุคคล, ไม่มี secrets/SQL/stack trace ใน response และใช้ global rate limit |
| Diff / docs | ตรวจ diff เฉพาะงานเทียบไฟล์ก่อนเริ่ม; frontend tracked diff คงเดิม; ลิงก์ canonical page และทะเบียน endpoint ตรงกับ runtime OpenAPI |

รอบรวมแรกพบ assertion จำนวน endpoint เก่า 2 จุด ซึ่งแก้และตรวจผ่านในชุด HTTP/OpenAPI แล้ว และ Chat หนึ่งกรณีเกิด `socket hang up`; รัน Chat แยกผ่าน 62 tests โดยไม่แก้ Chat จึงตรวจชุดรวมซ้ำหลังแก้ contract counters

ผลรวมการตรวจ release: **READY** หลังชุดทดสอบทั้งหมดบน GitHub CI ผ่านในรอบเดียว และ production deployment/health check สำเร็จ ผลรัน local ก่อนหน้านี้มีความไม่แน่นอนในชุด HTTP อื่น จึงเก็บเป็นข้อจำกัดของหลักฐาน local โดยไม่ใช้ผลรันแยกแทน CI

## ขอบเขตหลักฐาน

- เผยแพร่และตรวจ runtime OpenAPI/HTTP authentication บน production แล้วตามหลักฐานด้านล่าง
- ยังไม่ได้ตรวจยอดสรุปจาก production ด้วย request ที่ใช้ token เจ้าหน้าที่หรือทดสอบ UI ครบ flow; การตรวจแบบไม่มี token ไม่ยืนยันความครบถ้วนของข้อมูลจริง
- ถ้าข้อมูลจริงไม่มี metadata สำหรับจัดภาค/นิคม หรือมีหน่วยอัตราการระบายที่ไม่รองรับ API จะตอบ `503`; ต้องตรวจและแก้แหล่งข้อมูลโดยไม่เปลี่ยนหมวดรายงานเอง

## ตรวจชุด release บน main ล่าสุด

แยกเฉพาะงานนี้ 18 ไฟล์บน commit ฐาน `4c3eef2a` โดยไม่รวมการแก้ API อื่นที่ยังค้างใน workspace เดิม Build, typecheck, lint โค้ดใหม่แบบไม่มี warning และ deployment-helper tests ผ่านทั้งหมด ชุดทดสอบรวมบน checkout นี้ผ่าน 5,705 tests, ล้มเหลว 1 กรณีจาก Chat (`read ECONNRESET`), ข้าม 18 tests; 411 suites ผ่าน / 1 ล้มเหลว / 2 ข้าม ต้องให้ GitHub CI ของ release ผ่านก่อน workflow จะติดตั้ง production

รันตรวจซ้ำ 6 suites ที่เกี่ยวข้อง (รวม Chat) บน checkout สำหรับ release ผ่านครบ 176 tests โดยไม่แก้ Chat

## ผลเผยแพร่ production

- Release: [`27b7e094`](https://github.com/Nongten1010/POMS-app/commit/27b7e094421e27a2db3ce05dedb7e66fb38db0ba)
- [GitHub Actions run 42184836878](https://github.com/Nongten1010/POMS-app/actions/runs/42184836878): detect, CI และ installation สำเร็จทั้งหมด
- CI: 412 suites / 5,706 tests ผ่าน; ข้าม 2 suites / 18 tests; ไม่มี failures
- Production: ติดตั้ง verified artifact, migration step, canonical-profile preflight และ restart/health check ผ่าน; workflow ข้ามการ build/deploy frontend
- `GET /api/v1/openapi.json`: `200` และเทียบ operation ของ `/general-information` พร้อม schema ใหม่ทั้ง 5 ชุดกับ source release แล้วตรงกัน
- `GET /api/v1`: `200`; `GET /api/v1/docs/`: `200`
- `GET /api/v1/general-information?systemType=CEMS` โดยไม่มี token: `401 UNAUTHORIZED` ยืนยันว่า route ถูกติดตั้งและบังคับ authentication
- ไม่สร้างบัญชี ไม่ออก token ของผู้ใช้จริง และไม่เปลี่ยนข้อมูลโรงงานในการตรวจรอบนี้

## หลักฐานการกรองสถานะซ่อน

ผู้ใช้ขอให้ `/api/v1/general-information` ไม่นับโรงงานหรือจุดตรวจวัดที่ซ่อน ปรับเฉพาะ repository, service, HTTP tests, runtime OpenAPI และสัญญา canonical ของเมนูนี้

- ก่อนแก้ implementation: HTTP tests ล้มเหลว 5 กรณี เนื่องจากยังรวมรายการที่ซ่อนและ OpenAPI ยังระบุว่ารวม hidden; อีก 12 กรณีผ่าน
- หลังแก้: HTTP tests ของเมนูผ่าน 20 กรณี รวม CEMS/WPMS, การกรองทุกหัวข้อและอัตราการระบาย, revision ล่าสุดที่ถูกซ่อน, สถานะจาก current children ทั้งสองระบบ, จุดที่ soft-delete/ยกเลิกการเชื่อมต่อ, การซ่อนจากพารามิเตอร์ทั้งหมด, canonical views และ JSON สถานะผิดรูปแบบ
- ชุดตรวจที่เกี่ยวข้องผ่านทั้งหมด 5 suites / 121 tests รวมสถานะ POMS และ HTTP OpenAPI; `npm run typecheck` และ targeted ESLint แบบไม่มี warning ผ่าน ตรวจ relative links ของหน้า API และหลักฐานนี้แล้วปลายทางมีอยู่จริง
- ตรวจ diff เทียบสำเนาก่อนเริ่มงาน เฉพาะ 6 ไฟล์ใน `backend/` และ `docs/backend/`; ไม่แก้ frontend และไม่รวมงานเดิมใน workspace

คำสั่งที่ใช้จาก `backend/`:

```bash
npm run typecheck
npx --no-install eslint src/modules/general-information/general-information.repository.ts src/modules/general-information/general-information.service.ts src/modules/api-docs/general-information.openapi.ts tests/unit/general-information.api.test.ts --max-warnings 0
npm test -- --runInBand --runTestsByPath tests/unit/general-information.api.test.ts tests/unit/poms-status-management.state.test.ts tests/unit/poms-current-status-rollup.test.ts tests/unit/api-docs.openapi.test.ts tests/unit/api-docs.route.test.ts
```

หลักฐาน local ในหัวข้อนี้ใช้ SQL.js fixture และไม่ยืนยันยอดจริงบน SQL Server/production ผลเผยแพร่กติกากรองซ่อนใหม่อยู่ในหัวข้อถัดไป โดยไม่ใช้หลักฐาน release เดิมด้านบนแทนผล release นี้

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/general-information/README.md
Reason: กรองโรงงานและจุดตรวจวัดที่ซ่อนก่อนสรุปทุกหัวข้อ พร้อมอัปเดต runtime OpenAPI
Client impact: frontend
Breaking change: no
```


## ผลเผยแพร่กติกาไม่นับสถานะซ่อน

- Release: [`6a56dbc0`](https://github.com/Nongten1010/POMS-app/commit/6a56dbc05aa3659075f5e69a5f00b0c0b3c0efb3) จากฐาน `98d51ee1` เฉพาะ 6 ไฟล์ที่ตรวจแล้ว ไม่รวมงานค้างใน workspace หรือ frontend
- [GitHub Actions run 42740031711](https://github.com/Nongten1010/POMS-app/actions/runs/42740031711): detect, CI และ production installation สำเร็จทั้งหมด
- Clean release checkout ติดตั้ง dependency ตาม lockfile จริง แล้ว build, typecheck, targeted ESLint, API/status/OpenAPI tests 123 กรณี และ deployment-helper tests 18 กรณีผ่าน
- CI ทั้ง backend: 416 suites / 5,756 tests ผ่าน; ข้าม 2 suites / 18 tests; ไม่มี failures และ deployment-helper tests ผ่านอีก 18 กรณี
- Production ตรวจ verified artifact, sync checkout ไป commit release, migration และ restart/health check ผ่าน พร้อมเขียน deploy marker; migration แสดง `Already up to date` และ profile mode เป็น `legacy` รอบนี้ไม่มี migration เพิ่ม
- Workflow ข้าม frontend build/deploy ทั้งสองขั้น
- Public HTTPS: `GET /api/v1`, `GET /api/v1/docs/` และ `GET /api/v1/openapi.json` ตอบ `200`; เปรียบเทียบ operation ของ `/general-information` และ schema ทั้ง 5 ชุดกับ compiled release แล้วตรงกัน รวมข้อความไม่นับโรงงานหรือจุดตรวจวัดที่ซ่อน
- `GET /api/v1/general-information?systemType=CEMS` และ `systemType=WPMS` โดยไม่มี token ตอบ `401 UNAUTHORIZED` ตามเดิม
- DNS ของเครื่องที่ใช้ตรวจ resolve โดเมนไม่ได้ จึงยืนยัน A record ผ่าน Google DNS over HTTPS และใช้ `curl --resolve d-poms.diw.go.th:443:110.78.4.84`; ตรวจใบรับรอง TLS ตามชื่อโดเมนผ่าน โดยไม่ได้ปิดการตรวจ certificate
- ยังไม่ได้ตรวจยอดสรุปจริงด้วย token เจ้าหน้าที่/แอดมิน ผลยืนยันครอบคลุมการติดตั้ง, health, runtime contract และ authentication; พฤติกรรมการนับยืนยันผ่าน HTTP fixtures


## ยืนยันกติกานับร่วมกับหน้าแรก

ผู้ใช้ยืนยันให้แก้ backend, ทดสอบ และอัปเดตเอกสาร/OpenAPI โดยยังไม่ deploy กติกาส่วนนี้แทนกติกาประวัติจุดที่เคยเชื่อมต่อของ release เดิมด้านบน

- สาเหตุ: ข้อมูลทั่วไปอ่านแถว deleted/disconnected และไม่เลือก `monitoring_point_status`; หน้าแรกตัดยกเว้นทั้งหมดแต่ยังไม่ตัดขยายเวลา ส่วน visibility ของข้อมูลทั่วไปใช้ rollup ที่เปิดโรงงานซ่อนกลับมาได้ ต่างจากหน้าแรกที่ตรวจโรงงานก่อนจุด
- เปลี่ยนเป็นตัวกรองร่วม `connectedPointVisibility` ใน `backend/src/modules/poms-factories/connected-point-visibility.ts`; ข้อมูลทั่วไปอ่านเฉพาะ active connected points และ eligible profiles ปัจจุบัน นำสถานะโรงงาน/จุดและพารามิเตอร์ที่ผ่านเกณฑ์ไปใช้กับทั้ง 4 หัวข้อ
- ไม่ใช้ `factories` เป็นสมาชิกโรงงาน POMS; อ่าน supporting identity เพื่อใช้ `is_active` เช่นเดียวกับหน้าแรก โรงงานที่ไม่มี master ยังนับได้เมื่อมีจุดที่ผ่านเกณฑ์
- SQL Server บังคับ active `point_code` ไม่ซ้ำด้วย `uq_connected_points_point_code` (migration `0030`); regression ของ latest revision ยังคงป้องกันการย้อนนับ revision เก่าที่ซ่อน

### Red และ Green

ก่อนแก้ implementation รัน `general-information.api.test.ts` และ `home-dashboard-visibility.test.ts`: **11 failed / 48 passed** ภายใน 7.22 วินาที ตัวอย่างอาการตรงกับข้อกำหนดคือจุดขยายเวลายังอยู่ในหน้าแรกและข้อมูลทั่วไปยังได้ `factoryCount: 1, pointCount: 1` แทนศูนย์สำหรับทั้งสองสถานะที่ต้องตัดออก

หลังแก้ ทดสอบขอบเขตจริงดังนี้:

- HTTP ข้อมูลทั่วไปผ่าน Supertest, authorization จริง และ SQL ที่ repository สร้างผ่าน SQL.js fixture
- เปรียบเทียบ HTTP ข้อมูลทั่วไปกับ dashboard และ public map จากแถว connected point ชุดเดียวกันทั้ง CEMS/WPMS โดยใช้ repository/projection จริงของจุด แทนเฉพาะ factory access/label/favorite และ hourly measurement boundary ด้วย fixture เพื่อไม่เรียกข้อมูลจริง
- ครอบคลุมยกเว้นทั้งหมด ขยายเวลาที่มี/ไม่มีพารามิเตอร์ จุดลบ จุดยกเลิกเชื่อมต่อ จุดซ่อน โรงงานซ่อนหรือยกเลิกเชื่อมต่อแต่มีจุดแสดง โรงงาน inactive และ eligible profile ที่ลบ; โรงงานที่เหลือแต่จุดถูกตัดออกหายจากยอดด้วย
- ยืนยันพารามิเตอร์ที่ซ่อนถูกตัดจากรายงาน ข้อมูล flow/ภาค/นิคมใช้เฉพาะจุดที่เหลือ และไม่คืน revision เก่าแทน revision ล่าสุดที่ซ่อน
- ยืนยัน direct station visibility ของจุดขยายเวลาเป็น false และ measurement access เดิมคืน `404` ก่อนอ่านค่าที่ไม่แสดง; OpenAPI ครอบคลุม dashboard/map และ statistics/calendar ทั้ง path ปกติและ annual aliases
- ใช้ dummy database hosts และ JWT secrets สุ่มสำหรับ fixture; ไม่แก้ฐานข้อมูล production ไม่สร้าง migration และไม่มี debug instrumentation ใน source

คำสั่งที่รันจาก `backend/` ด้วย environment ของ fixture:

```bash
npm run typecheck
npx --no-install eslint src/modules/poms-factories/connected-point-visibility.ts src/modules/general-information/*.ts src/modules/connection-requests/connection-requests.repository.ts src/modules/connection-requests/connection-requests.service.ts src/modules/api-docs/general-information.openapi.ts src/modules/api-docs/home-handoff.openapi.ts tests/unit/general-information.api.test.ts tests/unit/home-dashboard-visibility.test.ts tests/unit/home-handoff.openapi.test.ts --max-warnings 0
npm test -- --runInBand --runTestsByPath tests/unit/general-information.api.test.ts tests/unit/home-dashboard-visibility.test.ts tests/unit/home-measurement-access.test.ts tests/unit/home-handoff.openapi.test.ts tests/unit/api-docs.openapi.test.ts tests/unit/api-docs.route.test.ts tests/unit/poms-current-status-rollup.test.ts tests/unit/poms-status-management.state.test.ts tests/unit/connected-measurement-points.route.test.ts
```

ผล: **9 suites / 218 tests ผ่าน**, typecheck และ targeted lint ผ่าน ไม่มี warnings; `git diff --check` ผ่าน ตรวจลิงก์เอกสารที่เพิ่มและการเข้าถึงจาก backend hub แล้ว

รัน diagnostic loop เดิมซ้ำจาก debug workspace: exclusion repro **5/5 ผ่าน**, home probe **7/7 ผ่าน** (ก่อนแก้ 4 และ 2 กรณีล้มเหลวตามลำดับ) เพิ่มเฉพาะ schema ของ supporting factory fixture เพื่อรองรับ query ใหม่ โดยไม่เปลี่ยน expected results

ข้อจำกัด: fixture ยืนยันกติกาและการประกอบ SQL แต่ไม่แทนการทดสอบกับข้อมูลจริง/collation/concurrency ของ SQL Server; **ยังไม่ commit, push หรือ deploy** และยังไม่อ้างว่ายอด production เปลี่ยน เมื่อ deploy ได้รับอนุญาตแล้วต้องเทียบ runtime OpenAPI และยอดจริงในระบบ พื้นที่และตัวกรองเดียวกัน ข้อมูลทั่วไปยังเป็นยอดทั่วประเทศ ส่วนหน้าแรกอาจจำกัดตามสิทธิ์ของผู้เรียก

### Change summary

- Docs impact: updated
- Canonical docs: [ข้อมูลทั่วไป](../../api/menus/general-information/README.md), [หน้าแรก](../../api/menus/home/README.md), [สถิติ/ปฏิทิน](../../api/shared/connected-measurement-points/README.md)
- Reason: ให้หน้าแรกและข้อมูลทั่วไปคัดจุดปัจจุบันด้วยเกณฑ์เดียวกันก่อนนับและคำนวณผลสรุป
- Client impact: ยอด/พารามิเตอร์/อัตราการระบายอาจลดลง; ไม่เปลี่ยน request/response schema หรือสิทธิ์; จุดขยายเวลาเรียกสถิติ/ปฏิทินไม่ได้
- Breaking change: yes — [การเปลี่ยนขอบเขตการนับ](../../api/CHANGELOG.md#home-general-current-point-counts)
