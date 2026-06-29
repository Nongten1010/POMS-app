# TDD Evidence: Connection Request Timeout Auto-Cancel

## Source Plan

No external plan file was used. The user clarified the backend rule interactively:
`WAITING_CONNECTION` has one 30-day deadline from the first waiting state,
`RETURN_TO_WAITING_CONNECTION` must not reset that deadline, and expired waiting
requests must become `CANCELED` automatically.

## User Journeys

- As an operator, I want the 30-day connection window to be counted from the first
  `WAITING_CONNECTION`, so that officer return cycles do not extend the deadline.
- As an officer, I want returning an already-expired confirmed request to cancel it
  immediately, so that expired requests do not briefly reopen.
- As the backend, I want expired `WAITING_CONNECTION` requests to move to
  `CANCELED` without a public manual action.

## Task Report

### RED

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts
```

Result excerpt:

```text
FAIL tests/unit/connection-requests.service.test.ts
TS2339: Property 'autoCancelExpiredWaitingConnectionRequests' does not exist
TS2339: Property 'autoCancelExpiredWaitingConnections' does not exist
```

The RED state proved the timeout auto-cancel behavior and service/repository
contract did not exist yet.

### GREEN

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.repository.test.ts
```

Result excerpt:

```text
Test Suites: 2 passed, 2 total
Tests:       58 passed, 58 total
```

The GREEN state proves `RETURN_TO_WAITING_CONNECTION` preserves the original
deadline, expired returns become `CANCELED`, and the backend auto-cancel service
delegates expired waiting cancellation to the repository.

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | `RETURN_TO_WAITING_CONNECTION` keeps the original `connectionDueAt` and clears `confirmedAt` | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...service.test.ts` |
| 2 | Returning after the original deadline changes the request to `CANCELED` immediately | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...service.test.ts` |
| 3 | Expired waiting requests are auto-canceled through the backend service/repository contract | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...service.test.ts` |
| 4 | Existing repository timeline and status behavior remain green | `backend/tests/unit/connection-requests.repository.test.ts` | Unit | PASS | `npm test -- --runTestsByPath ...repository.test.ts` |

## Coverage And Known Gaps

Scoped coverage was not run separately for this report. The final verification
for this change used the backend typecheck, targeted Jest tests, full Jest suite,
and backend build. Browser E2E was not added because the requested change is
backend-only and does not alter frontend behavior.

Known gap: the auto-cancel worker runs inside the backend process every minute.
It is covered through the service contract, not through a timer-based integration
test.

## Merge Evidence

- RED checkpoint commit: `test: add connection timeout auto-cancel coverage`
- GREEN checkpoint commit: `fix: auto-cancel expired connection requests`
