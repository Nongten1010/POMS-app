# หลักฐาน TDD: รหัสจุดตรวจวัดแบบลำดับรายปี

เอกสารนี้สนับสนุน [contract เมนูขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#point-code-contract) และไม่ใช้แทน canonical API contract.

## Source Plan

ไม่มี plan file. User journey และ acceptance criteria มาจากการยืนยันรูปแบบรหัสในบทสนทนางานนี้.

## User Journeys

1. ในฐานะเจ้าหน้าที่ เมื่ออนุมัติแบบ CEMS ฉันต้องได้รับรหัส `CEMS-NNNN/YYYY` เพื่อให้รหัสแสดงระบบ ลำดับ และปี พ.ศ. ชัดเจน.
2. ในฐานะเจ้าหน้าที่ เมื่ออนุมัติแบบ WPMS ฉันต้องได้รับรหัส prefix `WEMS` เช่น `WEMS-0003/2571`.
3. ในฐานะผู้ดูแลระบบ ฉันต้องการให้ CEMS/WPMS แยกลำดับกันและเริ่ม `0001` ใหม่ทุกปี โดยคำขอพร้อมกันต้องไม่รับเลขซ้ำ.
4. ในฐานะ client ฉันต้องยังใช้รหัสเดิมได้ และใช้รหัสใหม่เป็น `stationId` ใน integration, query และ URL-encoded path ได้ แม้ reverse proxy จะถอด `%2F` ก่อนส่งเข้า Express.

## RED Evidence

คำสั่ง:

```bash
npm test -- --runInBand \
  tests/unit/connection-requests.point-code-sequence.repository.test.ts \
  tests/unit/annual-point-code-sequence-migration.test.ts \
  tests/unit/parameter-values.validator.test.ts
```

ผล: `3 failed`; generator เดิมยัง query `cems_wpms_point_code_sequences`, migration `0080` ยังไม่มี และ validator ปฏิเสธ `CEMS-0001/2569` กับ `WEMS-0003/2571`.

Compatibility RED:

```bash
npm test -- --runInBand \
  tests/unit/alert-events.route.test.ts \
  tests/unit/connection-requests.service.test.ts
```

ผล: `2 failed`; alert integration ตอบ `400` และ dashboard ไม่โหลด hourly measurement สำหรับ station ID รูปแบบใหม่.

Reverse-proxy compatibility RED:

```bash
npm test -- --runInBand \
  tests/unit/connected-measurement-points.route.test.ts \
  tests/unit/integration-device-configs.route.test.ts
```

ผล: `2 failed` จาก test ใหม่ โดยทั้งสอง route ตอบ `404` เมื่อรับ path สอง segment เช่น `CEMS-0001/2569`; ตรงกับ production probe ผ่าน IIS/ARR ก่อนแก้ไข.

## GREEN Evidence

| # | สิ่งที่รับประกัน | Test | ประเภท | ผล |
| --- | --- | --- | --- | --- |
| 1 | CEMS จุดแรกปี 2569 เป็น `CEMS-0001/2569` | `connection-requests.point-code-sequence.repository.test.ts` | repository/unit | PASS |
| 2 | WPMS ลำดับที่ 3 ปี 2571 เป็น `WEMS-0003/2571` | `connection-requests.point-code-sequence.repository.test.ts` | repository/unit | PASS |
| 3 | ระบบเดิมเริ่ม `0001` ใหม่เมื่อเปลี่ยนปี และไม่ใช้รหัสปีเก่าคำนวณ | `connection-requests.point-code-sequence.repository.test.ts` | repository/unit | PASS |
| 4 | การอนุมัติพร้อมกันไม่จองเลขซ้ำ และใช้ `UPDLOCK, HOLDLOCK` | `connection-requests.point-code-sequence.repository.test.ts` | concurrency/unit | PASS |
| 5 | ตาราง sequence แยก key ด้วย `system_type + buddhist_year` โดยไม่แก้ point code เดิม | `annual-point-code-sequence-migration.test.ts` | migration/unit | PASS |
| 6 | ปี พ.ศ. เปลี่ยนตามเขตเวลา `Asia/Bangkok` | `monitoring-point-code.test.ts` | unit | PASS |
| 7 | Parameter API, alert integration, integration device-configs และ dashboard รองรับ station ID รูปแบบใหม่ | `parameter-values.validator.test.ts`, `alert-events.route.test.ts`, `integration-device-configs.route.test.ts`, `connection-requests.service.test.ts` | unit/integration | PASS |
| 8 | Path ที่ส่ง `%2F` โดยตรงหรือถูก reverse proxy ถอดเป็นสอง segment ถูกประกอบกลับเป็น point code เดิมก่อนส่งเข้า service | `connected-measurement-points.route.test.ts`, `integration-device-configs.route.test.ts` | route/integration | PASS |

Targeted GREEN:

```text
Test Suites: 8 passed, 8 total
Tests:       124 passed, 124 total
```

## Coverage And Verification

Targeted coverage ของ code ใหม่:

```text
0080_create_annual_point_code_sequences.ts  Statements 100%  Branches 100%    Functions 100%  Lines 100%
monitoring-point-code.ts                    Statements 100%  Branches 88.23%  Functions 100%  Lines 100%
```

Checks:

- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- ESLint `--quiet` เฉพาะไฟล์ที่เกี่ยวข้อง — PASS, ไม่พบ error.
- `npm audit --omit=dev --offline` — PASS, ไม่พบ vulnerability จาก lockfile; การตรวจแบบออนไลน์ไม่สำเร็จเพราะ sandbox ไม่มี network.
- ชุดทดสอบกว้างโดยยกเว้น `officer-notification-email-recipients.route.test.ts` ซึ่งต้องเชื่อมฐานข้อมูลภายใน — `86` suites และ `771` tests ผ่านทั้งหมด.
- ชุดทดสอบแบบไม่ยกเว้นมีเพียง suite ดังกล่าวที่ timeout ระหว่างเชื่อม `172.16.31.184:1433`; ไม่เกี่ยวกับ point-code implementation.

## Merge Evidence

- Annual point-code RED checkpoints หลัง rebase: `5103d8f`, `f739221`.
- Annual point-code GREEN implementation หลัง rebase: `38f51aa`.
- Reverse-proxy RED checkpoint: `3fd9c73`.
- Reverse-proxy GREEN implementation: `02a315b`.
