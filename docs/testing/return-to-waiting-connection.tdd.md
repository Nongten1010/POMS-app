# TDD Evidence: Return Confirmed Connection To Waiting

## Source Plan

No external plan file was used. The user requested implementing a backend/API flow where an officer can send a `CONNECTION_CONFIRMED` request back to `WAITING_CONNECTION` so the operator can revise device connection config and confirm again.

## User Journey

As an officer, I want to return a confirmed connection request to `WAITING_CONNECTION` with a reason, so that the operator can fix device config and submit confirmation again without creating a new request.

## Task Report

### RED

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.validator.test.ts tests/unit/connection-requests.service.test.ts
```

Result excerpt:

```text
FAIL tests/unit/connection-requests.validator.test.ts
Expected: true
Received: false

FAIL tests/unit/connection-requests.service.test.ts
BadRequestError: Invalid connection request status for this action
```

The RED state proved the API validator did not accept `RETURN_TO_WAITING_CONNECTION` and the service still routed the action through the design-review-only status path.

### GREEN

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.validator.test.ts tests/unit/connection-requests.service.test.ts
```

Result excerpt:

```text
Test Suites: 2 passed, 2 total
Tests:       79 passed, 79 total
```

The GREEN state proved the original action behavior at the time of that change. The timeout rule was later tightened: `RETURN_TO_WAITING_CONNECTION` now preserves the original `connectionDueAt` instead of setting a fresh 30-day due date, and cancels immediately when that original deadline has already passed. See `docs/testing/connection-request-timeout-auto-cancel.tdd.md`.

### Integration

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.status.route.test.ts
```

Result excerpt:

```text
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

The integration route test proves `POST /api/v1/cems-wpms-requests/:id/status` accepts `RETURN_TO_WAITING_CONNECTION`, requires `revisionReason`, checks the officer approval permission, and forwards the parsed payload to the service.

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | `RETURN_TO_WAITING_CONNECTION` is accepted by the status-change schema when a revision reason is supplied | `backend/tests/unit/connection-requests.validator.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...` |
| 2 | A confirmed request can be returned to `WAITING_CONNECTION` by an officer action | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...` |
| 3 | Returning to waiting clears `confirmedAt`, stores the reason/note, and originally gave the operator a new 30-day due date; this guarantee is superseded by `docs/testing/connection-request-timeout-auto-cancel.tdd.md` | `backend/tests/unit/connection-requests.service.test.ts` | Unit | SUPERSEDED | `npm test -- --runTestsByPath ...` |
| 4 | Returning to waiting is rejected from statuses other than `CONNECTION_CONFIRMED` | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...` |
| 5 | Returning to waiting skips point-code and duplicate-point side effects so existing point codes/config snapshots can be revised in place | `backend/tests/unit/connection-requests.repository.test.ts` and `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...` |
| 6 | The status endpoint accepts the new action and rejects it without `revisionReason` | `backend/tests/unit/connection-requests.status.route.test.ts` | Integration | PASS | `npm test -- --runTestsByPath ...status.route.test.ts` |
| 7 | TypeScript types remain valid after adding the action to the API contract | `npm run typecheck` | Static | PASS | `tsc --noEmit` |
| 8 | The full backend unit suite remains green after the status transition change | `npm test` | Regression | PASS | `35 passed, 324 passed` |

## Coverage And Known Gaps

Command:

```bash
cd backend
npm test -- --coverage --runTestsByPath tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.validator.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.status.route.test.ts
```

Result excerpt:

```text
Test Suites: 4 passed, 4 total
Tests:       92 passed, 92 total
connection-requests.repository.ts 23.24% statements
connection-requests.service.ts    89.48% statements
connection-requests.validator.ts  87.84% statements
connection-requests.routes.ts     87.80% statements
```

Known gap: this run intentionally used scoped coverage for the changed backend module and route tests. The global coverage percentage is low because Jest reported untouched files across the whole backend while only four test files were executed. Browser E2E was not added because the requested change is backend-only and no frontend behavior was changed.

## Merge Evidence

Checkpoint commits were not created because the working tree already contained unrelated modified files before this task. To avoid mixing user work into TDD checkpoints, this report preserves the RED/GREEN evidence instead.
