# KWP Form Report APIs TDD Evidence

## Source plan

Journeys derived from the request: build read APIs for the "แจ้งแบบ กวภ.01 - กวภ.05" page after inspecting frontend table needs.

## User journeys

- As an operator, I want to see only my factories in the KWP factory table.
- As an operator or officer, I want to see KWP request rows shaped like the frontend request table.
- As an officer, I want KWP request visibility to follow the menu permission scope and regional access.

## Task report

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | KWP factory route requires `kwp_forms:view` and passes `OWN_FACTORY` scope to service | `backend/tests/unit/kwp-form-reports.route.test.ts` | route | RED then GREEN | `npm test -- kwp-form-reports --runInBand` |
| 2 | KWP request route validates filters and passes regional access to service | `backend/tests/unit/kwp-form-reports.route.test.ts` | route | RED then GREEN | `npm test -- kwp-form-reports --runInBand` |
| 3 | Repository factory query starts from POMS `factories`, joins eligible factory data, connected points, and operator juristic filter | `backend/tests/unit/kwp-form-reports.repository.test.ts` | unit | RED then GREEN | `npm test -- kwp-form-reports --runInBand` |
| 4 | Repository request query starts from `kwp_form_submissions` and applies form/status/region filters | `backend/tests/unit/kwp-form-reports.repository.test.ts` | unit | RED then GREEN | `npm test -- kwp-form-reports --runInBand` |

## RED/GREEN evidence

- RED: `npm test -- kwp-form-reports --runInBand` failed because `kwp-form-reports` module files did not exist.
- GREEN: `npm test -- kwp-form-reports --runInBand` passed 2 test suites / 7 tests.

## Coverage and known gaps

Focused route/query tests were added for the new read APIs. Full coverage and integration DB execution should be validated with the broader backend suite before release.
