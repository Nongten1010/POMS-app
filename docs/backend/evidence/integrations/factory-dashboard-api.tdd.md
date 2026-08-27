# หลักฐาน TDD: Dashboard ข้อมูลตรวจวัดรายโรงงานสำหรับระบบภายนอก

Canonical contract: [Dashboard ข้อมูลตรวจวัดรายโรงงานสำหรับระบบภายนอก](../../api/integrations/factory-dashboard/README.md)

## Source And User Journeys

ไม่มี plan file; journeys มาจาก requirement ในงานนี้โดยตรง:

1. ระบบภายนอกที่ไม่ได้ login เรียก `GET /integrations/lasthour/factories/:registrationNo` พร้อมเลขทะเบียนโรงงานและ key เฉพาะ endpoint เพื่ออ่านข้อมูลชั่วโมงล่าสุดของโรงงานหนึ่งแห่ง
2. Client ที่ไม่มี key, ใช้ key ผิด scope หรือส่งเลขทะเบียนผิดรูปแบบต้องถูกปฏิเสธก่อนเรียก service
3. Client ได้ response รูปแบบ dashboard เดิมที่มีโรงงานเดียว โดยไม่คืน `isFavorite`
4. Runtime OpenAPI และ canonical docs ต้องตรงกับ route, authentication, validation และ response จริง
5. Client เดิมยังเรียก `/api/v1/integrations/factories/:registrationNo/dashboard` ได้ระหว่างย้ายระบบ และได้รับ `Deprecation: true`

## RED And GREEN Evidence

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| Runtime RED | `npm test -- --runInBand tests/unit/integration-factory-dashboard.route.test.ts tests/unit/integration-factory-dashboard.service.test.ts` | FAIL ตามคาด | TypeScript หา `integration-factory-dashboard.service` ไม่พบ และ query type ยังไม่มี `registrationNo` |
| Runtime GREEN | command เดียวกับ Runtime RED | PASS | `2` suites, `7` tests |
| OpenAPI RED | `npm test -- --runInBand tests/unit/integration-factory-dashboard.openapi.test.ts` | FAIL ตามคาด | ยังไม่มี path `/integrations/factories/{registrationNo}/dashboard` |
| OpenAPI GREEN | command เดียวกับ OpenAPI RED | PASS | `1` suite, `1` test |
| URL migration RED | `npm test -- --runInBand tests/unit/integration-factory-dashboard.route.test.ts tests/unit/integration-factory-dashboard.openapi.test.ts` | FAIL ตามคาด | canonical root path ยังตอบ `404` และ OpenAPI ยังไม่มี `/integrations/lasthour/factories/{registrationNo}` |
| URL migration GREEN | command เดียวกับ URL migration RED | PASS | `2` suites, `7` tests; canonical path ใช้งานได้และ legacy alias ถูกประกาศ deprecated |

ไม่ได้สร้าง checkpoint commits ระหว่าง RED/GREEN เพราะในช่วงพัฒนาเริ่มต้นผู้ใช้ยังไม่ได้สั่ง commit

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | key จาก `FACTORY_DASHBOARD_API_KEYS` เรียก canonical endpoint `/integrations/lasthour/factories/:registrationNo` และได้ dashboard หนึ่งโรงงาน | `integration-factory-dashboard.route.test.ts: returns one factory dashboard with a dedicated API key` | Route integration | PASS |
| 2 | ไม่มี key หรือใช้ generic integration key ถูกปฏิเสธด้วย `401` | `integration-factory-dashboard.route.test.ts` security cases | Route integration | PASS |
| 3 | เลขทะเบียนที่ไม่ใช่ตัวเลข 14 หลักถูกปฏิเสธด้วย `400 VALIDATION_ERROR` | `integration-factory-dashboard.route.test.ts: rejects an invalid factory registration number` | Route integration | PASS |
| 4 | ไม่พบ active connected factory ตอบ `404 NOT_FOUND` | `integration-factory-dashboard.route.test.ts: returns 404 when the connected POMS factory does not exist` | Route integration | PASS |
| 5 | service ส่ง `registrationNo` ไปกรอง public dashboard source และคง envelope ที่มี `meta.total=1` | `integration-factory-dashboard.service.test.ts` | Unit | PASS |
| 6 | public dashboard source โหลด connected points เฉพาะเลขทะเบียนใหม่ที่ร้องขอ | `connection-requests.service.test.ts: filters the public dashboard source by the requested new registration number` | Unit | PASS |
| 7 | OpenAPI ระบุ canonical root path พร้อม operation-level server `/`, 14-digit validation, dedicated security scheme และ single-row response | `integration-factory-dashboard.openapi.test.ts` | Contract | PASS |
| 8 | response schema ไม่มี `isFavorite` และมี `hasLatestHourlyMeasurement`/`measurementPoints` | `integration-factory-dashboard.openapi.test.ts` | Contract | PASS |
| 9 | legacy endpoint ยังตอบข้อมูลได้และส่ง `Deprecation: true`; OpenAPI ระบุ `deprecated: true` | route และ OpenAPI tests | Compatibility | PASS |

## Verification

| Check | Result |
| --- | --- |
| Focused route + OpenAPI/docs tests | PASS, `4` suites / `78` tests |
| Feature coverage | PASS, `100%` statements, branches, functions และ lines สำหรับ controller/service/validator ใหม่ |
| Backend typecheck | PASS, `npm run typecheck` |
| Backend build | PASS, `npm run build` |
| Full backend suite | PASS, `147` suites / `1516` tests |
| Focused ESLint and Prettier | PASS สำหรับ route, app mount, integration/OpenAPI และ tests ที่เกี่ยวข้อง |
| Diff whitespace check | PASS, `git diff --check` |

## Known Gaps And Deployment Notes

- งานนี้ไม่สร้างหรือบันทึก production key จริง ต้องตั้ง `FACTORY_DASHBOARD_API_KEYS` ใน secret store ของ deployment และ rotate ค่าแยกจาก integration keys อื่น
- production ต้อง deploy ทั้ง backend route และ `frontend/public/web.config` เพื่อให้ IIS proxy `/integrations/lasthour/*` ไปยัง backend ก่อน React Router fallback
- ทุก production release ต้องตรวจ `/api/v1/openapi.json` และเรียก `https://d-poms.diw.go.th/integrations/lasthour/factories/:registrationNo` ด้วย test key ที่ได้รับอนุญาต
- legacy endpoint ยังไม่มีวัน sunset; ห้ามลบจนกว่าจะกำหนด timeline และยืนยันว่า client เดิมย้ายครบแล้ว
- Runtime ปัจจุบันใช้ global rate limiter แบบเดียวกับ API อื่น การบังคับ limit แบบ shared store ระหว่างหลาย replicas ต้องทำที่ gateway หรือเพิ่ม distributed store ในงานแยก
