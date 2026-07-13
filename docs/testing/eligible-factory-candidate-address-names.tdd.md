# TDD Evidence: Eligible Factory Candidate Address Names

## Source and journey

The journey was derived from the reported candidate response on 2026-07-13:

1. As an API consumer, I receive the actual Thai subdistrict and district names in `address` instead of DIW numeric codes such as `ตำบล7` and `อำเภอ4`.
2. As a system, I do not present unresolved numeric codes as administrative-area names when the master lookup is unavailable.

## RED/GREEN report

| Behavior | Test target | RED evidence | GREEN evidence |
| --- | --- | --- | --- |
| Resolve `PROV + AMP + TUMBOL` through `dbo.TUMBOL` | `backend/tests/unit/eligible-factory-candidates.repository.test.ts` | Focused test failed: expected `ตำบลหาดอาษา อำเภอสรรพยา`, received `ตำบล7 อำเภอ4` | Focused test passed after repository lookup and mapper wiring |
| Use master names and suppress unresolved numeric codes | `backend/tests/unit/fac-import.mapper.test.ts` | Covered by the repository RED at the response-mapping seam | Focused mapper tests passed for both resolved and unresolved cases |

## Validation

- `npm test -- --runInBand tests/unit/fac-import.mapper.test.ts tests/unit/eligible-factory-candidates.repository.test.ts` — PASS.
- `npm run typecheck` — PASS.
- Focused coverage: repository 90.51% lines and mapper 94.79% lines.
