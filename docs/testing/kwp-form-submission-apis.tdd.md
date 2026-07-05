# KWP Form Submission APIs TDD Evidence

## Source plan

Journeys derived during this TDD run from requests to create APIs for **กวภ.01 แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ** and **กวภ.02 แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย** plus existing KWP form UI/data-dictionary evidence.

## User journeys

- As a factory operator, I want to submit a KWP01 malfunction form so that DIW officers can review the incident.
- As a factory operator, I want to submit a KWP02 emission measurement report with measurement rows and file metadata so that DIW officers can review lab evidence together with the form.
- As a factory operator, I want to submit a KWP04 exempted-CEMS emission measurement report with measurement rows and file metadata so that DIW officers can review lab evidence together with the form.
- As a factory operator, I want to submit a KWP05 CEMS calibration/verification report with RATA/photo evidence files so that DIW officers can review the calibration result.
- As a KWP reviewer or factory operator, I want to open KWP01, KWP02, KWP04, and KWP05 detail data by id so that saved form data and any uploaded evidence files can be displayed.
- As a factory operator, I want KWP02 files to upload with the same two-step pattern as connection-request documents so that binary files are stored before the form payload is submitted.
- As the backend, I want to reject invalid KWP01 payloads before writing data so that bad form states do not enter the database.
- As the backend, I want to reject KWP02 payloads without measurement rows so that an empty report cannot be submitted.
- As the system owner, I want OWN_FACTORY scope enforced when operators submit KWP forms so that one factory cannot submit on behalf of another.

## Task report

| Behavior | RED evidence | GREEN evidence | Guarantee |
| --- | --- | --- | --- |
| `POST /api/v1/kwp-form-submissions/kwp01` creates a submitted form | `npm test -- kwp-form-submissions --runInBand` failed with missing `kwp-form-submissions` module imports | `npm test -- kwp-form-submissions --runInBand` passed 2 suites / 5 tests | Route is mounted, requires auth/edit permission, validates body, returns 201 with `Location` |
| Repository maps KWP01 payload to normalized tables | same RED compile failure because repository module did not exist | same GREEN command | Submission, issue report, parameters, and status-history records are shaped for the expected DB tables |
| `POST /api/v1/kwp-form-submissions/kwp02` creates a submitted form | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand` failed with missing `createKwp02` service/repository exports | same command passed 2 suites / 8 tests | Route is mounted, requires auth/edit permission, validates body, returns 201 with measurement and attachment counts |
| Repository maps KWP02 payload to emission items and attachments | same RED compile failure because `toKwp02InsertRecordsForTests` did not exist | same GREEN command | Measurement rows map to `kwp_emission_measurement_items`; file metadata maps to `kwp_form_attachments` with related item linkage |
| `POST /api/v1/kwp-form-submissions/attachments` uploads KWP files before form submit | focused route test failed before the upload route and storage service existed | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand` passed 2 suites / 9 tests | Upload route uses KWP edit permission, accepts multipart `file`, and returns stored metadata for later form submission |
| OWN_FACTORY submission access uses `factories` + `user_juristics` | same RED compile failure because repository module did not exist | same GREEN command | Repository access query joins operator-factory assignment before allowing submission |
| `POST /api/v1/kwp-form-submissions/kwp04` creates a submitted form | focused route test failed because `createKwp04` was not part of the service interface and route | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand` passed 2 suites / 12 tests | Route is mounted, requires auth/edit permission, validates body, returns 201 with กวภ.04 response and counts |
| Repository maps KWP04 payload to shared emission tables | same RED/implementation cycle before KWP04 form type existed in repository emission mapping | same GREEN command | KWP04 saves parent row with `form_type = KWP04`; measurement rows and attachments use the same `kwp_emission_measurement_items` and `kwp_form_attachments` tables as KWP02 |
| `GET /api/v1/kwp-form-submissions/kwp01/:id`, `/kwp02/:id`, and `/kwp04/:id` return typed detail data | `npm test -- kwp-form-submissions --runInBand` failed at compile-time because `formType` did not exist on `KwpFormSubmissionReadAccess` | `npm test -- kwp-form-submissions --runInBand` passed 2 suites / 20 tests | Detail routes require `kwp_forms:view`, validate positive integer ids, pass the requested form type to the repository, and return KWP01 issue data or KWP02/KWP04 measurement rows with file URLs |
| Repository detail access is scoped | focused repository test initially absent for the new behavior | `npm test -- kwp-form-submissions --runInBand` passed after adding query assertion | Detail query filters by id, supported form types `KWP01/KWP02/KWP04`, operator factory assignment, and regional access |
| KWP attachment `fileUrl` avoids duplicated public path | local review found old metadata may store paths like `/uploads/...`, which could produce `/uploads/uploads/...` without normalization | `npm test -- kwp-form-submissions --runInBand` passed 2 suites / 20 tests | URL builder handles both relative storage paths and paths that already include `UPLOAD_PUBLIC_PATH` |
| `POST /api/v1/kwp-form-submissions/kwp05` creates a submitted form | `npm test -- kwp-form-submissions --runInBand` failed at compile-time because `createKwp05`, `KWP05` detail DTOs, and `toKwp05InsertRecordsForTests` did not exist | `npm test -- kwp-form-submissions --runInBand` passed 2 suites / 24 tests | Route is mounted, requires auth/edit permission, validates body, returns 201 with calibration item and attachment counts |
| Repository maps KWP05 payload to calibration tables and attachments | same RED compile failure because `toKwp05InsertRecordsForTests` did not exist | same GREEN command | KWP05 saves parent row with `form_type = KWP05`; header details map to `kwp05_calibration_reports`, rows map to `kwp05_calibration_items`, and evidence files map to `kwp_form_attachments` with `related_table = kwp05_calibration_items` |
| `GET /api/v1/kwp-form-submissions/kwp05/:id` returns typed detail data | same RED compile failure because `KWP05` was not a supported form type | same GREEN command | Detail route requires `kwp_forms:view`, filters by `formType = KWP05`, and returns `calibrationReport`, `calibrationItems`, and attachment `fileUrl` values |
| Returned KWP forms show edited-and-waiting label after operator resubmission | focused repository tests failed because resubmitted `SUBMITTED` rows still displayed `รอพิจารณา` | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-reports.repository.test.ts --runInBand` passed 2 suites / 18 tests | Machine status remains `SUBMITTED`, while workflow/report display labels become `แก้ไขแล้ว/รอพิจารณา` only when status history contains `REVISION_REQUESTED` |
| Returned KWP forms can be approved directly from revision state | focused repository test failed because `REVISION_REQUESTED` still returned `START_REVIEW` | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` passed 2 suites / 40 tests | Edit path can stay on `REVISION_REQUESTED`; reviewer action path can transition `REVISION_REQUESTED` + `APPROVE` to `APPROVED` |
| Submitted KWP forms can be approved directly | focused repository test failed because `SUBMITTED` returned only `START_REVIEW`, `REQUEST_REVISION` and rejected `APPROVE` | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` passed 2 suites / 40 tests | Reviewer action path can transition `SUBMITTED` + `APPROVE` to `APPROVED` without requiring `START_REVIEW` |
| KWP workflow removes START_REVIEW and UNDER_REVIEW | focused route/repository tests failed while the API still accepted `START_REVIEW` and returned `OFFICER_REVIEW` steps | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` passed after removing review-only actions and steps | KWP workflow now supports only `SUBMITTED -> APPROVE`, `SUBMITTED -> REQUEST_REVISION`, and `REVISION_REQUESTED -> APPROVE` |
| Operator returned KWP forms expose RESUBMIT instead of APPROVE | focused repository test failed because `OWN_FACTORY` revision workflow still exposed officer action `APPROVE` | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` passed after scope-filtering allowed actions | Operator can see `RESUBMIT`; officer can still see `APPROVE` |
| KWP workflow omits approved progress step | focused route/repository tests and docs still returned `APPROVED` inside `steps[]` | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` passed after keeping `APPROVED` as terminal status only | UI progress receives only `SUBMITTED` and `REVISION_REQUESTED`; final approval is represented by top-level `status = APPROVED` |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Valid KWP01 payload with `kwp_forms:edit` calls service and returns 201 with Location | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 2 | Invalid payload is rejected before service execution | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 3 | Missing edit permission returns 403 | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 4 | OWN_FACTORY access query checks `user_juristics` for the requested factory | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 5 | KWP01 payload maps to parent/detail/parameter/history insert records | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 6 | Valid KWP02 payload with measurement rows and file metadata calls service and returns 201 with Location | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand` |
| 7 | KWP02 payload without measurement rows is rejected before service execution | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | same focused command |
| 8 | KWP02 payload maps to parent/emission-item/attachment/history insert records | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | same focused command |
| 9 | KWP attachment upload returns file metadata for `measurementItems[].attachments[]` | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | same focused command |
| 10 | Valid KWP04 payload with measurement rows and file metadata calls service and returns 201 with Location | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand` |
| 11 | KWP04 payload without measurement rows is rejected before service execution | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | same focused command |
| 12 | KWP04 payload maps to `form_type = KWP04` plus shared emission-item/attachment records | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | same focused command |
| 13 | KWP01 detail returns issue report and unreported parameters | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 14 | KWP02 detail returns measurement rows and `attachments[].fileUrl` | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 15 | KWP04 detail returns measurement rows and `attachments[].fileUrl` | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 16 | Missing view permission returns 403 for detail reads | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 17 | Detail repository query applies id/form/scope/region filters | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 18 | Relative KWP attachment storage paths are converted to public file URLs | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 19 | Storage paths already starting with `/uploads` do not duplicate the public path | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 20 | Generic detail path `/api/v1/kwp-form-submissions/:id` is no longer exposed | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 21 | Valid KWP05 payload with calibration rows and file metadata calls service and returns 201 with Location | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 22 | KWP05 payload rejects `endDate` before `startDate` before service execution | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 23 | KWP05 payload maps to `kwp05_calibration_reports`, `kwp05_calibration_items`, and `kwp_form_attachments` | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 24 | KWP05 detail returns calibration rows and `attachments[].fileUrl` | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | `npm test -- kwp-form-submissions --runInBand` |
| 25 | Returned form workflow shows `แก้ไขแล้ว/รอพิจารณา` after operator resubmits | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-reports.repository.test.ts --runInBand` |
| 26 | KWP report table shows `แก้ไขแล้ว/รอพิจารณา` for resubmitted returned requests | `backend/tests/unit/kwp-form-reports.repository.test.ts` | unit | PASS | same focused command |
| 27 | KWP revision state allows `APPROVE` instead of `START_REVIEW` | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` |
| 28 | KWP revision response exposes `allowedActions: ["APPROVE"]` to API clients | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | same focused command |
| 29 | KWP submitted state allows direct `APPROVE` to `APPROVED` | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-submissions.route.test.ts --runInBand` |
| 30 | KWP workflow rejects removed `START_REVIEW` action before service execution | `backend/tests/unit/kwp-form-submissions.route.test.ts` | route | PASS | same focused command |
| 31 | KWP operator revision workflow exposes `RESUBMIT` instead of `APPROVE` | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | same focused command |
| 32 | KWP workflow omits `APPROVED` from `steps[]` | `backend/tests/unit/kwp-form-submissions.repository.test.ts` | unit | PASS | same focused command |

## Coverage and known gaps

- Targeted GREEN command for latest KWP02 change: `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand`
- Result after KWP typed-detail follow-up: 2 test suites passed, 20 tests passed.
- Result after KWP05 follow-up: 2 test suites passed, 24 tests passed.
- Result after returned-form status-label follow-up: 2 focused repository suites passed, 18 tests passed.
- Result after direct revision approval follow-up: 2 focused KWP submission suites passed, 40 tests passed.
- Result after direct submitted approval bug fix: 2 focused KWP submission suites passed, 40 tests passed.
- Result after removing START_REVIEW/UNDER_REVIEW from KWP workflow: focused KWP submission suites passed.
- Frontend build command: `npm run build` in `frontend/`
- Frontend build result: passed; Vite reported the existing large-chunk warning only.
- Full coverage command: `npm run test:coverage -- --runInBand`
- Full coverage result: 42 test suites passed, 370 tests passed, overall statements 46.72%.
- Coverage gap: repo-wide coverage is below the ECC 80% target before/after this change because many existing modules and migrations are not covered by tests.
- Known gap: no live MSSQL migration execution was performed in this TDD step; migration syntax is covered by TypeScript/build verification, not a real database smoke test.

## Merge evidence

- RED: test target failed because `kwp-form-submissions.service` and `kwp-form-submissions.repository` did not exist.
- GREEN: same target passed after adding route/controller/service/repository/validator, migration, app mount, docs, and evidence.
- KWP02 RED: focused route/repository tests failed because `createKwp02` and `toKwp02InsertRecordsForTests` did not exist.
- KWP02 GREEN: same focused target passed after adding the endpoint, validator, repository transaction, migration, APIDoc, and evidence.
- KWP02 file-upload follow-up: added a KWP attachment upload route using the same multipart-before-submit pattern as connection-request document uploads, then wired the frontend to upload files per measurement row before calling `/kwp02`.
- KWP04 follow-up RED: focused route test failed because the service interface had no `createKwp04`.
- KWP04 follow-up GREEN: same focused route/repository command passed after adding `/kwp04`, reusing KWP02 measurement validation, storing `form_type = KWP04`, and documenting payload/response/table columns.
- KWP detail follow-up RED: focused route test failed at compile-time because `getById` did not exist on `kwpFormSubmissionsService`.
- KWP detail follow-up GREEN: same focused route/repository command passed after replacing the generic detail path with `GET /api/v1/kwp-form-submissions/kwp01/:id`, `/kwp02/:id`, and `/kwp04/:id`, scope-aware typed repository reads, attachment `fileUrl` derivation with public-path normalization, APIDoc response examples for 01/02/04, and derived-field documentation.
- KWP05 RED: focused route/repository tests failed at compile-time because `createKwp05`, `KWP05` DTO support, and `toKwp05InsertRecordsForTests` did not exist.
- KWP05 GREEN: same focused command passed after adding `/kwp05`, `GET /kwp05/:id`, validation, migration `0057_create_kwp05_calibration_tables`, repository transaction, APIDoc payload/response/table columns, and TDD evidence.
- Returned-form status-label RED: focused repository tests failed because workflow/report DTOs displayed resubmitted returned rows as `รอพิจารณา`.
- Returned-form status-label GREEN: same focused command passed after deriving display labels from current status plus `REVISION_REQUESTED` history, while preserving machine status/status code as `SUBMITTED`.
- Direct revision approval RED: focused repository test failed because `REVISION_REQUESTED` returned `START_REVIEW`.
- Direct revision approval GREEN: focused repository/route command passed after changing `REVISION_REQUESTED` allowed action to `APPROVE`, preserving `APPROVE -> APPROVED` transition.
- Direct submitted approval RED: focused repository test failed because `SUBMITTED` did not include `APPROVE` in allowed actions.
- Direct submitted approval GREEN: focused repository/route command passed after adding `APPROVE` to `SUBMITTED`, preserving `APPROVE -> APPROVED` transition.
- Removed review-state RED: focused tests showed `START_REVIEW`, `UNDER_REVIEW`, and `OFFICER_REVIEW` still existed in route fixtures, workflow steps, and allowed actions.
- Removed review-state GREEN: focused repository/route command passed after removing `START_REVIEW` from validation/actions and removing `OFFICER_REVIEW` from workflow steps.
- Operator RESUBMIT RED: focused repository test showed `OWN_FACTORY` revision workflow exposed `APPROVE`.
- Approved-step RED: focused fixtures/docs still included `APPROVED` as a progress step.
- Approved-step GREEN: focused repository/route command passed after removing `APPROVED` from workflow steps while preserving terminal status `APPROVED`.
- Operator RESUBMIT GREEN: focused repository/route command passed after adding scope-filtered `RESUBMIT` for operator revision workflow.

## Returned-form status-label follow-up

Source plan: when an operator saves edited data and resubmits a returned KWP01/KWP02/KWP03/KWP04/KWP05 form, the machine state should return to the existing review queue state (`SUBMITTED`) for workflow compatibility, but the display text should communicate that the factory has already edited and sent it back.

User journey:

- As a DIW reviewer, I want a returned form that the operator resubmitted to show `แก้ไขแล้ว/รอพิจารณา` so that I can distinguish a first-time submission from an edited return.
- As an API client, I want `status`/`statusCode` to remain machine-stable as `SUBMITTED` so that existing review actions and filters continue to work.

Verification:

- RED: `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.repository.test.ts tests/unit/kwp-form-reports.repository.test.ts --runInBand` failed with expected `แก้ไขแล้ว/รอพิจารณา`, received `รอพิจารณา`.
- GREEN: same command passed after adding status-label derivation for workflow and report DTOs.
- Build: `npm run build` in `backend/` passed.
- Typecheck: `npm run typecheck` in `backend/` passed.
- Targeted lint: `npx eslint src/modules/kwp-form-reports/kwp-form-reports.repository.ts src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts tests/unit/kwp-form-reports.repository.test.ts tests/unit/kwp-form-submissions.repository.test.ts` passed.
- Targeted format check: `npx prettier --check src/modules/kwp-form-reports/kwp-form-reports.repository.ts src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts tests/unit/kwp-form-reports.repository.test.ts tests/unit/kwp-form-submissions.repository.test.ts ../docs/APIDoc/KWP_FORM_SUBMISSION_APIS.md` passed.
- Targeted coverage command passed, but project-wide 80% coverage is still not met by this focused run because Jest includes many unrelated backend files with no tests in the coverage denominator.
