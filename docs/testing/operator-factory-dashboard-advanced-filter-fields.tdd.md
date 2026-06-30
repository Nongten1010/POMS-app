# Operator Factory Dashboard Advanced Filter Fields TDD

## Source plan

Journeys were derived during this TDD run from the request to add advanced-search data directly to `GET /api/v1/operator-factory-dashboard`.

## User journeys

- As a frontend developer, I want each dashboard factory row to include factory type, region, province, district, industrial estate, EIA, and latest-measurement flags so that the map advanced-search modal can filter without calling the request-list search options API.
- As an API client, I want factory main type labels to come from the DIW factory class master so that dropdown labels can show the stable code plus official Thai description.

## Task report

| Task | RED evidence | GREEN evidence | Guarantee |
| --- | --- | --- | --- |
| Add dashboard filter fields to service response | `npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.repository.test.ts` failed because `FactorySummaryDTO` did not have `hasEia`, repository did not have `listFactoryMainTypeLabels`, and repository SQL did not join `industrial_estates`. | `npm test -- --runTestsByPath tests/unit/connection-requests.operator-factories.route.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.repository.test.ts` passed, 3 suites / 66 tests. | Dashboard rows now expose factory type, EIA, region/province, industrial area, industrial estate, and latest hourly measurement flags. |
| Select location/industrial-estate source fields | Repository SQL test failed before implementation because it did not include `industrial_estates`, `province_id`, `province_region`, or estate columns. | Same GREEN command passed. | `listFactoriesForAccess` selects the source fields required by the dashboard filters. |
| Resolve factory main type labels | Service test failed before implementation because `listFactoryMainTypeLabels` was missing. | Same GREEN command passed. | Dashboard response can enrich `industryMainOrderLabel` from DIW `dbo.TCLASS` and falls back safely when unavailable. |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Dashboard HTTP response includes advanced filter fields without changing the endpoint envelope. | `tests/unit/connection-requests.operator-factories.route.test.ts` | Route/unit | PASS | `npm test -- --runTestsByPath tests/unit/connection-requests.operator-factories.route.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.repository.test.ts` |
| 2 | Service maps factory summary source data to dashboard response fields and computes `hasLatestHourlyMeasurement` from populated measurement data. | `tests/unit/connection-requests.service.test.ts` | Service/unit | PASS | Same command |
| 3 | Repository query includes province region/code and industrial estate code/name for dashboard filtering. | `tests/unit/connection-requests.repository.test.ts` | Repository/unit | PASS | Same command |

## Coverage and known gaps

- Targeted tests were run for route, service, and repository behavior.
- Coverage command run: `npm run test:coverage -- --runTestsByPath tests/unit/connection-requests.operator-factories.route.test.ts tests/unit/connection-requests.service.test.ts tests/unit/connection-requests.repository.test.ts`.
- Coverage command result: PASS, 3 suites / 66 tests. The global coverage percentage in this targeted run is low because Jest includes all backend source files in the coverage denominator while only the dashboard-related test paths were executed.
- `districtCode` and `districtName` intentionally return `null` for this dashboard endpoint until a trusted district source is added; current dashboard source only has free-text address.
