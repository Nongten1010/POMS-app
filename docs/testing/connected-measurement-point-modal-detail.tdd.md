# Connected Measurement Point Modal Detail TDD Evidence

## Source plan

Journeys were derived during this TDD run from the request to support the "รายละเอียดจุดตรวจวัด" button with only these fields:

- รหัสจุดตรวจวัด
- ชื่อจุดตรวจวัด
- ประเภทจุดตรวจวัด
- รายละเอียดพารามิเตอร์

## User journey

As an officer viewing a factory's connected measurement points, I want a narrow factory-scoped detail endpoint, so that the modal table can display only the point code, point name, point type, and parameter details for every connected point in that factory.

## Task report

| Task | Summary | Validation command | Evidence |
| --- | --- | --- | --- |
| RED | Added a route test for `GET /api/v1/connected-measurement-points/factories/factory-001` expecting factory-scoped modal rows before implementation existed. | `npm test -- --runInBand tests/unit/connected-measurement-points.route.test.ts` | Failed with `TS2551: Property 'getConnectedMeasurementPointDetailsByFactory' does not exist` |
| GREEN | Added the service/controller/route contract, reused the existing connected-point factory filter, and returned a narrow `data[]` plus `meta.total` response. | `npm test -- --runInBand tests/unit/connected-measurement-points.route.test.ts`; `npm test -- --runInBand tests/unit/connection-requests.service.test.ts` | Route suite passed `9 passed, 9 total`; service suite passed `51 passed, 51 total` |
| Verification | Ran backend typecheck and the focused connected measurement point route/service tests after switching the modal route from `stationId` to `factoryId`. | `npm run typecheck`; `npm test -- --runInBand tests/unit/connected-measurement-points.route.test.ts`; `npm test -- --runInBand tests/unit/connection-requests.service.test.ts` | Typecheck passed; focused route suite passed `9 passed, 9 total`; focused service suite passed `51 passed, 51 total` |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | The factory-scoped connected measurement point modal route is exposed. | `backend/tests/unit/connected-measurement-points.route.test.ts` | route/unit | PASS | `GET /api/v1/connected-measurement-points/factories/factory-001` returns `200` |
| 2 | The modal detail route calls the backend service with `factoryId`, actor user id, and permission scope. | `backend/tests/unit/connected-measurement-points.route.test.ts` | route/unit | PASS | Service called with `'factory-001', 42, 'ALL'` |
| 3 | The service returns all connected measurement point rows for the requested factory. | `backend/tests/unit/connection-requests.service.test.ts` | service/unit | PASS | A factory with `STACK-A` and `WWTP-1` returns two modal rows and `meta.total: 2` |
| 4 | The response contains only `success`, `data`, and `meta`; each `data[]` row contains only `pointCode`, `pointName`, `pointType`, and `parameterDetails`. | `backend/tests/unit/connected-measurement-points.route.test.ts`; `backend/tests/unit/connection-requests.service.test.ts` | route/unit + service/unit | PASS | Exact body equality assertion |

## Coverage and known gaps

- The focused route and service suites passed for this change. Full coverage was not rerun in this factoryId rename cycle.
- The previous full coverage run showed global coverage below the ECC 80% target because this repository's current full-suite coverage was `46.55%` statements and no coverage threshold was enforced.
- The route test mocks the service layer; repository/database behavior is covered indirectly through existing connected measurement point service tests and route contracts, not by a new integration DB test for this endpoint.

## Merge evidence

- RED: compile-time failure from the missing `getConnectedMeasurementPointDetailsByFactory` service method.
- GREEN: focused route test passed after adding the factory-scoped endpoint.
- Verification: backend typecheck and the focused connected measurement point route/service tests completed successfully.
