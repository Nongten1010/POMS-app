# POMS factory form current parameter semantics - TDD evidence

## Source and scope

ไม่มี source plan; user journey และ acceptance criteria มาจากงานแก้
`GET /api/v1/poms-factories/:factoryId/form` โดยตรง

ขอบเขตนี้ไม่เปลี่ยน `GET /api/v1/poms-factories/edit-requests/:id/form` ซึ่งต้องคง
proposed snapshot ของคำขอเดิม

## User journey

ผู้ใช้เปิดแบบฟอร์มโรงงาน POMS แล้วต้องเห็นรายการพารามิเตอร์ที่เชื่อมต่ออยู่ปัจจุบัน
พร้อมรายการที่ยังขาด โดยไม่ใช้ค่า snapshot เก่าจากคำขอเชื่อมต่อ

## Guarantees

สำหรับแต่ละ `measurementPoints[].details`:

- `eligibleParameters` คงรายการพารามิเตอร์ที่เข้าข่าย
- `connectedParameters` เท่ากับพารามิเตอร์ current/live ใน active
  `cems_wpms_connected_measurement_points.parameters_json`
- `pendingParameters = eligibleParameters - connectedParameters`
- `requestedParameters` เท่ากับ `connectedParameters` ปัจจุบัน
- field อื่นใน `details` ยังคงเดิม

## RED and GREEN evidence

### Current/live response

Command:

```bash
npm test -- --runInBand tests/unit/poms-factories.service.test.ts -t "derives current parameter groups from the live connected parameters"
```

RED: test พบว่า response ยังคืน `connectedParameters`, `pendingParameters` และ
`requestedParameters` จาก snapshot เก่า

GREEN: `1 passed` หลัง derive กลุ่มพารามิเตอร์จาก `point.parameters`
ของ active connected point

### Endpoint scope guard

Command:

```bash
npm test -- --runInBand tests/unit/poms-factories.service.test.ts -t "keeps proposed parameter groups in an existing edit-request form"
```

RED: การแก้รอบแรก derive ค่าบน edit-request form ด้วย ทำให้ proposed snapshot เปลี่ยน

GREEN: จำกัดการ derive เฉพาะ factory form endpoint และ test ผ่าน

### Runtime OpenAPI

Command:

```bash
npm test -- --runInBand tests/unit/poms-factories.openapi.test.ts -t "documents the current/live parameter semantics for the POMS factory form"
```

RED: operation description ยังไม่ระบุ source และสูตรของ 4 fields

GREEN: OpenAPI ระบุ `parameters_json`, current/live semantics และสูตร subtraction ครบ

## Test specification

| # | What is guaranteed | Test | Type | Result |
| - | ------------------ | ---- | ---- | ------ |
| 1 | factory form คืน connected/requested จาก current/live point และคำนวณ pending ตามสูตร | `poms-factories.service.test.ts: derives current parameter groups...` | unit | PASS |
| 2 | edit-request form ยังคง proposed parameter snapshot | `poms-factories.service.test.ts: keeps proposed parameter groups...` | unit | PASS |
| 3 | runtime OpenAPI อธิบาย semantics ของทั้ง 4 fields | `poms-factories.openapi.test.ts: documents the current/live parameter semantics...` | contract | PASS |

## Verification and known gaps

- Focused POMS factory tests: 3 suites, 63 tests passed
- Full backend tests: 182 suites, 1,912 tests passed
- Typecheck: PASS
- Build: PASS
- Focused service coverage: statements 84.5%, functions 85.71%, lines 86.25%,
  branches 71.12%
- Branch coverage ทั้ง service ยังต่ำกว่า 80%; branch ใหม่ของงานนี้ถูกทดสอบทั้ง factory
  form และ edit-request form แต่ยังมี branches เดิมนอก scope ที่ไม่ครอบคลุม
