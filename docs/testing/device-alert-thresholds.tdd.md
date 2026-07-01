# Device Alert Thresholds TDD Evidence

## Source Plan

Journeys were derived from the request to add `Alert(Low)` and `Alert(High)` to device settings.

## User Journeys

- As an operator, I want to save per-parameter alert low/high thresholds in device settings, so that the saved device config includes warning thresholds with each channel.
- As an integration consumer, I want device config APIs to return alert low/high thresholds, so that external readers can use the same alert thresholds as POMS.

## Task Report

| Behavior | RED evidence | GREEN evidence | Guarantee |
| --- | --- | --- | --- |
| Validator accepts and normalizes optional channel thresholds | `npm test -- --runTestsByPath tests/unit/device-connections.validator.test.ts tests/unit/integration-device-configs.service.test.ts` failed because `alertLow` was unknown and validator rejected new fields | `npm test -- --runTestsByPath tests/unit/device-connections.validator.test.ts tests/unit/integration-device-configs.service.test.ts tests/unit/integration-device-configs.route.test.ts` passed `20/20` | Structured and legacy device setup payloads can carry `alertLow`/`alertHigh`, and inverted thresholds are rejected |
| Integration device-config response exposes thresholds | Same RED run failed at TypeScript compile: `alertLow` did not exist on `DeviceMeasurementChannelInput` | Targeted integration service and route tests passed | `parameterConfigs[]` returns `alertLow`/`alertHigh` as numbers or `null` |
| Request/current device config prefill keeps thresholds available | Not separate RED; covered by type expansion and prefill mapping in the same change | `npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts tests/unit/connected-measurement-points.route.test.ts` passed `55/55` | Backend form detail exposes thresholds in `parameterMappings` and `rawConfigs.channels` |

## Test Specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Modbus channels accept numeric `alertLow` and `alertHigh` | `tests/unit/device-connections.validator.test.ts` | unit | PASS | targeted Jest |
| 2 | Legacy form payload string thresholds normalize to numbers | `tests/unit/device-connections.validator.test.ts` | unit | PASS | targeted Jest |
| 3 | `alertLow > alertHigh` is rejected | `tests/unit/device-connections.validator.test.ts` | unit | PASS | targeted Jest |
| 4 | Integration `parameterConfigs[]` includes threshold fields | `tests/unit/integration-device-configs.service.test.ts` | unit | PASS | targeted Jest |
| 5 | Integration route returns threshold fields through response body | `tests/unit/integration-device-configs.route.test.ts` | integration | PASS | targeted Jest |

## Coverage And Known Gaps

`npm run test:coverage -- --runTestsByPath ...` passed for the targeted suite with `75/75` tests, but the reported global coverage was `21.79%` because Jest includes the whole backend and migrations in the coverage denominator for this command. No frontend tests were added because this change intentionally stayed backend/docs-only per project scope rules.

## Merge Evidence

- RED: targeted validator/integration test run failed for the intended missing contract.
- GREEN: targeted suite passed `20/20`, expanded affected suite passed `75/75`, full `npm test` passed `333/333`, `npm run typecheck` passed, and `npm run build` passed.
