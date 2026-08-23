# TDD Evidence: Test Mode ของ Device Config Channel

เอกสารนี้สนับสนุน [Device Config ภายใน](../../api/menus/connection-requests/device-configs.md) และ [Integration Device Config](../../api/integrations/device-configs/README.md) โดยไม่ใช้แทน canonical API contract

## Contract Decision

- request ใช้ชื่อ field แบบ camelCase คือ `channels[].testMode`
- รับ JSON boolean `true` หรือ `false`; เมื่อไม่ส่งหรือส่ง `null` backend normalize เป็น `false`
- response ภายในและ `parameterConfigs[].testMode` ของ Integration API คืน boolean เสมอ
- persistence ใช้ `device_measurement_channels.test_mode` แบบ non-null และ default `false`
- เป็น additive change; ไม่ลบหรือเปลี่ยนความหมายของ field เดิม

## User Journeys

1. เจ้าหน้าที่ตั้ง Test Mode แยกในแต่ละพารามิเตอร์ของ device config ได้
2. config เดิมที่ยังไม่มีค่า Test Mode ยังอ่านได้โดยได้ `false`
3. Worker ที่เรียก `GET /api/v1/integrations/device-configs/:stationId` อ่าน `parameterConfigs[].testMode` เพื่อแยก channel ทดสอบจาก channel ปกติได้
4. OpenAPI และเอกสาร canonical แสดง request/response contract เดียวกับ runtime

## RED

Targeted contract tests ก่อนเพิ่ม OpenAPI schema:

```bash
cd backend
npm test -- --runInBand \
  tests/unit/device-connections.validator.test.ts \
  tests/unit/device-connections.repository.test.ts \
  tests/unit/connection-requests.service.test.ts \
  tests/unit/integration-device-configs.service.test.ts \
  tests/unit/integration-device-configs.route.test.ts \
  tests/unit/api-docs.openapi.test.ts
```

- `5` suites ผ่าน และ `1` suite ล้ม
- `213` tests ผ่าน และ `1` test ล้ม
- failure ยืนยันว่า OpenAPI ยังไม่มี `testMode` และยังไม่ผูก Integration response กับ schema ที่ระบุ field นี้

Migration test ก่อนสร้าง migration:

```bash
cd backend
npm test -- --runInBand \
  tests/unit/device-measurement-channel-test-mode-migration.test.ts
```

- compile-time RED เพราะยังไม่มี `0099_add_test_mode_to_device_measurement_channels`

ไม่ได้แยก RED/GREEN เป็นคนละ commit เพราะการทดลองเริ่มใน worktree ที่มีการแก้ไขอื่นอยู่แล้ว จากนั้นจึงย้ายเฉพาะ release scope มายัง worktree สะอาดก่อนส่งมอบ

## GREEN

```bash
cd backend
npm test -- --runInBand \
  tests/unit/device-measurement-channel-test-mode-migration.test.ts \
  tests/unit/device-connections.validator.test.ts \
  tests/unit/device-connections.repository.test.ts \
  tests/unit/connection-requests.service.test.ts \
  tests/unit/integration-device-configs.service.test.ts \
  tests/unit/integration-device-configs.route.test.ts \
  tests/unit/api-docs.openapi.test.ts
```

Result:

```text
Test Suites: 7 passed, 7 total
Tests:       221 passed, 221 total
```

## Test Specification

| Behavior                                   | Test target                                              | Guarantee                                                                                         |
| ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| รับเฉพาะ boolean และ default เป็น `false`  | `device-connections.validator.test.ts`                   | string เช่น `"true"` ถูกปฏิเสธ; omitted/null normalize เป็น `false`                               |
| เพิ่มและ rollback คอลัมน์ได้แบบ idempotent | `device-measurement-channel-test-mode-migration.test.ts` | `test_mode` เป็น non-null/default false และ up/down ข้ามได้เมื่อ schema อยู่ในสถานะปลายทางแล้ว    |
| บันทึกและอ่านค่าจากฐานข้อมูล               | `device-connections.repository.test.ts`                  | explicit `true` และ omitted `false` ถูก insert; ค่า BIT/boolean ถูก hydrate เป็น boolean          |
| response สำหรับหน้าตั้งค่าคืนค่าเดิม       | `connection-requests.service.test.ts`                    | ทั้ง `parameterMappings[]` และ `rawConfigs.channels[]` คืน `testMode`                             |
| Worker API คืน flag ต่อพารามิเตอร์         | integration service/route tests                          | `parameterConfigs[].testMode` ผ่าน HTTP response ที่ใช้ `X-API-Key`; ค่าที่ไม่มีข้อมูลคืน `false` |
| machine-readable contract ตรง runtime      | `api-docs.openapi.test.ts`                               | request channel schemas และ Integration response schema ระบุ `testMode` ครบ                       |

## Verification And Coverage

- `npm run typecheck`: PASS
- `npm run build`: PASS
- full suite: `137` suites ผ่าน, `1,445` tests ผ่าน, ไม่มี failed test
- repository-wide lint: exit `0`, ไม่มี error; มี formatting warnings เดิม/นอกขอบเขต `315` รายการ
- targeted suite `7` suites และ `221` tests ผ่านครบใน release worktree เดียวกัน
- เส้นทาง feature ที่เกี่ยวข้องครอบคลุม validator, repository, migration, service, route และ runtime OpenAPI contract

## Security Review

- ไม่เพิ่ม endpoint หรือ authentication surface ใหม่; Integration endpoint ยังบังคับ `X-API-Key`
- response ยังคงใช้ `Cache-Control: no-store`
- ไม่เพิ่ม secret, credential หรือ logging ของ request/response
- `testMode` เป็น boolean ที่ validator ตรวจชนิดก่อนถึง persistence boundary

## Known Gaps

- ไม่แก้ `frontend/` ตามขอบเขต API งานนี้ ปัจจุบัน UI มี switch แล้ว แต่ `buildDeviceConfigChannels()` ยังไม่ได้ใส่ `testMode` ใน request payload จึงต้องแก้ frontend แยกต่างหากก่อนค่าจากหน้าจอจะถูกส่งจริง
- การตรวจ local ไม่ได้รัน migration กับฐานข้อมูลจริง; production pipeline ต้องรัน migration `0099` ก่อนเปิดใช้ backend version นี้
- API ส่งต่อสถานะ Test Mode เท่านั้น ส่วนนโยบายว่า Worker จะเก็บค่า สร้าง Alert หรือข้ามการประมวลผลอย่างไรอยู่นอก contract นี้
