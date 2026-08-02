# TDD Evidence: ประเภทจุดตรวจวัดใน Integration Device Config

เอกสารนี้สนับสนุน [Integration Device Config contract](../../api/integrations/device-configs/README.md) และไม่ใช้แทน canonical API contract

## Source

- ไม่มี plan file
- User journeys และ acceptance criteria มาจากแบบ API ที่ผู้ใช้อนุมัติในรอบนี้
- ขอบเขตคือ response ของ `GET /api/v1/integrations/device-configs/:stationId`; ไม่แก้ frontend หรือ flow สร้าง/แก้ไขจุดตรวจวัด

## User Journeys

1. ในฐานะ Worker ต้องการอ่าน `measurementPointType` ค่าเดียว เพื่อเลือก flow สำหรับ `CEMS`, `WPMS`, `MOBILE` หรือ `STATION`
2. ในฐานะระบบที่ตรวจสอบข้อมูล ต้องการอ่าน `systemType`, `pointType` และ `monitoringPointKind` ควบคู่กัน เพื่อเห็น source metadata โดยไม่เก็บซ้ำในแต่ละ device
3. ในฐานะ client ที่อ่านข้อมูลเดิม ต้องการให้จุด `CEMS`/`WPMS` ที่ยังไม่มี `monitoringPointKind` ถูกจำแนกจากคู่ `systemType` และ `pointType` ได้
4. ในฐานะ client ที่รับข้อมูลไม่สมบูรณ์ ต้องการค่า `UNKNOWN` แทนการเดา `Mobile` หรือ `Station` ผิด

## RED

Command:

```bash
cd backend
npm test -- --runInBand \
  tests/unit/integration-device-configs.service.test.ts \
  tests/unit/integration-device-configs.route.test.ts \
  tests/unit/integration-device-configs.repository.test.ts
```

Result:

- `3` suites failed ก่อนเริ่ม production change
- compile-time RED ระบุว่า `IntegrationConnectedPointDTO` ยังไม่มี `systemType`, `pointType`, `monitoringPointKind`
- compile-time RED ระบุว่า `IntegrationDeviceConfigsResponseDTO` ยังไม่มี `measurementPointType`
- RED checkpoint: `b4b1019 test: define device config point type contract`

## GREEN

Command เดิมผ่านหลังเพิ่ม source-field lookup, normalization และ response mapping:

```text
Test Suites: 3 passed, 3 total
Tests:       25 passed, 25 total
```

- GREEN checkpoint: `169b08d feat: expose device config point types`
- หลังจัดรูปแบบ test files รัน target เดิมซ้ำและยังผ่าน `25/25`

## Task Report

| Behavior | Test target | RED evidence | GREEN evidence | Guarantee |
| --- | --- | --- | --- | --- |
| Response เพิ่ม field สรุปและ source fields ที่ root | route/service tests | DTO ไม่มี field ใหม่ | target tests `25/25` ผ่าน | envelope และ arrays เดิมยังอยู่ พร้อม metadata ใหม่ |
| อ่าน `system_type`, `point_type`, `details_json` จาก connected point | repository test | repository ยังไม่ได้ select field | repository suite ผ่าน | ข้อมูลมาจาก station snapshot ไม่ใช่ device config |
| Normalize ตัวพิมพ์และช่องว่าง | service matrix | response ไม่มี mapping | service matrix ผ่าน | `Mobile`, `station` และรูปแบบมีช่องว่างคืนค่า uppercase enum |
| Legacy fallback | service matrix | response ไม่มี mapping | service matrix ผ่าน | `CEMS/STACK` และ `WPMS/WASTEWATER` จำแนกได้เมื่อ kind ไม่มีค่า |
| Fail-safe mapping | service matrix | response ไม่มี `UNKNOWN` | service matrix ผ่าน | ข้อมูลกำกวมหรือขัดแย้งไม่ถูกเดาเป็น Mobile/Station |

## Test Specification

| # | What is guaranteed | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | CEMS, WPMS, Mobile และ Station คืน metadata ที่ normalize แล้ว | `integration-device-configs.service.test.ts: returns normalized measurement-point metadata` | Unit | PASS |
| 2 | legacy CEMS/WPMS ที่ไม่มี kind ใช้คู่ system/point เป็น fallback | `integration-device-configs.service.test.ts: falls back` | Unit | PASS |
| 3 | metadata กำกวม ขัดแย้ง หรือ kind ไม่รู้จักคืน `UNKNOWN` | `integration-device-configs.service.test.ts: returns UNKNOWN instead of guessing` | Unit | PASS |
| 4 | repository select source fields ครบและป้องกัน JSON/kind ที่ผิดชนิด | `integration-device-configs.repository.test.ts` | Repository unit | PASS |
| 5 | HTTP response ส่งสี่ field ใหม่โดยคง `Cache-Control: no-store` และ API-key behavior | `integration-device-configs.route.test.ts` | Route integration | PASS |

## Verification And Coverage

- `npm run build`: PASS
- `npm run typecheck`: PASS
- ESLint สำหรับ source/tests ที่เปลี่ยน: PASS, ไม่มี warning
- Prettier สำหรับ source/tests ที่เปลี่ยน: PASS
- Full suite: `100` suites passed, `869` tests passed, ไม่มี skipped snapshot
- Coverage ของ `src/modules/integrations`: statements `95.29%`, branches `88.74%`, functions `100%`, lines `99.33%`
- Coverage ทั้ง repository: statements `57.13%`, branches `56.34%`, functions `61.07%`, lines `58.35%`; เป็น baseline ต่ำกว่าเป้าหมาย global `80%` และไม่ได้ลด scope ของ feature coverage
- PDF guide: render เป็น Letter `6` หน้าและตรวจภาพทุกหน้าหลัง render รอบสุดท้ายแล้ว

## Security Review

- query ใช้ Knex query builder และไม่ต่อ `stationId` เข้ากับ SQL string
- response field ใหม่มาจาก connected-point snapshot และ normalize ด้วย enum allowlist
- ไม่เพิ่ม authentication surface, request input, logging หรือ secret handling
- source scan ของไฟล์ที่เปลี่ยนไม่พบ API key, token, private key หรือ password ใหม่
- `npm audit --audit-level=high` พบ baseline dependency advisories `2` รายการ: `brace-expansion` ระดับ high และ `body-parser` ระดับ low; งานนี้ไม่แก้ dependency/lockfile

## Known Gaps

- ไม่เพิ่ม browser E2E เพราะ endpoint เป็น server-to-server read-only และไม่มี frontend change
- ไม่เพิ่ม live-database test; repository query ถูกทดสอบด้วย Knex-chain mock และ full suite
- flow สร้าง/แก้ไข connection request ปัจจุบันยังไม่ได้ขยาย validator ให้สร้าง `MOBILE`/`STATION`; feature นี้อ่านและจำแนกข้อมูลที่มีอยู่เท่านั้น
- full-repository format check ยังมี warning เดิมในไฟล์นอกขอบเขต; source/tests ของงานนี้ผ่าน targeted format check

## Merge Evidence

- RED: `b4b1019 test: define device config point type contract`
- GREEN: `169b08d feat: expose device config point types`
- หาก delivery ภายหลัง squash commits ให้คง RED/GREEN summary นี้ไว้ใน PR หรือ squash commit body
