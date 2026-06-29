# Connection Request Status Timeline TDD Evidence

## Source plan

Journeys were derived during this TDD run from the approved response contract:

- `changedBy` must be a display name, while the original id remains available as `changedById`.
- Status durations count inclusive calendar dates from one status timestamp to the next.
- Total duration counts from the first status date to the latest terminal status date.
- Terminal statuses are `CONNECTED` and `CANCELED`.
- Non-terminal latest statuses do not close total duration.

## User journeys

- As an API client, I want status history actors as names, so that the UI can display readable timeline entries.
- As an API client, I want each status row to include day duration, so that the UI can show how many calendar days that step took.
- As an API client, I want summary duration only when the request is finished or canceled, so that incomplete workflows are not reported as complete.

## Task report

| Behavior | RED evidence | GREEN evidence | Guarantee |
| --- | --- | --- | --- |
| Status timeline exposes actor names, per-status durations, and terminal summary | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts` failed with missing `buildStatusHistoryTimelineForTests` and missing `CANCELED` enum | Same command passed: 8 tests | Repository timeline logic maps actor display names, inclusive date durations, and summary fields |
| DTO contract remains compatible with service and route tests | Full `npm test` initially failed because a route fixture was missing `statusDurationSummary` | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connected-measurement-points.route.test.ts` passed: 59 tests | Fixtures and typed DTO consumers use the new response shape |
| Backend suite remains green | Not applicable after GREEN target | `npm test` passed: 34 suites, 317 tests | Existing backend behavior still passes with the updated response contract |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | `changedBy` falls back from full name to username to `User #<id>` while preserving `changedById` | `tests/unit/connection-requests.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts` |
| 2 | `2026-06-26` to `2026-06-27` counts as `2 วัน` in the summary | `tests/unit/connection-requests.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts` |
| 3 | `CONNECTED` closes the timeline and populates total duration | `tests/unit/connection-requests.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts` |
| 4 | `CANCELED` closes the timeline and populates total duration | `tests/unit/connection-requests.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts` |
| 5 | Non-terminal latest statuses keep completion fields null | `tests/unit/connection-requests.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts` |

## Coverage and known gaps

- `npm run test:coverage` passed.
- Global coverage reported by Jest is currently `46.47%` statements, `43.34%` branches, `49.92%` functions, and `48.19%` lines because the repo coverage command includes broad untested surfaces such as migrations and repositories.
- This task added focused unit coverage for the new timeline response logic, but did not add an API route E2E test because the response mapping lives in repository hydration.

## Merge evidence

- RED: missing helper and missing `CANCELED` enum caused the new repository tests to fail before production code changes.
- GREEN: repository timeline tests, targeted service/route tests, full backend tests, and typecheck pass.
