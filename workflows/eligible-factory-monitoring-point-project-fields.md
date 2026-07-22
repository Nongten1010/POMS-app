# Eligible Factory Monitoring Point Project Fields Workflow

## Status

Implemented — requirement grilling and the approved TDD workflow are complete.

## Trigger

An authorized officer creates or edits a record through the “เพิ่ม/แก้ไข ข้อมูลจุดตรวจวัด” form used by the “โรงงานที่เข้าข่าย” capability.

## Goal

Allow the officer to save and reload the project-related factory fields in the monitoring-point form with the same meaning and validation as the connection-request form.

## Confirmed Scope

- Backend contract, validation, persistence, synchronization to `eligible_factories`, tests, and canonical backend documentation.
- The affected public endpoints are:
  - `POST /api/v1/monitoring-point-forms`
  - `PUT /api/v1/monitoring-point-forms/:id`
  - `GET /api/v1/monitoring-point-forms`
  - `GET /api/v1/monitoring-point-forms/:id`
- The new data belongs to the form-level `factory` object, matching the factory-profile fields of a connection request; it does not belong to an individual `points[]` item.
- Existing records without the new data remain readable and return `null` values.
- Frontend changes are out of scope unless the user explicitly says “แก้ frontend ด้วย”.

## Public Interface

The monitoring-point-form contract exposes these nullable fields under `factory`:

| Field | Type | Rule |
| --- | --- | --- |
| `projectName` | `string \| null` | Trim whitespace; blank becomes `null`; maximum 500 characters. |
| `eiaOther` | `string \| null` | Same semantic as the connection-request field labelled “ระบุ”; required and non-blank only when existing `eiaInfo` is `อื่นๆ`, otherwise normalized to `null`; maximum 500 characters. |

The create, update, list, and detail responses round-trip both fields under `data.factory` or `data[].factory`.

## Runtime Flow

1. The officer opens a new or existing monitoring-point form.
2. The API returns the stored factory-level `projectName` and “ระบุ” value for prefill.
3. The officer saves the form through `POST` or `PUT`.
4. The backend trims and validates the fields, then stores them in `factory_monitoring_point_forms` in the same transaction as the rest of the form.
5. If the form is linked or linkable to an active row in `eligible_factories`, the backend synchronizes non-null values to that eligible-factory row through the existing form-sync path.
   - A blank or omitted `projectName` is stored as `null` in the monitoring form but preserves the eligible factory's current project name.
   - A blank or omitted `eiaInfo` preserves all current eligible-factory EIA fields.
   - A recognized non-blank `eiaInfo` replaces the eligible-factory EIA selection; `eiaOther` is written only for `อื่นๆ` and cleared for every other recognized selection.
   - A legacy free-text `eiaInfo` remains stored in the monitoring form but does not partially update eligible-factory EIA fields.
6. The response returns the stored values so create/edit clients do not have to infer them.

## TDD Verification

Execute one vertical slice at a time in this order:

1. **Validator round-trip** — RED: the public save schema does not accept the two fields or enforce conditional `eiaOther`; GREEN: add optional, trimmed fields and the connection-request-compatible conditional rule.
2. **Persistence round-trip** — RED: repository create/update/read tests cannot round-trip the fields; GREEN: add nullable database columns and repository mappings so create, update, list, and detail return them.
3. **Eligible-factory synchronization** — RED: service/repository tests show non-null form values are not synchronized and null values can overwrite current eligible data; GREEN: add patch mappings with the resolved overwrite semantics.
4. **Route-level contract** — RED: authenticated `POST`/`PUT` behavior does not expose the new contract; GREEN: verify request validation and response shape through the public HTTP handlers.
5. **Documentation and regression** — update the canonical eligible-factories menu contract, run focused suites after every slice, then run backend typecheck and the full test suite.

## Open Decisions

None.

## Resolved Decisions

1. “ระบุ” means the factory-level `eiaOther` field used by the connection-request contract. It is required and non-blank when the EIA selection is `อื่นๆ`; for all other selections it is stored and returned as `null`.
2. Keep the existing monitoring-form field `factory.eiaInfo` as the EIA selection field for backward compatibility. Add only `factory.eiaOther` and `factory.projectName`; do not rename `eiaInfo` to `eia` in this contract.
3. Synchronization to `eligible_factories` uses patch semantics. Null or omitted project/EIA values preserve the current eligible-factory values, while the monitoring form itself may store `null`. A recognized explicit EIA selection replaces the eligible-factory selection and normalizes `eiaOther` according to that selection.

## Completion Condition

Complete when migration `0077`, the public contract, persistence, eligible-factory patch synchronization, tests, and canonical documentation are aligned. The completed verification is:

- Backend typecheck passed.
- Focused project-field suites passed: 7 suites / 42 tests.
- Full backend suite passed: 81 suites / 726 tests.
- Lint completed with no errors; repository-wide pre-existing formatting warnings remain outside this workflow.
