# TDD Evidence: monitoring-point legal-annex validation

## User journey

As an officer, I can record annex numbers only for a CEMS point governed by either specified ministerial notification, so that an annex number cannot be saved for another legal basis or a WPMS point.

## Evidence

| Guarantee | Test target | Result |
| --- | --- | --- |
| Each specified notification accepts `legalAnnexNo` for CEMS | `monitoring-point-forms.validator.test.ts` | PASS |
| Another CEMS legal basis rejects `legalAnnexNo` | `monitoring-point-forms.validator.test.ts` | PASS |
| WPMS rejects `legalAnnexNo` | `monitoring-point-forms.validator.test.ts` | PASS |

RED command: `npm test -- --runInBand tests/unit/monitoring-point-forms.validator.test.ts`

RED result: 2 failed / 9 passed. The validator accepted annex numbers for a non-eligible CEMS notification and WPMS.

GREEN command: `npm test -- --runInBand tests/unit/monitoring-point-forms.validator.test.ts`

GREEN result: 11 passed.

Additional verification: `npm run typecheck` passed.

Targeted coverage command: `npm run test:coverage -- --runInBand tests/unit/monitoring-point-forms.validator.test.ts` passed. `monitoring-point-forms.validator.ts` reported 81.25% lines and 81.81% functions; its 62.06% branch figure includes existing generic optional-field normalizers outside this change. Repository-wide coverage is not meaningful for this targeted run because Jest includes the full backend source tree.
