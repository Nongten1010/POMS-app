# BOD/COD Deviation Report APIs TDD Evidence

## Source Plan

Journeys were derived from the user request in this session. No `*.plan.md` file was used.

## User Journeys

- As a factory operator, I want to see only my own connected POMS factories in the BOD/COD deviation report page so that I can select the correct factory for reporting.
- As a factory operator, I want to see my BOD/COD deviation report requests so that I can track submitted reports.
- As an officer, I want to see BOD/COD deviation report requests according to my menu/data permission so that I review only permitted records.

## Task Report

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| New BOD/COD routes exist and require `bod_cod_errors:view` | `npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts` failed with TS2307 missing module errors | Same command passed: 2 suites, 7 tests | Unauthorized users get 403 and authorized users receive the expected table envelope |
| Operator factory access is scoped to own connected factories | Same RED run failed before module existed; later contract-change RED showed SQL still started from `factories` | Repository SQL test passed | Factory table query starts from `cems_wpms_connected_measurement_points` and joins `user_juristics` for `OWN_FACTORY` scope |
| Officer request access follows region constraints | Same RED run failed before module existed | Repository SQL test passed | Request table query applies `regionalAccess.regions` through `provinces.region` |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Operator factory table calls service with `OWN_FACTORY` scope and returns connected factory rows with measurement points and report slots | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | `npm test -- --runTestsByPath ...` |
| 2 | Officer request table calls service with `bod_cod_errors:view` scope and regional access | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | `npm test -- --runTestsByPath ...` |
| 3 | Missing `bod_cod_errors:view` permission is rejected | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | security | PASS | `npm test -- --runTestsByPath ...` |
| 4 | Operator factory SQL starts from connected measurement points and is limited through `user_juristics` | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository | PASS | `npm test -- --runTestsByPath ...` |
| 5 | Officer request SQL filters by `regionalAccess.regions` | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository | PASS | `npm test -- --runTestsByPath ...` |

## Coverage And Known Gaps

Targeted test command passed. Full coverage is verified separately by the final verification loop. This first API slice includes list endpoints and base tables; create/update/approval endpoints are intentionally not implemented in this change.
