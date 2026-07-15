# TDD Evidence: Selected Eligible Factory Address Names

## Source and journey

The journey was derived from the selected “โรงงานที่เข้าข่าย” rows reported on 2026-07-13:

1. As an API consumer, `GET /api/v1/eligible-factories` returns real Thai subdistrict and district names for legacy addresses that contain DIW numeric codes.
2. As a form user, a readable address already entered in a monitoring-point form is preserved.
3. As a system, the `GET` endpoint remains read-only and falls back safely when the external DIW source is unavailable.

## RED/GREEN report

| Behavior | Test target | RED evidence | GREEN evidence |
| --- | --- | --- | --- |
| Resolve a selected row through `fac_import` and `dbo.TUMBOL` | `backend/tests/unit/eligible-factories.repository.test.ts` | Expected `197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150`; received stored `197 หมู่ 5 ตำบล7 อำเภอ4 17150` | Focused repository test passed after source hydration was wired into `list()` |
| Preserve readable form text | same test file | Added as a regression boundary after the primary RED seam was established | PASS |
| Suppress unresolved numeric codes and retain stored data when the source fails | same test file | Added as fallback coverage after the primary RED seam was established | PASS |

## Test specification

| # | Guarantee | Test type | Result |
| --- | --- | --- | --- |
| 1 | `FID 10180000125417`, codes `18 + 4 + 7`, resolve to `ตำบลหาดอาษา อำเภอสรรพยา` | Unit/repository | PASS |
| 2 | A readable monitoring-form address is not overwritten | Unit/repository | PASS |
| 3 | Missing `TUMBOL` lookup omits `ตำบล7` and `อำเภอ4` | Unit/repository | PASS |
| 4 | Failed `fac_import` lookup returns the stored selected row | Unit/repository | PASS |
| 5 | Existing response keys and envelope are unchanged | Service regression suite | PASS |

## Validation

- Primary RED: focused test ran and failed with the expected stored numeric address.
- Focused GREEN: `npm test -- --runInBand tests/unit/eligible-factories.repository.test.ts` — PASS: 1 suite, 4 tests.
- Related regression: repository, mapper, candidates repository, and selected-factory service — PASS: 4 suites, 36 tests.
- `npm run typecheck` — PASS.
- Scoped ESLint for the changed TypeScript files — PASS.
- Focused coverage for `eligible-factory-source-hydration.ts` — PASS: 84.14% statements, 94.11% functions, and 91.17% lines.
- Complete backend suite — 567 tests passed and 1 unrelated stale validator expectation failed: the test expects the former 4-digit sequence `9200 / 0200,0602,0605`, while the current 5-digit implementation returns `09200 / 00200,00602,00605`.
- Live repository read against current configured databases — PASS: 775 selected rows, 0 responses retaining numeric `ตำบล/อำเภอ` labels. Verified examples:
  - `10440000325577` -> `111 หมู่ 18 ตำบลนาโพธิ์ อำเภอกุดรัง 44130`
  - `10180000125417` -> `197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150`

## API design decision

- The endpoint stays `GET` and performs no backfill or write side effect.
- The response contract remains `{ data, meta: { total } }`; only incorrect legacy `address` values are enriched.
- Source lookups are chunked at 500 keys to remain within SQL Server parameter limits.

## Persistent cleanup follow-up

The stored source of truth is repaired by the separate data migration
`0070_backfill_eligible_factory_address_names.ts` instead of writing during `GET`.

| Guarantee | Test target | Result |
| --- | --- | --- |
| `ตำบล10 อำเภอ4` resolves through the composite `24:4:10` key and persists as `ตำบลท่าข้าม อำเภอบางปะกง` | `backend/tests/unit/eligible-factory-address-backfill.test.ts` | PASS |
| A readable stored address is not selected for replacement | same test file | PASS |
| Missing or incomplete administrative master data causes the row to be skipped | same test file | PASS |
| Province, district, and subdistrict are all included in the lookup key | same test file | PASS |
| A concurrent address edit is not overwritten by the migration | same test file | PASS |
| Monitoring-point form synchronization resolves numeric labels and omits an unresolved numeric address from updates | `backend/tests/unit/monitoring-point-forms.service.test.ts` | PASS |
| Direct eligible-factory create/restore cannot persist unresolved numeric labels | `backend/tests/unit/eligible-factories.service.test.ts` | PASS |

Migration `0070` stores the original and normalized address in
`eligible_factory_address_cleanup_0070`; `down()` restores the original only when the current value
still equals the value written by the migration, then drops the backup table. A later manual edit is
therefore not overwritten during rollback.

## Git checkpoint note

No checkpoint commit was created because the worktree already contains unrelated user changes. This avoids mixing scopes in a commit.
