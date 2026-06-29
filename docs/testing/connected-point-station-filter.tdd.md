# Connected Point Station Filter TDD Evidence

## Source Plan

No plan file was provided. The journey was derived from the reported bug: opening details for connected measurement point `S0001` should not show requests for a different station such as `S0002` just because both points share the same display name.

## User Journey

As an officer viewing a connected measurement point, I want `GET /api/v1/connected-measurement-points/:stationId/requests` to return only requests that are tied to that station identity, so duplicate point names do not show the wrong request history.

## Task Report

The station history query no longer links request measurement points to connected measurement points by `point_name` alone. It still supports stable links through matching `point_code` and `source_measurement_point_id`.

RED evidence:

```text
npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts --runInBand
FAIL tests/unit/connection-requests.repository.test.ts
Expected substring: not "mp.point_name = cmp.point_name"
```

GREEN evidence:

```text
npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts --runInBand
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

Regression evidence:

```text
npm test -- --runTestsByPath tests/unit/connected-measurement-points.route.test.ts --runInBand
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total

npm test -- --runInBand
Test Suites: 34 passed, 34 total
Tests:       314 passed, 314 total

npm run typecheck
tsc --noEmit
```

Live DB verification through the repository after the fix:

```json
{
  "total": 1,
  "requestNos": ["CEMS-69-00001"]
}
```

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | Station history SQL does not link requests by duplicate point names alone | `backend/tests/unit/connection-requests.repository.test.ts` | unit | PASS | `does not link selected station history by duplicate measurement point names alone` |
| 2 | Existing connected point route behavior still delegates with `{ stationId: 'S0001' }` | `backend/tests/unit/connected-measurement-points.route.test.ts` | route unit | PASS | `exposes request details for a selected connected measurement point` |
| 3 | Current DB-backed repository result for `S0001` returns only `CEMS-69-00001` | `connectionRequestsRepository.list({ stationId: 'S0001' })` | live DB verification | PASS | `total: 1`, `requestNos: ["CEMS-69-00001"]` |

## Coverage And Known Gaps

Scoped coverage command:

```text
npm test -- --coverage --runTestsByPath tests/unit/connection-requests.repository.test.ts --runInBand
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

The scoped coverage report shows low global percentages because Jest includes every backend source file while running only the focused repository test. Full backend tests pass, but no browser E2E was added because the bug is in the backend request-selection query and the frontend already renders all rows returned by the API.
