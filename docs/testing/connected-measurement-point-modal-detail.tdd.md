# Connected Measurement Point Modal Detail TDD Evidence

## Source plan

Journeys were derived during this TDD run from the request to support the "รายละเอียดจุดตรวจวัด" button with only these fields:

- รหัสจุดตรวจวัด
- ชื่อจุดตรวจวัด
- ประเภทจุดตรวจวัด
- รายละเอียดพารามิเตอร์

## User journey

As an officer viewing a factory's connected measurement points, I want a narrow detail endpoint for one selected point, so that the modal table can display only the point code, point name, point type, and parameter details.

## Task report

| Task | Summary | Validation command | Evidence |
| --- | --- | --- | --- |
| RED | Added a route test for `GET /api/v1/connected-measurement-points/S0001` expecting only modal fields before implementation existed. | `npm test -- --runInBand tests/unit/connected-measurement-points.route.test.ts` | Failed with `TS2551: Property 'getConnectedMeasurementPointDetail' does not exist` |
| GREEN | Added the service/controller/route contract and normalized missing point code to `null`. | `npm test -- --runInBand tests/unit/connected-measurement-points.route.test.ts` | `Test Suites: 1 passed, 1 total`; `Tests: 9 passed, 9 total` |
| Verification | Ran backend typecheck, build, lint, full tests, and full coverage. | `npm run typecheck`; `npm run build`; `npm run lint`; `npm test -- --runInBand`; `npm run test:coverage -- --runInBand` | Typecheck/build passed; lint passed with existing warnings; full tests passed `40 passed, 40 total`, `364 passed`; full coverage passed with `All files` statements `46.55%` |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | The selected connected measurement point has a direct modal detail route. | `backend/tests/unit/connected-measurement-points.route.test.ts` | route/unit | PASS | `GET /api/v1/connected-measurement-points/S0001` returns `200` |
| 2 | The modal detail route calls the backend service with `stationId`, actor user id, and permission scope. | `backend/tests/unit/connected-measurement-points.route.test.ts` | route/unit | PASS | Service called with `'S0001', 42, 'ALL'` |
| 3 | The response contains only `success` and `data`, and `data` contains only `pointCode`, `pointName`, `pointType`, and `parameterDetails`. | `backend/tests/unit/connected-measurement-points.route.test.ts` | route/unit | PASS | Exact body equality assertion |

## Coverage and known gaps

- Full coverage command passed, but global coverage remains below the ECC 80% target because this repository's current full-suite coverage is `46.55%` statements and no coverage threshold is enforced.
- The route test mocks the service layer; repository/database behavior is covered indirectly through existing connected measurement point service tests and route contracts, not by a new integration DB test for this endpoint.

## Merge evidence

- RED: compile-time failure from the missing `getConnectedMeasurementPointDetail` service method.
- GREEN: focused route test passed after adding the endpoint.
- Verification: backend typecheck, build, lint, full test suite, and full coverage command completed successfully.
