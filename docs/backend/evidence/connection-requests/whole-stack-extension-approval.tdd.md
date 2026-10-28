# หลักฐานทดสอบการอนุมัติขยายระยะเวลาทั้งปล่อง

## Contract และขอบเขต

- [คำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md)
- [Mapping ตัวเลือก, request และ response สำหรับ Frontend](../../api/menus/connection-requests/request-payloads-and-validation.md#whole-stack-options)
- [ผลกระทบและขั้นตอนปรับ client](../../api/CHANGELOG.md#whole-stack-extension-approval)

ผู้ใช้ยืนยันขอบเขตทดสอบ 2 จุดก่อนเขียน test ตาม `matt:tdd`: API คำขอและอนุมัติผ่าน HTTP และ runtime OpenAPI ทดสอบ routes, validation, service และ repository จริง โดยจำลองฐานข้อมูลด้วย SQLite ในหน่วยความจำและใช้ test account fixture ของโครงการ การแปล dialect เกิดเฉพาะขอบเขต SQL; ไม่มีการเชื่อมต่อ production หรือแก้ Frontend

## รอบ Red → Green

| รอบ | คำสั่งจาก `backend/` | Red | Green |
| --- | --- | --- | --- |
| อนุมัติผ่าน HTTP | `npm test -- --runInBand tests/unit/connection-requests.whole-stack-extension.api.test.ts` | คำขอขยายเวลาทั้งปล่องได้ `WAITING_CONNECTION`, `verifiedAt: null` และกำหนด 30 วัน แทน `CONNECTED` | ขยายเงื่อนไขเดิมของ add-point ให้รวมสถานะขยายเวลาที่ไม่มีพารามิเตอร์ โดยใช้ transaction ออกรหัสและสร้าง active point เดิม |
| OpenAPI ที่ให้ client อ่าน | `npm test -- --runInBand tests/unit/connection-requests.whole-stack-extension.openapi.test.ts` | schema ไม่มีคำอธิบาย mapping ตัวเลือกใหม่ | `/api/v1/openapi.json` มี mapping, ตัวอย่าง request ที่ผ่าน validator และตัวอย่างผลอนุมัติทั้ง `review`/`status` |

## พฤติกรรมที่ตรวจผ่าน public API

- สร้างคำขอจาก payload ของ Frontend ได้ `201`, `ADD_MEASUREMENT_POINT`, `PENDING_DESIGN_REVIEW` และรายการพารามิเตอร์ว่าง
- `APPROVE_DESIGN` และ `APPROVE_FORM` อนุมัติขยายเวลาทั้งปล่องเป็น `CONNECTED`, ออกรหัส `S2001`, บันทึก `verifiedAt` และไม่เริ่มกำหนดตั้งค่าอุปกรณ์ 30 วัน
- อ่าน `connected-measurement-points` หลังอนุมัติพบ current/live point ที่คง `monitoringPointStatus = "อยู่ระหว่างขยายเวลา"` และ `parameters: []`
- กรณี `ได้รับการยกเว้นทั้งหมด` เดิมยังผ่าน รวมการอ่านสถานะ/ประวัติคำขอที่บันทึกแล้ว
- คำขอที่ทุกจุดเป็นขยายเวลาทั้งปล่องหรือยกเว้นทั้งหมดใช้ทางลัดเดียวกัน; ถ้ามีจุดที่ต้องเชื่อมต่อจริงร่วมอยู่ ให้ใช้ `WAITING_CONNECTION`
- จุดขยายเวลาที่มีพารามิเตอร์จริง และคำขอ `ADD_PARAMETER` ยังคงใช้ flow ตั้งค่าอุปกรณ์
- ผู้ไม่ล็อกอิน ผู้ไม่มีสิทธิ์อนุมัติ และเจ้าหน้าที่นอกจังหวัดที่รับผิดชอบถูกปฏิเสธด้วย `401`, `403`, `404` ตามลำดับ โดยไม่เปลี่ยนสถานะ ประวัติ หรือรหัสจุด
- จำลองฐานข้อมูลค่าตรวจวัดไม่อนุญาต metadata แล้ว API ตอบ `503 MEASUREMENT_CLEANUP_FAILED`; transaction ย้อนสถานะ/ประวัติ/รหัสจุด และลองใหม่สำเร็จโดยได้ `S2001`
- ชื่อบนหน้าจอ `อยู่ระหว่างขยายระยะเวลาทั้งปล่อง` ไม่ใช่ค่า API enum; ส่งตรงใน `monitoringPointStatus` ตอบ `400 VALIDATION_ERROR` ที่ field นั้น ต้อง map เป็น `อยู่ระหว่างขยายเวลา`

ไฟล์ทดสอบ: [HTTP API](../../../../backend/tests/unit/connection-requests.whole-stack-extension.api.test.ts), [runtime OpenAPI](../../../../backend/tests/unit/connection-requests.whole-stack-extension.openapi.test.ts), [SQL fixture](../../../../backend/tests/helpers/connection-request-approval-api-fixture.ts)

## Verification

ผลด้านล่างเป็นการตรวจใน workspace พัฒนาก่อนจัดชุด release บน `main` ล่าสุด

| รายการ | ผล |
| --- | --- |
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| ESLint เฉพาะ source และ test/helper ที่เปลี่ยน | PASS |
| ชุดทดสอบที่เกี่ยวข้องพร้อม coverage | PASS: 11 suites, 496 tests |
| Coverage เฉพาะ `connection-requests.service.ts` และ `connection-requests.openapi.ts` | statements 86.52%, branches 76.01%, functions 94.03%, lines 90.31% |
| ลิงก์เอกสารและการเข้าถึงจาก backend hub | PASS: ตรวจ 408 local links ในไฟล์เอกสารที่เปลี่ยนแบบ transition และ evidence ใหม่ reachable |
| Security scan และ incremental diff | PASS: ไม่มี secret/log เพิ่มใน code diff; 10 ไฟล์อยู่ใน `backend/` และ canonical docs เท่านั้น |

ไม่พบคำสั่ง docs guard ที่ติดตั้งใน repository จึงตรวจลิงก์, anchor, placement, reachability และ documentation-impact fields ด้วยการตรวจเฉพาะงาน โดยข้าม legacy links/template placeholders ที่ไม่ถูกแก้ เงื่อนไขอนุมัติใหม่ถูกเรียก 17 ครั้งใน regression และทุก operand ของเงื่อนไขมี coverage

คำสั่ง regression:

```bash
npm test -- --runInBand \
  tests/unit/connection-requests.whole-stack-extension.api.test.ts \
  tests/unit/connection-requests.whole-stack-extension.openapi.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/connection-requests.validator.test.ts \
  tests/unit/connection-requests.service.test.ts \
  tests/unit/connection-requests.repository.test.ts \
  tests/unit/connection-requests.current-factory-profile.repository.test.ts \
  tests/unit/connection-requests.point-code-sequence.repository.test.ts \
  tests/unit/connection-requests.status.route.test.ts \
  tests/unit/connection-requests.create.route.test.ts \
  tests/unit/connection-requests.form.route.test.ts \
  --coverage \
  --collectCoverageFrom=src/modules/connection-requests/connection-requests.service.ts \
  --collectCoverageFrom=src/modules/api-docs/connection-requests.openapi.ts \
  --coverageReporters=text-summary
```

## ข้อจำกัดและการส่งมอบ

SQL fixture ใช้ legacy factory-profile mode และไม่ยืนยัน locking/concurrency ของ SQL Server จริง ชุดทดสอบ canonical profile เดิมถูกรวมใน regression แล้ว แต่ flow ขยายเวลาผ่าน HTTP ยังไม่ได้ทดสอบบน SQL Server หรือ production ไม่มี migration ใหม่และไม่เปลี่ยนสถานะคำขอที่อนุมัติไปแล้ว

การส่ง production ใช้ [Git delivery workflow](../../guides/production-git-delivery.md) เมื่อผู้ใช้อนุญาต หลัง workflow สำเร็จต้องตรวจ health, deploy marker และ production `/api/v1/openapi.json` ให้ตรงกับ contract ก่อนบันทึกผล release

Docs impact: updated
Canonical docs: [เมนูคำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md), [payload/validation](../../api/menus/connection-requests/request-payloads-and-validation.md)
Reason: คำขอขยายเวลาทั้งปล่องที่ไม่มีพารามิเตอร์เปลี่ยนผลอนุมัติจากรอตั้งค่าอุปกรณ์เป็น CONNECTED
Client impact: frontend
Breaking change: yes

รายการ breaking change: [migration](../../api/CHANGELOG.md#whole-stack-extension-approval)

## การเตรียม release บน main ล่าสุด

ชุด release เริ่มจาก [`b804b0af`](https://github.com/Nongten1010/POMS-app/commit/b804b0af3f595a6930a9ffb5868dd136107671b0) โดยแยก worktree และย้ายเฉพาะ patch ของงานนี้ 10 ไฟล์ รักษา permission, การตรวจเจ้าของจุด และ OpenAPI ที่เพิ่มบน main ไว้ ปรับ test fixture ให้ใช้ `connected_at` จากฐานทดสอบเวอร์ชันล่าสุด และเตรียมจุดเดิมที่มีเจ้าของถูกต้องสำหรับ regression ของ `ADD_PARAMETER`

[Inspect production checkout run `40627521852`](https://github.com/Nongten1010/POMS-app/actions/runs/40627521852) ผ่าน ตรวจ manifest และ SHA-256 ของ snapshot แล้ว: checkout อยู่ที่ `b59b5b5a511e7ceb94ed1cac0b5c52641ab7f815`, `trackedChanges: []`, `reviewedStatus: []` จึงใช้เส้นทาง deploy ปกติได้โดยไม่ต้อง reconcile source บนเซิร์ฟเวอร์

ติดตั้ง dependencies ของ main จาก lockfile ด้วย `npm ci --ignore-scripts` ใน worktree ใหม่ การทดสอบ local release ใช้ environment สังเคราะห์, `PARAMETER_DB_SCHEMA=ingest`, `PUBLIC_BASE_URL=http://d-poms.diw.go.th` และสุ่มค่า signing secrets ชั่วคราวใน process โดยไม่คัดลอก environment หรือ credentials ของ production

ผลตรวจชุด release บน main ล่าสุดก่อน push:

| รายการ | ผล |
| --- | --- |
| Build / typecheck | PASS |
| ESLint เฉพาะ source และ tests/helper ที่เปลี่ยน | PASS |
| Tests ทั้ง backend (`npm test -- --runInBand`) | PASS: 370 suites, 4,955 tests; ข้าม 2 suites / 18 tests ที่ต้องใช้ environment ภายนอก |
| ลิงก์เอกสาร release | PASS: 425 local links |
| Security scan และ `git diff --check` | PASS |

ไม่ได้ปรับรูปแบบ code เดิมของ main ที่อยู่นอก patch; logic อนุมัติและ OpenAPI เพิ่มเฉพาะ behavior ที่ขอ และไม่มี migration ใหม่

## ผล production ที่ตรวจจริง

ส่ง [application commit `383d3f563092befdbdc80e30909cf8af2ab3e910`](https://github.com/Nongten1010/POMS-app/commit/383d3f563092befdbdc80e30909cf8af2ab3e910) เข้า `main` และ [Deploy POMS run `40627978215`](https://github.com/Nongten1010/POMS-app/actions/runs/40627978215) จบด้วย `success` ตรวจ contract และ public marker เมื่อ `2026-10-28T10:47:01+07:00` (`Asia/Bangkok`)

| หลักฐาน | ผล |
| --- | --- |
| Build และ tests บน production runner | PASS: 370 suites, 4,955 tests; ข้าม 2 suites / 18 tests |
| Migrations | PASS: `Already up to date`; ไม่มี migration ใหม่ใน release นี้ |
| Factory profile activation prerequisites | ขั้นตอนใน workflow ผ่านตาม mode ที่ production ตั้งไว้ |
| Restart และ health | HTTP 200; `success: true`, `status: ok`, timestamp `2026-10-28T03:46:06.006Z` |
| Backend deploy marker | ขั้นตอน `Write backend deploy marker` ของ application commit ข้างต้นผ่าน |
| [Production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) | HTTP 200; enum คง `อยู่ระหว่างขยายเวลา`, description แสดงชื่อ “อยู่ระหว่างขยายระยะเวลาทั้งปล่อง” และมีตัวอย่าง request ที่ส่งรายการพารามิเตอร์/เครื่องมือว่าง |
| ผลอนุมัติใน runtime contract | ทั้ง `review` และ `status` มีตัวอย่าง `wholeStackExtension`: `CONNECTED`, `connectionDueAt: null`, สถานะจุดเดิม และ `parameters: []` |
| [Production API Docs](https://d-poms.diw.go.th/api/v1/docs/) | HTTP 200 |
| Frontend marker | คงข้อมูลทุก field จากก่อน release: SHA `bde8021d6169131d380c6ca31395a76a3d4a1941`, run `40521414225`, run number `698` และ timestamp เดิม; Build/Deploy frontend ถูกข้าม |

การตรวจหลัง deploy เป็น read-only ผ่าน contract, public marker และผล workflow ไม่ได้สร้างคำขอจริงเพื่อทดสอบอนุมัติบน production หลักฐาน HTTP behavior อยู่ในชุดทดสอบที่ระบุข้างต้น เอกสารผล production ส่งเป็น commit เฉพาะ Markdown แยกจาก application release จึงไม่เปลี่ยน Backend deploy marker
