# TDD Evidence: CEMS/WPMS request-form backend update

## Source and user journeys

No `*.plan.md` file was provided. Journeys were derived from the request on 2026-07-13:

1. As a factory operator, I can submit an add-monitoring-point request with the new CEMS or WPMS form shape without losing selected values.
2. As a factory operator, I can request only parameters that remain pending, including the three CS2 unit labels.
3. As a reviewer, I receive unambiguous parameter groups, fuel details, treatment systems, and document metadata.
4. As a system, I reject files over 5 MB and multiple company logos while permitting multiple non-logo files.
5. As a consumer of the connected-point modal, I keep receiving a string treatment-system field even though new forms store an array.

## RED evidence

Tests were added before production changes.

| Behavior | RED command | Intended failure |
| --- | --- | --- |
| New validator/upload contract | `npm test -- --runInBand tests/unit/connection-request-form-enhancements.validator.test.ts tests/unit/connection-request-document-upload-limit.test.ts` | 2 suites failed; 11 failed, 2 passed. Treatment arrays were rejected, limit remained 20 MB, and the new validation guarantees were absent. |
| WPMS modal treatment array | `npm test -- --runInBand tests/unit/connection-requests.service.test.ts -t "returns modal detail rows for all connected measurement points in a factory"` | Expected joined treatment string, received `null`. |
| Resubmit without `requestType` | `npm test -- --runInBand tests/unit/connection-request-form-enhancements.validator.test.ts tests/unit/connection-requests.service.test.ts -t "preserves an omitted request type\|validates an omitted resubmit request type"` | 2 suites failed, 2 tests failed: schema defaulted to `NEW_CONNECTION` and service accepted an invalid add-point revision. |
| Treatment Other/flag edge cases | `npm test -- --runInBand tests/unit/connection-request-form-enhancements.validator.test.ts -t "requires the Other treatment detail even when\|rejects an unsupported hasTreatmentSystem"` | 1 suite failed, 2 tests failed: both invalid forms were accepted. |
| Resubmit request-type tampering | `npm test -- --runInBand tests/unit/connection-requests.service.test.ts -t "rejects changing the request type while resubmitting"` | 1 suite failed, 1 test failed: service accepted and persisted a different request type. |

The first attempted validator RED run had TypeScript errors in two test mutations. That run was not counted as valid RED. The tests were corrected without changing production code, then rerun to obtain the runtime RED above.

## GREEN evidence and guarantees

| # | Guarantee | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | Annex accepts 1–13 and rejects 14 | `backend/tests/unit/connection-request-form-enhancements.validator.test.ts` | Unit/schema | PASS |
| 2 | CS2 ppm/ppb/mg/m³ labels remain distinct in the request parameter array | same | Unit/schema | PASS |
| 3 | Requested parameters must be a subset of pending parameters | same | Unit/schema | PASS |
| 4 | `ไม่มี` is exclusive and never becomes a telemetry parameter | same | Unit/schema | PASS |
| 5 | Biomass/Other fuels require detail | same | Unit/schema | PASS |
| 6 | CEMS/WPMS treatment arrays are accepted; legacy scalar remains accepted | same | Unit/schema | PASS |
| 7 | Treatment Other requires detail for CEMS and WPMS | same | Unit/schema | PASS |
| 8 | Multiple non-logo documents pass; duplicate company logo fails | same | Unit/schema | PASS |
| 9 | Metadata over 5 MB fails | same | Unit/schema | PASS |
| 10 | Binary upload accepts exactly 5 MB and rejects 5 MB + 1 byte | `backend/tests/unit/connection-request-document-upload-limit.test.ts` | Unit/service | PASS |
| 11 | Multipart route rejects over-limit uploads with HTTP 400 | `backend/tests/unit/connection-request-document-upload.route.test.ts` | Integration/route | PASS |
| 12 | WPMS modal joins treatment array while keeping `string|null` response type | `backend/tests/unit/connection-requests.service.test.ts` | Unit/service | PASS |
| 13 | Resubmit without `requestType` resolves the original request type and revalidates its full form contract | same | Unit/service + schema | PASS |
| 14 | Resubmit rejects an explicit request type that differs from the stored request | same | Unit/service | PASS |
| 15 | Treatment Other requires detail even without the yes/no flag; invalid flag values fail | `backend/tests/unit/connection-request-form-enhancements.validator.test.ts` | Unit/schema | PASS |
| 16 | PNG/JPEG/PDF content signature must match the declared file type | `backend/tests/unit/connection-request-document-upload.service.test.ts` | Unit/service | PASS |

Focused GREEN command:

```text
npm test -- --runInBand \
  tests/unit/connection-request-form-enhancements.validator.test.ts \
  tests/unit/connection-requests.validator.test.ts \
  tests/unit/connection-request-document-upload-limit.test.ts \
  tests/unit/connection-request-document-upload.service.test.ts \
  tests/unit/connection-request-document-upload.route.test.ts \
  tests/unit/connection-requests.service.test.ts
```

Result: 6 suites passed, 127 tests passed.

## Typecheck, lint, and coverage

- `npm run typecheck` — PASS.
- Targeted ESLint for changed connection-request production/tests — PASS with 0 errors and 0 warnings.
- Focused Jest coverage command — PASS: 6 suites, 127 tests.
- Changed-module line coverage:
  - `connection-request-document-image.service.ts`: 84.72% lines, 85.13% statements.
  - `connection-requests.validator.ts`: 91.80% lines, 90.11% statements.
  - `connection-requests.service.ts`: 92.58% lines, 87.74% statements.
- Focused invocation global coverage is 22.92% lines / 22.00% statements because Jest collects the complete backend source tree. Repository-wide 80% is not established by this focused run; the changed modules exceed 80% line and statement coverage.
- No frontend E2E was added: frontend code was inspected read-only under the repository scope rule, and the frontend package has no test script.

## Wider verification

- Backend `npm run build` — PASS.
- Backend `npm audit --omit=dev` — PASS, 0 vulnerabilities.
- Scoped `git diff --check` — PASS.
- Full backend `npm test` in the clean release worktree — PASS: 47 suites, 502 tests.

## Known gaps

1. Current frontend WPMS code uploads documents but omits `documentsAndImages` from the final WPMS point payload.
2. Current frontend requested-parameter options still come from the full master list rather than pending values.
3. Current frontend spells the third CS2 label `CS2 (mg/m3)` instead of canonical `CS2 (mg/m³)`.
4. Mobile/Station option rendering is not wired to submitted form fields.
5. Connection-request backend now accepts and round-trips the detailed frontend EIA shape (`มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ` plus `eiaOther`). Frontend edit mapping still needs to copy `eiaOther` from the response.
6. Selecting several CS2 unit variants on one point is preserved in request JSON, but downstream parameter-evaluation maps still key primarily by base code (`cs2`). A dedicated downstream multi-unit evaluation change is not included here.
7. Logo pixel dimensions are UI guidance only in this change; the server enforces MIME/extension, 5 MB, and one-logo cardinality but does not parse 512 × 512 dimensions.
8. Existing request metadata over 5 MiB now fails resubmit and must be removed or replaced; no automatic migration was applied.
9. Uploaded document URLs remain public static URLs under the existing upload path, and submitted metadata is not yet bound to an actor/factory-owned upload ID. Private downloads, quota, ownership, and orphan cleanup need a separately designed security change.

## TDD addendum: instrument criteria and dialog/table UI

### RED evidence

| Target | Command | Actual RED |
| --- | --- | --- |
| Frontend 80% helper | `cd frontend && node --test src/utils/instrumentCriteria.test.mjs` | FAIL `ERR_MODULE_NOT_FOUND`; helper did not exist |
| Backend canonical rows | `cd backend && npm test -- --runInBand tests/unit/connection-requests.validator.test.ts -t "derives canonical 80 percent"` | FAIL because rows were mandatory and not derived |
| Invalid enabled criteria | `cd frontend && npm test` | FAIL because validity helper was not exported |
| Backend tamper cases | focused validator test for `invalid numeric standard|unsupported enabled` | FAIL 5 tests: zero, negative, overflow, subnormal, and `enabled: "yes"` were accepted |

### GREEN evidence

| Guarantee | Result |
| --- | --- |
| Frontend derives 80%, handles decimals and rejects invalid/subnormal standards | 4/4 tests PASS; helper coverage 100% |
| Backend derives canonical rows and rejects numeric/boolean tampering | focused connection-request suites PASS |
| Frontend/backend compile and lint | PASS |
| Full backend regression suite in clean release worktree | 47 suites / 508 tests PASS |

Delete confirmation is not applicable because the requested UI removes the delete action. Component-level React tests and browser E2E are not present; the pure calculation is unit-tested and the UI guarantees are build/source-audited.

## TDD addendum: frontend payload and backend response round-trip (2026-07-13)

### RED evidence

| Guarantee | Actual RED |
| --- | --- |
| Accept detailed EIA and `eiaOther` | Focused validator run failed because the root strict schema accepted only `มี`/`ไม่มี` and rejected `eiaOther`. |
| Persist and return exact EIA | Helper/storage tests initially failed because the EIA helper, migration columns and request serializer mapping did not exist. |
| Preserve DB consistency | Migration test initially failed until the CHECK explicitly constrained non-null categorical and boolean agreement. |
| Do not hide malformed documents | Validator accepted malformed or metadata-only rows because placeholder pre-normalization discarded too much. |
| Consistent resubmit errors | Service returned `BAD_REQUEST` instead of the shared Zod `VALIDATION_ERROR` response shape. |
| Block legacy generic-route bypass | Generic create accepted add-parameter payloads without the existing point code and required form sections. |
| Keep add-parameter documents optional | Dedicated and legacy validator tests, then service create/resubmit tests, failed because CEMS add-parameter requests were still forced to include `documentsAndImages`. |
| Full nested validation paths | Error responses exposed only flattened `details`, not the complete nested issue path. |

### GREEN evidence on clean `origin/main` release worktree

- Reviewer-regression run for validator/service/routes: 3 suites, 102 tests passed.
- Focused coverage run: 14 suites, 213 tests passed.
- Line coverage: migration 100%, EIA helper 93.33%, connection-request service 92.26%, validator 92.74%, error handler 86.36%.
- The repository file is broad and reports 32.58% line coverage as a whole; changed EIA query/serializer paths are covered by dedicated repository/helper tests. This is not presented as repository-wide 80% coverage.
- Exact deploy-workflow command `npm test` passed 51 suites / 550 tests; `npm run typecheck`, backend build, `npm audit --omit=dev` (0 vulnerabilities), and `git diff --check` passed. Scoped ESLint returned 0 errors and one pre-existing Prettier warning in an access-scope assertion outside this change.

### Remaining frontend round-trip gaps

1. WPMS uploads documents but omits `documentsAndImages` from the final point JSON.
2. The regulation-clause tag input is not bound to `details.exemptedParameterRegulationClauses`.
3. Generic comma splitting corrupts WPMS treatment labels that contain a comma.
4. Contact columns are filtered independently before index-based zipping, so blank optional values can shift one person's fields onto another.
5. Edit response mapping does not copy `eiaOther` back into form state.
6. `CS2 (mg/m3)` still differs from the canonical `CS2 (mg/m³)`, and Mobile/Station is not wired end-to-end.
