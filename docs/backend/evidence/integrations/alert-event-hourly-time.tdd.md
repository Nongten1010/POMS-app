# TDD Evidence: สัญญาเวลารายชั่วโมงของ Integration Alert Events

เอกสารนี้สนับสนุน [Integration Alert Events contract](../../api/integrations/alert-events/README.md) และไม่ใช้แทน canonical API contract

## Source

- ไม่มี plan file
- User journey มาจากคำขอให้ระบบต้นทางส่งเฉพาะเวลาของชั่วโมงที่พบค่าเกิน โดยไม่ต้องสร้าง `startTime` และ `endTime`

## User Journey

ในฐานะ Worker ที่ตรวจค่ารายชั่วโมง ต้องการส่ง `eventDate` และเวลาเริ่มชั่วโมงเพียงค่าเดียว เพื่อให้ backend สร้างช่วงเต็มชั่วโมงและใช้กันเหตุการณ์ซ้ำอย่างสม่ำเสมอ

## RED

แก้ route integration tests ให้ request ใช้ `time`, เพิ่มกรณีปฏิเสธเวลาที่ไม่ตรงต้นชั่วโมง และปฏิเสธ field เดิม ก่อนแก้ production validator

```bash
cd backend
npm test -- --runInBand tests/unit/alert-events.route.test.ts
```

Result:

- `1` suite failed
- `5` tests failed และ `10` tests passed
- happy-path requests ตอบ `400` เพราะ validator ยังบังคับ `startTime` และ `endTime`
- RED checkpoint: `985e3f3 test: define hourly alert event time contract`

## GREEN

เปลี่ยน strict Zod schema ให้รับ `time` รูปแบบ `HH:00` และ derive `startedAt`/`endedAt` ใน timezone `+07:00`

```bash
cd backend
npm test -- --runInBand tests/unit/alert-events.route.test.ts
```

Result:

- `1` suite passed
- `15` tests passed
- GREEN checkpoint: `462c2d1 fix: accept hourly alert event time`

หลัง GREEN เพิ่ม edge cases สำหรับ `EIA`, `pointCode=null` และ inverted list date range แล้ว rerun targeted coverage:

```bash
cd backend
npm run test:coverage -- --runInBand \
  tests/unit/alert-events.route.test.ts \
  --collectCoverageFrom=src/modules/alert-events/alert-events.validator.ts
```

Result:

- `1` suite passed
- `16` tests passed
- `alert-events.validator.ts`: statements `96.15%`, branches `100%`, functions `85.71%`, lines `96.15%`

## Test Specification

| # | What is guaranteed | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | `time=20:00` สร้าง `startedAt=20:00:00+07:00` และ `endedAt=20:59:59+07:00` | `alert-events.route.test.ts: creates a single external exceeded alert event through the unified events array` | Route integration | PASS |
| 2 | `time` ที่ไม่ตรงต้นชั่วโมง เช่น `20:30` ถูกปฏิเสธด้วย `400 VALIDATION_ERROR` | `alert-events.route.test.ts: rejects alert event times that are not aligned to the start of an hour` | Route integration | PASS |
| 3 | `startTime` และ `endTime` ถูกปฏิเสธโดย strict request schema | `alert-events.route.test.ts: rejects legacy startTime and endTime fields` | Route integration | PASS |
| 4 | ทุก item ใน batch ผ่าน validation ก่อนเริ่มประมวลผล | `alert-events.route.test.ts: rejects invalid items in alert event batch requests before processing` | Route integration | PASS |
| 5 | annual monitoring-point code, `pointCode=null` และ `thresholdType=EIA` derive ค่าได้ถูกต้อง | `alert-events.route.test.ts: accepts an EIA alert for an annual monitoring point without pointCode` | Route integration | PASS |
| 6 | API key แบบ alert-event scope ใช้ได้และ device-config scope ใช้ไม่ได้ | `alert-events.route.test.ts: accepts alert event scoped API keys`, `rejects device config scoped API keys for alert event endpoints` | Security integration | PASS |

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | PASS |
| TypeScript | `npm run typecheck` | PASS |
| ESLint | `npm run lint` | PASS with `152` existing warnings and `0` errors |
| Targeted tests and coverage | command above | PASS, `16/16` tests; changed-validator coverage above 80% ทุก metric |
| Full suite | `npm test -- --runInBand` | `98/99` suites และ `854/857` tests passed; unrelated recipient suite 3 tests timeout ขณะเชื่อม `172.16.31.184:1433` |
| Regression suite without external-DB test | `npm test -- --runInBand --testPathIgnorePatterns=officer-notification-email-recipients.route.test.ts` | PASS, `98/98` suites และ `854/854` tests |

## Security Review

- Request ใช้ strict Zod schema, whitelist enum และรูปแบบ `HH:00`; unknown fields ถูกปฏิเสธ
- Endpoint ยังใช้ `authenticateAlertEventApiKey` ซึ่งเปรียบเทียบ key ด้วย `timingSafeEqual`
- Application จำกัด JSON body ที่ `1mb` และมี global rate limit `300` requests ต่อ `15` นาที
- Query/database access ที่เกี่ยวข้องยังผ่าน Knex query builder ไม่มีการต่อ SQL จาก `time`
- Diff ไม่มี secret, API key จริง หรือ logging ของ `X-API-Key`
- `npm audit --audit-level=high` พบ dependency เดิม `brace-expansion` ระดับ high และ `body-parser` ระดับ low; ไม่แก้ lockfile ในงานนี้เพราะเป็น dependency-maintenance scope แยกต่างหาก

## Known Gaps

- ไม่เพิ่ม browser E2E เพราะ endpoint นี้เป็น server-to-server integration API และไม่มีการแก้ frontend
- Full suite ยังขึ้นกับ SQL Server ภายในสำหรับ `officer-notification-email-recipients.route.test.ts`; failure เดิมไม่แตะ alert-event code path
- การลบ `startTime`/`endTime` เป็น breaking change บน `/api/v1` ตาม requirement ที่ยืนยันแล้ว จึงบันทึก migration ไว้ใน [API breaking-change log](../../api/CHANGELOG.md)

## Merge Evidence

- RED: `985e3f3`
- GREEN: `462c2d1`
- หาก squash commits ให้คัดลอก RED/GREEN และ coverage summary จากเอกสารนี้ไปยัง PR body หรือ squash commit body
