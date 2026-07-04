# KWP Form Submission APIs TDD Evidence

## Source plan

Journeys derived during this TDD run from requests to create APIs for **กวภ.01 แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ** and **กวภ.02 แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย** plus existing KWP form UI/data-dictionary evidence.

## User journeys

- As a factory operator, I want to submit a KWP01 malfunction form so that DIW officers can review the incident.
- As a factory operator, I want to submit a KWP02 emission measurement report with measurement rows and file metadata so that DIW officers can review lab evidence together with the form.
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
| OWN_FACTORY submission access uses `factories` + `user_juristics` | same RED compile failure because repository module did not exist | same GREEN command | Repository access query joins operator-factory assignment before allowing submission |

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

## Coverage and known gaps

- Targeted GREEN command for latest KWP02 change: `npm test -- --runTestsByPath tests/unit/kwp-form-submissions.route.test.ts tests/unit/kwp-form-submissions.repository.test.ts --runInBand`
- Result: 2 test suites passed, 8 tests passed.
- Full coverage command: `npm run test:coverage -- --runInBand`
- Full coverage result: 42 test suites passed, 370 tests passed, overall statements 46.72%.
- Coverage gap: repo-wide coverage is below the ECC 80% target before/after this change because many existing modules and migrations are not covered by tests.
- Known gap: no live MSSQL migration execution was performed in this TDD step; migration syntax is covered by TypeScript/build verification, not a real database smoke test.

## Merge evidence

- RED: test target failed because `kwp-form-submissions.service` and `kwp-form-submissions.repository` did not exist.
- GREEN: same target passed after adding route/controller/service/repository/validator, migration, app mount, docs, and evidence.
- KWP02 RED: focused route/repository tests failed because `createKwp02` and `toKwp02InsertRecordsForTests` did not exist.
- KWP02 GREEN: same focused target passed after adding the endpoint, validator, repository transaction, migration, APIDoc, and evidence.
