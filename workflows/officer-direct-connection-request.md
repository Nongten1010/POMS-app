# Officer Direct Connection Request Workflow

Status: Implemented and verified

## Goal

Allow an authenticated and authorized officer to register exactly one CEMS/WPMS measurement point with an officer-supplied point code. A successful submission creates a normal request history record and immediately materializes the point as currently connected, without using the operator review/confirmation lifecycle.

## Trigger

An officer submits the direct-connection request form to the dedicated backend endpoint.

## Actor

An authenticated POMS officer or administrator who has the dedicated direct-connection permission and whose location scope permits the selected factory.

The initial permission grant is limited to roles `monitoring_kpm` and `admin`. No other officer role inherits this capability automatically.

## API Contract

- Method: `POST`
- Resource: `/api/v1/cems-wpms-requests/direct-connections`
- Authentication: bearer access token
- Authorization: dedicated permission; the operator-shared `cems_wpms_requests:edit` permission is insufficient
- Success: `201 Created` with a `Location` header for the new request
- Duplicate active point code: `409 Conflict`
- Invalid payload: the existing project validation-error envelope with field paths

The client supplies factory/contact/notification/measurement-point form fields and must supply exactly one `measurementPoints[]` item with a non-empty `pointCode`. The client does not control `requestType`, `status`, `statusLabel`, `submissionSource`, `verifiedAt`, or audit identities.

## Server-Owned Values

- `requestType = ADD_MEASUREMENT_POINT`
- `status = CONNECTED`
- `statusLabel = เชื่อมต่อแล้ว`
- `submissionSource = OFFICER_DIRECT_API`
- `verifiedAt = current server time`
- `createdBy` and `updatedBy` come from the authenticated actor

## Request Numbering

- CEMS uses a yearly sequence isolated from normal requests: `OLDC-YY-#####`.
- WPMS uses a yearly sequence isolated from normal requests: `OLDW-YY-#####`.
- `YY` is the final two digits of the Buddhist year calculated in the `Asia/Bangkok` timezone.
- CEMS and WPMS sequences are independent and reset when `YY` changes.
- Concurrent requests must reserve numbers safely; numbering must not use an unlocked `COUNT + 1` implementation.

## Atomic Persistence

One database transaction must either create every record below or create none:

1. `cems_wpms_connection_requests`
   - direct request number
   - `ADD_MEASUREMENT_POINT`
   - `CONNECTED`
   - `verified_at`
   - persisted direct-submission source
   - officer audit identity
2. `cems_wpms_request_factory_snapshots`
3. `cems_wpms_measurement_points`
4. `cems_wpms_request_status_history`
   - a `CONNECTED` entry explaining that an officer created a direct connection
5. `cems_wpms_connected_measurement_points`
   - active/current rows linked back to the new request and request measurement points

The direct flow must not create a false intermediate operator submission, design review, connection deadline, or operator confirmation.

## Validation And Conflicts

- Reuse the existing CEMS/WPMS form-section validation where it applies.
- Require every direct measurement point to have a trimmed point code within the existing database length.
- Do not require an `S`/`P` prefix or a numeric shape; the officer supplies the canonical code.
- Reject duplicate point names or codes within the payload.
- Reject a point code that is already active in `cems_wpms_connected_measurement_points`; do not soft-delete or replace the existing point through this create endpoint.
- Validate the selected factory against the officer's permission and regional/location scope before mutation.
- Version 1 does not introduce an idempotency key. Replaying a completed submission with the
  same active point code returns `409 Conflict` through the active-point uniqueness rule.

## Observable Result

After `201 Created`:

- the request appears in the existing request list/detail APIs;
- its Thai status label is `เชื่อมต่อแล้ว`;
- every new point appears in existing connected-measurement-point APIs;
- later add-parameter and point-detail operations can resolve the point through its supplied point code;
- audit/history can distinguish this route from an operator submission.

This endpoint does not create `device_connection_configs` or device measurement channels. Device settings remain a separate operation.

## Failure Rules

- No valid bearer token: `401 Unauthorized`.
- Authenticated actor without direct-connection permission or location scope: `403 Forbidden`.
- Unknown/ineligible factory: `404 Not Found` or the repository's established scoped-not-found behavior.
- Invalid request fields: project-standard validation response.
- Duplicate active point code: `409 Conflict`.
- Any persistence failure rolls back the request, history, measurement points, and connected-point rows together.

## Resolved Decisions

- Direct request numbers use five-digit yearly sequences: `OLDC-YY-#####` and `OLDW-YY-#####`.
- Initial access is limited to roles `monitoring_kpm` and `admin` through a dedicated permission.
- Officer-supplied point codes have no CEMS/WPMS prefix rule; they are non-empty trimmed values within the existing column length.
- An active duplicate point code returns `409 Conflict` and is never replaced by this endpoint.
- Each request creates exactly one measurement point.
- Device configuration is outside this endpoint.

## Verification Evidence

- TDD RED checkpoint: the direct-connection contract tests failed before production code existed.
- GREEN checkpoint: all backend tests pass (`66` suites, `654` tests).
- Added executable lines covered by tests: `93.6%` (`147/157`).
- Full-repository line coverage is `53.85%`; the legacy baseline remains below the project-wide `80%` target.
- TypeScript typecheck and production build pass.
- ESLint completes with no errors; remaining warnings are existing project-wide formatting/style debt.
- Production dependency audit has no high or critical findings. The audit still reports one low-severity transitive `body-parser` advisory; the full development tree also contains one high-severity `brace-expansion` advisory in tooling.
