# Connection Request Factory Snapshot Advanced Search TDD Evidence

## Source plan

- Store searchable factory dimensions as a request-time snapshot in `cems_wpms_request_factory_snapshots`.
- Keep `cems_wpms_connection_requests` as the request header table.
- Use snapshot fields for advanced search filters and dropdown options.
- Preserve backend-only scope; frontend wiring is not included in this change.

## User journeys

- As an officer, I want to filter request rows by province, district, industrial estate, and factory main type code.
- As a frontend client, I want dropdown options from values that actually exist in submitted request snapshots.
- As an API client, I want factory main type code and description separated so `8802` can be filtered while the UI displays the full Thai description.

## Task report

| Behavior                                                              | RED evidence                                                                                                                                                                                                     | GREEN evidence                                                               | Guarantee                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Request validators accept snapshot fields and advanced-search filters | `npm test -- --runTestsByPath tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.validator.test.ts` failed because `provinceName` and new snapshot fields were not in the contract | Targeted tests passed: 52 tests                                              | Form payload and list query schema accept the new fields              |
| Repository filters through request factory snapshots                  | New repository test failed before `ListConnectionRequestsQuery` and SQL filter existed                                                                                                                           | Targeted tests passed and SQL contains `cems_wpms_request_factory_snapshots` | Request list search uses the snapshot table                           |
| Search options endpoint exists                                        | Route test failed because `listSearchOptions` did not exist on the service                                                                                                                                       | `tests/unit/connection-requests.operator-factories.route.test.ts` passed     | `GET /api/v1/cems-wpms-requests/search-options` returns dropdown data |

## Verification

| Command                                                                                                                                                                                           | Result                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `npm test -- --runTestsByPath tests/unit/connection-requests.operator-factories.route.test.ts tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.validator.test.ts` | PASS, 3 suites / 52 tests |
| `npm run typecheck`                                                                                                                                                                               | PASS                      |

## Known gaps

- Existing historical rows can only be backfilled for province, region, and industrial estate when they still match `factories`.
- District and subdistrict are not parsed from free-text address; they require separate request payload fields.
- Frontend controls are intentionally not wired in this backend-only change.
