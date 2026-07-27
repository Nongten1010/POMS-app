# TDD Evidence: การรายงานค่าต่อพารามิเตอร์ใน Integration Device Config

เอกสารนี้สนับสนุน [Integration Device Config contract](../../api/integrations/device-configs/README.md) และไม่ใช้แทน canonical API contract

## Source

- ไม่มี plan file
- User journey มาจากคำขอให้ `parameterConfigs[]` ของ API ภายนอกคืนข้อมูลกลุ่ม “การรายงานค่า” ของพารามิเตอร์แต่ละตัว

## User Journey

ในฐานะระบบภายนอกที่ดึง active device config ต้องการรับ `standardCondition`, `dryBasis` และ `oxygenOrExcessAir` ของแต่ละพารามิเตอร์ เพื่อประมวลผลค่าตามเงื่อนไขการรายงานที่โรงงานระบุไว้

## RED

Command:

```bash
cd backend
npm test -- --runInBand tests/unit/integration-device-configs.service.test.ts
```

Result:

- `1` suite failed
- `2` tests failed และ `1` test passed
- failure เกิดจาก `parameterConfigs[]` ยังไม่มี `standardCondition`, `dryBasis` และ `oxygenOrExcessAir`
- RED checkpoint: `86c4dc8 test: add reporting fields to integration parameter configs`

## GREEN

Command เดิมผ่านหลังเพิ่ม type และ mapping:

```bash
cd backend
npm test -- --runInBand tests/unit/integration-device-configs.service.test.ts
```

Result:

- `1` suite passed
- `3` tests passed
- GREEN checkpoint: `5c2cfb1 feat: expose parameter reporting settings to integrations`
- Refactor checkpoint: `6570d05 refactor: clarify integration parameter metadata mapping`
- Expanded route/ambiguity coverage: `4a60dce test: cover integration parameter reporting metadata`

## Test Specification

| # | What is guaranteed | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | API แนบ reporting fields เข้ากับ `parameterConfigs[]` ตามชื่อพารามิเตอร์ | `integration-device-configs.service.test.ts: returns separated device, parameter, and schedule config for a station` | Unit | PASS |
| 2 | ค่า `false` คงเป็น `false` และค่าที่ไม่มีข้อมูลคืน `null` | `integration-device-configs.service.test.ts: returns database table names and preserves nullable channel config values` | Unit | PASS |
| 3 | fallback แบบตัดหน่วยใช้ได้เฉพาะเมื่อชื่อพารามิเตอร์ตรงเพียงรายการเดียว และไม่เลือกข้อมูลแบบกำกวม | `integration-device-configs.service.test.ts: uses reporting settings from a unique unitless match and avoids ambiguous matches` | Unit | PASS |
| 4 | HTTP response ส่ง reporting fields ผ่าน endpoint ที่ใช้ `X-API-Key` | `integration-device-configs.route.test.ts: returns flat integration device config groups with a valid API key` | Route integration | PASS |

## Verification And Coverage

```bash
cd backend
npm test -- --coverage --runInBand \
  tests/unit/integration-device-configs.service.test.ts \
  tests/unit/integration-device-configs.route.test.ts \
  --collectCoverageFrom=src/modules/integrations/integration-device-configs.service.ts
```

- `2` suites passed
- `13` tests passed
- Changed service coverage: statements `93.4%`, branches `85.1%`, functions `100%`, lines `100%`
- `npm run typecheck`: PASS
- ESLint สำหรับ service, types และ tests ที่เกี่ยวข้อง: PASS

## Known Gaps

- ไม่เพิ่ม browser E2E เพราะ contract นี้เป็น server-to-server read-only API และไม่มีการแก้ frontend
- ไม่แก้ persistence schema เพราะข้อมูลทั้งสาม field มีอยู่แล้วใน `measurementInstruments.parameters[]`
