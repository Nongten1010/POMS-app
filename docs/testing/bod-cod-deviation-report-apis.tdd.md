# BOD/COD Deviation Report APIs TDD Evidence

## Source Plan

Journeys were derived from the user request in this session. No `*.plan.md` file was used.

## User Journeys

- As a factory operator, I want to see only my own connected POMS factories in the BOD/COD deviation report page so that I can select the correct factory for reporting.
- As a factory operator, I want to save the BOD/COD deviation form so that the submitted paper-form data is stored with the correct approval steps.
- As a factory operator or officer, I want to reopen a saved BOD/COD deviation form so that the exact submitted values and current workflow state are visible.
- As a factory operator, I want to see my BOD/COD deviation report requests so that I can track submitted reports.
- As an officer, I want to see BOD/COD deviation report requests according to my menu/data permission so that I review only permitted records.

## Task Report

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| New BOD/COD routes exist and require `bod_cod_errors:view` | `npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts` failed with TS2307 missing module errors | Same command passed: 2 suites, 13 tests | Unauthorized users get 403 and authorized users receive the expected table envelope |
| Save BOD/COD deviation form route exists and requires `bod_cod_errors:edit` | Route test failed with TS2339 because `createReport` did not exist; then returned 403 until the test token included edit scope | Targeted route test passed | `POST /api/v1/bod-cod-deviation-reports` returns 201, Location, saved id/report no, and initialized workflow steps |
| Saved BOD/COD deviation form can be reopened by id | Route test failed with TS2339 because `getReportById` did not exist | Targeted route test passed | `GET /api/v1/bod-cod-deviation-reports/:id` returns form fields, measurements, attachments, current step, steps, and allowed actions |
| CENTRAL and REGIONAL workflow steps follow the previous design | Repository test was added before exporting the helper | Targeted repository test passed | CENTRAL has 3 steps; REGIONAL has 2 steps with the same role labels as the workflow docs |
| Save form enforces own-factory edit access | Repository test was added before the create-access query helper existed | Targeted repository test passed | `OWN_FACTORY` saves join `user_juristics` before insert access is granted |
| Operator factory access is scoped to own connected factories | Same RED run failed before module existed; later contract-change RED showed SQL still started from `factories` | Repository SQL test passed | Factory table query starts from `cems_wpms_connected_measurement_points` and joins `user_juristics` for `OWN_FACTORY` scope |
| Officer request access follows region constraints | Same RED run failed before module existed | Repository SQL test passed | Request table query applies `regionalAccess.regions` through `provinces.region` |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Operator factory table calls service with `OWN_FACTORY` scope and returns connected factory rows with measurement points and report slots | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | `npm test -- --runTestsByPath ...` |
| 2 | Officer request table calls service with `bod_cod_errors:view` scope and regional access | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | `npm test -- --runTestsByPath ...` |
| 3 | Missing `bod_cod_errors:view` permission is rejected | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | security | PASS | `npm test -- --runTestsByPath ...` |
| 4 | Operator can save the BOD/COD deviation form and receive initialized workflow state | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | `npm test -- --runTestsByPath ...` |
| 5 | Saved form detail can be read by id with measurement and workflow state | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | `npm test -- --runTestsByPath ...` |
| 6 | Operator factory SQL starts from connected measurement points and is limited through `user_juristics` | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository | PASS | `npm test -- --runTestsByPath ...` |
| 7 | Officer request SQL filters by `regionalAccess.regions` | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository | PASS | `npm test -- --runTestsByPath ...` |
| 8 | Detail read uses the same access filters as report list | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository | PASS | `npm test -- --runTestsByPath ...` |
| 9 | Approval step definitions stay CENTRAL 3-step and REGIONAL 2-step | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository | PASS | `npm test -- --runTestsByPath ...` |
| 10 | Save form checks own-factory edit access through `user_juristics` | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/security | PASS | `npm test -- --runTestsByPath ...` |

## Coverage And Known Gaps

Targeted test command passed. Full coverage is verified separately by the final verification loop. This first API slice includes list endpoints and base tables; create/update/approval endpoints are intentionally not implemented in this change.
