# TDD Evidence: Operator Cancel Connection Request

## Source Plan

ไม่ได้ใช้ plan file ภายนอก. User journeys และ acceptance decisions ได้จากการ grilling และบันทึกใน [`workflows/operator-cancel-connection-request.md`](../../workflows/operator-cancel-connection-request.md).

## User Journey

As a factory operator, I want to cancel my own non-terminal connection request from the connection-request page, so that I can end a request that should no longer continue while preserving an auditable history.

## Task Report

### RED

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.cancel.service.test.ts tests/unit/connection-requests.cancel.route.test.ts
```

Result excerpt:

```text
FAIL tests/unit/connection-requests.cancel.route.test.ts
TS2339: Property 'cancel' does not exist
FAIL tests/unit/connection-requests.cancel.service.test.ts
TS2339: Property 'cancelOperatorRequest' does not exist
Test Suites: 2 failed, 2 total
```

RED เป็น compile-time failure จาก cancel service/repository operations ที่ยังไม่มี ไม่ใช่ syntax, dependency หรือ test setup failure.

### GREEN

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.cancel.service.test.ts tests/unit/connection-requests.cancel.route.test.ts tests/unit/connection-requests.cancel.repository.test.ts
```

Result excerpt:

```text
Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total
```

GREEN ยืนยัน route/validation/permission, ownership and status rules, optional reason, idempotent retry และ repository transaction lock/history behavior.

### Static Verification

```text
npm run typecheck
> tsc --noEmit
PASS

npm run lint
0 errors, 152 warnings
```

Lint warnings เป็น baseline formatting/non-null warnings หลายโมดูล; ไม่มี lint error และไม่มี security warning ใหม่จาก cancel API.

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | ผู้ประกอบการที่มี permission เรียก `POST /:id/cancel` ได้โดยไม่ส่งเหตุผล | `backend/tests/unit/connection-requests.cancel.route.test.ts` | API integration | PASS |
| 2 | `reason` ถูก trim, ค่าว่างเป็น `null` และข้อความเกิน 1000 ตัวอักษรถูกปฏิเสธ | `backend/tests/unit/connection-requests.cancel.route.test.ts` | API integration | PASS |
| 3 | Endpoint บังคับ authentication และ `cems_wpms_requests:edit` | `backend/tests/unit/connection-requests.cancel.route.test.ts` | API integration | PASS |
| 4 | ยกเลิกได้ครบทั้งห้า non-terminal statuses ที่อนุมัติใน workflow | `backend/tests/unit/connection-requests.cancel.service.test.ts` | Unit | PASS |
| 5 | ผู้ใช้ยกเลิกคำขอของ operator คนอื่นไม่ได้ | `backend/tests/unit/connection-requests.cancel.service.test.ts` | Unit | PASS |
| 6 | `OFFICER_DIRECT_API` และ `CONNECTED` ถูกปฏิเสธด้วย conflict | `backend/tests/unit/connection-requests.cancel.service.test.ts` | Unit | PASS |
| 7 | Retry เมื่อเป็น `CANCELED` คืนข้อมูลเดิมและไม่เขียน history ซ้ำ | `backend/tests/unit/connection-requests.cancel.service.test.ts`, `backend/tests/unit/connection-requests.cancel.repository.test.ts` | Unit | PASS |
| 8 | Repository lock แถวก่อนตรวจสถานะและเขียน status/history ใน transaction เดียว | `backend/tests/unit/connection-requests.cancel.repository.test.ts` | Repository unit | PASS |
| 9 | หาก action คู่แข่งเปลี่ยนเป็น `CONNECTED` ก่อน cancel จะไม่เขียนข้อมูล | `backend/tests/unit/connection-requests.cancel.repository.test.ts` | Repository unit | PASS |

## Coverage And Known Gaps

Focused coverage command:

```bash
cd backend
npm test -- --coverage --runInBand --runTestsByPath \
  tests/unit/connection-requests.cancel.service.test.ts \
  tests/unit/connection-requests.cancel.route.test.ts \
  tests/unit/connection-requests.cancel.repository.test.ts \
  --coverageReporters=json
```

Result: 3 suites / 18 tests passed. Changed executable statement coverage computed from the GREEN commit diff and Jest statement map is `35/40 = 87.50%`, above the 80% requirement.

Full repository coverage was also attempted. Result: 70 suites passed and 1 unrelated suite failed; 677 tests passed and 3 tests in `officer-notification-email-recipients.route.test.ts` timed out while attempting the configured external MSSQL host. Global repository coverage reported `53.30%`, which is an existing project-wide gap outside this endpoint.

Browser E2E was not added because this task is backend-only and project rules prohibit editing frontend unless the user says `แก้ frontend ด้วย`.

`npm audit --omit=dev` reported one existing low-severity `body-parser` advisory. No dependency was added or changed in this task.

## Merge Evidence

- RED checkpoint: `36980c7 test: specify operator connection request cancellation`.
- GREEN checkpoint: `94b4f04 feat: add operator connection request cancellation API`.
- If checkpoint commits are squashed, copy the RED/GREEN summary and known full-suite failure into the PR body or squash commit body.
