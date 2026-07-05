# BOD/COD Result Notice Workflow TDD Evidence

## Source Plan

No plan file was provided. Journeys were derived from the user request: BOD/COD approval must not jump from the first officer approval directly to approval; it must move through the result-notice editing step first.

## User Journeys

- As a regional officer, I want first approval to move the report to `บันทึก/แก้ไขแบบแจ้งผล`, so that the same monitoring-center officer can prepare the result notice before director approval.
- As a central officer, I want first approval to move to the result-notice editing step, then `ผอ.กฝม. (ทบทวน)`, then `ผอ.กวภ. (อนุมัติ)`, so that the central workflow follows the documented review chain.
- As an API client, I want `statusCode` and `steps[]` to expose the active workflow role, so that the frontend can open the correct action surface without guessing from province names.

## Task Report

| Task | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Add result-notice step to BOD/COD workflow definitions | `npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.repository.test.ts` failed with `TS2345: Argument of type 'string' is not assignable to parameter of type 'boolean'`, proving workflow transition logic only knew whether a next step existed. | `npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand` passed: 2 suites, 30 tests. | Regional workflow has inspector -> result notice -> approver; central workflow has inspector -> result notice -> reviewer -> approver. |
| Map first approval to result notice instead of waiting approval | Same RED command above; tests expected `WAITING_RESULT_NOTICE` for next role `RESULT_NOTICE`. | Focused repository and route tests passed after transition logic used the next step role. | `APPROVE` to `RESULT_NOTICE` returns `WAITING_RESULT_NOTICE`; `APPROVE` to `REVIEWER` returns `WAITING_REVIEW`; `APPROVE` to `APPROVER` returns `WAITING_APPROVAL`. |
| Keep operator-facing pending labels stable | Added assertions for `WAITING_RESULT_NOTICE` and `WAITING_REVIEW` under `OWN_FACTORY`. | Focused repository and route tests passed. | Operators still see pending workflow states as `รอพิจารณา` until final `APPROVED`. |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | BOD/COD central and regional steps include result-notice editing before review/approval | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/unit | PASS | Focused Jest run |
| 2 | First regional approval returns `WAITING_RESULT_NOTICE`, current step 2, role `RESULT_NOTICE` | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route/API contract | PASS | Focused Jest run |
| 3 | Transition status is derived from the next role, not just whether a next step exists | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/unit | PASS | Focused Jest run |
| 4 | New pending statuses are valid report statuses and have officer/operator labels | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/contract | PASS | Focused Jest run |

## Verification

Commands run:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.repository.test.ts
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand
npx eslint src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.types.ts tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts
npm run lint
npm run typecheck
npm run build
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand --coverage
```

Results:

- RED: repository test failed before implementation with `TS2345` because transition logic accepted only a boolean next-step flag.
- GREEN: focused route and repository suites passed, 2 suites / 30 tests.
- Lint: targeted ESLint passed after Prettier fixes.
- Full backend lint: exit 0 with pre-existing warnings outside the scoped BOD/COD files; no errors.
- Typecheck: `tsc --noEmit` passed.
- Build: backend build passed.
- Coverage: focused coverage command passed; global coverage showed 13.44% statements because Jest collected coverage for the full backend source tree while only the focused BOD/COD tests were executed. This matches the existing focused-test coverage caveat in prior BOD/COD evidence.

## Known Gaps

- No frontend code was changed because the request did not include the exact project-required phrase `แก้ frontend ด้วย`.
- No checkpoint commits were created because the working tree already contained unrelated dirty files and the user did not ask for a commit.
