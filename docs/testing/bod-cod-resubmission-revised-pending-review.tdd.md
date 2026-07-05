# BOD/COD Resubmission Revised Pending Review TDD Evidence

Date: 2026-07-05

## Source Plan

User requested that when an operator saves a corrected BOD/COD report after revision, the report status must be `แก้ไขแล้ว/รอพิจารณา` instead of the first-submission status.

Follow-up clarification: BOD/COD must not use `UNDER_REVIEW`.

Follow-up clarification on 2026-07-05: after an operator resubmits a corrected report, officer workflow must restart at the first officer step and proceed through the whole approval track again. Operator-facing screens should display pending workflow states as `รอพิจารณา` until approval.

## User Journey

As a factory operator, I want my corrected BOD/COD report to return with a distinct revised-pending-review status, so that officers and tables can distinguish a corrected resubmission from an initial submission.

As an officer, I do not want BOD/COD to expose `UNDER_REVIEW`, so that the workflow uses only the approved status sequence.

As an officer, I want a corrected report to come back to the first officer step, so that previous approvals are rechecked against the corrected data.

As a factory operator, I want submitted and corrected reports to show `รอพิจารณา` until final approval, so that I do not need to distinguish internal officer review stages.

## RED Evidence

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts --runInBand
```

Result: FAIL

Relevant excerpt:

```text
Type '"REVISED_PENDING_REVIEW"' is not assignable to type
'"SUBMITTED" | "DRAFT" | "UNDER_REVIEW" | "WAITING_APPROVAL" | "APPROVED" | "REVISION_REQUESTED" | "CANCELLED"'.
```

## GREEN Evidence

Command:

```bash
cd backend
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand
```

Result: PASS

Relevant excerpt:

```text
Test Suites: 2 passed, 2 total
Tests:       17 passed, 17 total
```

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Resubmission response returns `REVISED_PENDING_REVIEW` after an operator submits a corrected report | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | focused Jest run |
| 2 | Report list filtering accepts `REVISED_PENDING_REVIEW` as a valid BOD/COD report status | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/query | PASS | focused Jest run |
| 3 | BOD/COD rejects the removed `UNDER_REVIEW` status filter with HTTP 400 | `backend/tests/unit/bod-cod-deviation-reports.route.test.ts` | route | PASS | focused Jest run |
| 4 | Operator-facing pending workflow states display as `รอพิจารณา` until final approval | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/contract | PASS | focused Jest run |
| 5 | Resubmission workflow reset returns corrected reports to step 1 and sets later steps back to `WAITING` | `backend/tests/unit/bod-cod-deviation-reports.repository.test.ts` | repository/workflow | PASS | focused Jest run |

## Verification

```bash
cd backend
npm run build
npm run typecheck
npx eslint src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository.ts src/modules/bod-cod-deviations/bod-cod-deviation-reports.types.ts tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts
npm test -- --runTestsByPath tests/unit/bod-cod-deviation-reports.route.test.ts tests/unit/bod-cod-deviation-reports.repository.test.ts --runInBand --coverage
```

Build, typecheck, focused lint, and focused tests passed.

Coverage command passed, but overall backend coverage reported low because Jest collected coverage for the full backend source tree while only the BOD/COD focused tests were executed. This is existing baseline coverage behavior, not a failure of the revised status tests.

## Known Gaps

- No E2E browser test was added because this change is backend contract/status behavior only and frontend code was intentionally not edited.
- No migration was needed because `bod_cod_deviation_reports.status` is a `VARCHAR(32)` without an enum constraint in the current migration.
