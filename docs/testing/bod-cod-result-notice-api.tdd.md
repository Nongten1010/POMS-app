# BOD/COD Result Notice API TDD Evidence

## Source Plan

No plan file was provided. Journeys were derived from the user request: officers need an API to fill and edit the BOD/COD result notice form at the officer result-notice step.

## User Journeys

- As an officer, I want to save the BOD/COD result notice form while the current step is `RESULT_NOTICE`, so that the result notice can be prepared before director approval.
- As an officer, I want saved result notice data to be returned from the report detail API, so that reopening the form can prefill the existing values.
- As an API client, I want validation and access checks on the result notice endpoint, so that operators cannot submit officer-only result notice data.

## Task Report

| Task | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Add result notice route and service contract | `npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand` failed with `TS2339: Property 'upsertResultNotice' does not exist`. | Same focused command passed: 2 suites, 34 tests. | `PUT /api/v1/bod-cod-deviation-reports/:id/result-notice` routes through `bodCodDeviationReportsService.upsertResultNotice`. |
| Add result notice access query | Same RED command failed with `TS2724: has no exported member named 'buildBodCodResultNoticeAccessQueryForTests'`. | Same focused command passed. | Result notice save uses the same report/current-step query and regional access filters as workflow updates. |
| Validate officer-only payload | Route tests cover valid payload, missing `inspectorName`, and operator access. | Same focused command passed. | Invalid payload returns 400 before service; operator token returns 403 before service. |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Officers can save result notice payload with `bod_cod_errors:approve` | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route/API contract | PASS | Focused Jest run |
| 2 | Invalid result notice payload is rejected before service | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | validation | PASS | Focused Jest run |
| 3 | Operators cannot save result notice form | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | authorization | PASS | Focused Jest run |
| 4 | Result notice save query joins current approval step and regional filter | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/access | PASS | Focused Jest run |

## Verification

Commands run:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand
npm run typecheck
npx eslint src/db/migrations/0062_create_bod_cod_result_notices.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.types.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.validator.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.controller.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.service.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository.ts tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts
npm run build
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand --coverage
```

Results:

- RED: focused Jest command failed before implementation because `upsertResultNotice` and the result-notice access helper did not exist.
- GREEN: focused route and repository suites passed, 2 suites / 34 tests.
- Typecheck: `tsc --noEmit` passed.
- Targeted lint: scoped ESLint command passed.
- Build: backend build passed.
- Coverage: focused coverage command passed, 2 suites / 34 tests; global statement coverage reported 13.5% because Jest collected the full backend source tree while only the focused BOD/COD suites were executed.

## Known Gaps

- No frontend code was changed because the request did not include the exact project-required phrase `แก้ frontend ด้วย`.
- Full verification commands are recorded in the implementation session output; this file records the TDD route/repository evidence for the new API.
