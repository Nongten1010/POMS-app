# TDD Evidence: Officer Notification Email Recipients

## Source and journeys

No plan file was provided. The feature request was: an Admin can add more than one officer notification email.

1. As an Admin, I can create a province recipient with multiple email addresses.
2. As an Admin, I can list recipient configurations before editing them.
3. As an Admin, I can add one address to an existing recipient without losing earlier addresses.
4. As an Admin, I receive a useful conflict response rather than an internal error when creating a duplicate recipient.

## RED/GREEN evidence

| Journey | Test | RED evidence | GREEN evidence |
| --- | --- | --- | --- |
| Create a multiple-email recipient | `officer-notification-email-recipients.route.test.ts` | `POST /api/v1/officer-notification-email-recipients` returned `404` because the route did not exist | Route returned `201 Created` after the initial implementation |
| List recipient configurations | same route test | Compile-time RED: mocked public service had no `list` behavior | Route returned `200 OK` with recipient array |
| Add an email to an existing recipient | same route test | Compile-time RED: service had no `addEmail` behavior | Route returned `200 OK` with both existing and new addresses |
| Create a duplicate recipient | `officer-notification-email-recipients.service.test.ts` | Repository duplicate-key error was passed through unchanged | Service maps SQL Server duplicate keys to `409 CONFLICT` |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | Admin can create a province recipient with two valid email addresses | `backend/tests/unit/officer-notification-email-recipients.route.test.ts` | Route integration | PASS |
| 2 | Admin can read existing recipient configurations | `backend/tests/unit/officer-notification-email-recipients.route.test.ts` | Route integration | PASS |
| 3 | Admin can add an email without replacing existing emails | `backend/tests/unit/officer-notification-email-recipients.route.test.ts` | Route integration | PASS |
| 4 | Duplicate recipient creation returns a conflict | `backend/tests/unit/officer-notification-email-recipients.service.test.ts` | Service | PASS |

## Validation

- `npm test -- --runInBand tests/unit/officer-notification-email-recipients.route.test.ts tests/unit/officer-notification-email-recipients.service.test.ts` — PASS: 2 suites, 4 tests.
- Database migration is not required: migration `0061_create_officer_notification_email_recipients` already stores `emails_json` as a JSON array.
- No frontend or browser E2E change was made because the request is implemented as an Admin backend/API contract only.
