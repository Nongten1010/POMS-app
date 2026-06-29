# Waiting Connection Countdown TDD Evidence

## Source Plan

No separate plan file was provided. The user requested that
`GET /api/v1/cems-wpms-requests/table-rows` include a display-ready waiting
connection countdown such as `รอเชื่อมต่อ 30 วัน` or `รอเชื่อมต่อ 18 วัน`.

## User Journey

As an officer or operator viewing the connection request table, I want each
`WAITING_CONNECTION` row to include the remaining waiting-connection days, so
that the UI can show a clear label without changing the existing status field.

## Task Report

| Task | RED evidence | GREEN evidence | Guarantee |
| --- | --- | --- | --- |
| Add countdown fields to table rows | `cd backend && npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts --runInBand` failed because the row lacked `connectionDueAt`, `waitingConnectionDaysRemaining`, and `waitingConnectionText`. | The same command passed with `48 passed, 48 total`. | `WAITING_CONNECTION` rows include the due timestamp, numeric days remaining, and Thai display text. Non-waiting rows return `null` for those fields. |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | A waiting connection row with `connectionDueAt = 2026-06-26T10:00:00.000Z` and server clock `2026-06-08T10:00:00.000Z` returns `waitingConnectionDaysRemaining = 18` and `waitingConnectionText = รอเชื่อมต่อ 18 วัน`. | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts --runInBand` |
| 2 | A non-waiting row does not expose countdown fields even if `connectionDueAt` exists on the request DTO. | `backend/tests/unit/connection-requests.service.test.ts` | Unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts --runInBand` |
| 3 | Route-level mocks that use `ConnectionRequestTableRowDTO` include the new nullable fields for non-waiting rows. | `backend/tests/unit/connected-measurement-points.route.test.ts` | Unit | PASS | `npm test -- --runTestsByPath tests/unit/connected-measurement-points.route.test.ts --runInBand` |
| 4 | The backend unit suite still passes with coverage enabled after the response contract update. | `backend` | Coverage | PASS | `npm test -- --coverage --runInBand` passed with `35 passed, 35 total` suites and `326 passed, 326 total` tests. |

## Coverage And Known Gaps

Targeted unit coverage was run for the service mapper, and the full backend unit
suite passed with coverage enabled. No frontend E2E test was added because the
requested scope is backend response contract first.
