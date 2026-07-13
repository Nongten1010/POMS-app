# Add-measurement-point production capacity unit — TDD evidence

## User journey

As an officer, I can submit a CEMS add-measurement-point request with capacity and its unit as separate fields.

## Evidence

| Guarantee | Test | RED | GREEN |
| --- | --- | --- | --- |
| `productionCapacityUnit` is CEMS-only, matching `productionCapacity`. | `backend/tests/unit/connection-requests.validator.test.ts` | The test failed because a WPMS payload did not receive an issue for `measurementPoints[0].details.productionCapacityUnit`. | The same targeted test passed after adding the field to the CEMS-only validation set. |

The request persists its `details` object as JSON and returns the same object in connection-request reads, so the new field requires no schema migration or separate response mapper.

## Validation

- `npm test -- --runInBand tests/unit/connection-requests.validator.test.ts`
- `npm run typecheck`

The full backend suite was also run from clean `origin/main`: 44 suites and 468 tests passed. One unrelated officer-notification route suite timed out while attempting an external MSSQL connection, so it is not used as evidence for this contract change.
