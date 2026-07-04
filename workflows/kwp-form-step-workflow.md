# KWP Form Step Workflow

## Trigger

A factory operator submits one of the KWP forms, `KWP01` through `KWP05`.

## Goal

Move each กวภ.01-05 submission through a backend-owned workflow so the UI can render the same steps and actions for every form type without inferring state from labels.

## Actors

- Factory operator: submits the form.
- KWP officer: starts review, requests revision, or approves the form.

## Runtime Flow

1. Submit form.
   - Existing create endpoints store `kwp_form_submissions.status = SUBMITTED`.
   - Existing create endpoints insert the initial `kwp_form_status_history` row.
2. Start review.
   - Officer calls `POST /api/v1/kwp-form-submissions/:id/workflow-actions`.
   - Payload: `{ "action": "START_REVIEW", "officerNote": "..." }`.
   - Backend changes status to `UNDER_REVIEW`.
3. Request revision.
   - Officer calls the same action endpoint.
   - Payload: `{ "action": "REQUEST_REVISION", "revisionReason": "...", "officerNote": "..." }`.
   - `revisionReason` is required.
   - Backend changes status to `REVISION_REQUESTED`.
   - The note is recorded in `kwp_form_status_history.note` and surfaced as the latest `revisionReason`.
4. Return to review after revision.
   - The workflow allows `START_REVIEW` from `REVISION_REQUESTED`.
   - Backend changes status back to `UNDER_REVIEW`.
   - Because the response reads status history, the `REVISION_REQUESTED` step remains `DONE` instead of being marked `SKIPPED`.
5. Approve.
   - Officer calls the same action endpoint.
   - Payload: `{ "action": "APPROVE", "officerNote": "..." }`.
   - Backend changes status to `APPROVED`.

## Step Mapping

| Status | Current step | Allowed actions |
| --- | --- | --- |
| `SUBMITTED` | `SUBMITTED` / ส่งฟอร์ม | `START_REVIEW`, `REQUEST_REVISION` |
| `UNDER_REVIEW` | `OFFICER_REVIEW` / พิจารณา | `REQUEST_REVISION`, `APPROVE` |
| `REVISION_REQUESTED` | `REVISION_REQUESTED` / ส่งแก้ไข | `START_REVIEW` |
| `APPROVED` | `APPROVED` / ผ่านการพิจารณา | none |

Terminal or unsupported statuses such as `REJECTED` and `CANCELLED` return no allowed actions.

## Public Interface

- `GET /api/v1/kwp-form-submissions/:id/workflow`
  - Permission: `kwp_forms:view`
  - Returns `currentStep`, `steps`, and `allowedActions`.
- `POST /api/v1/kwp-form-submissions/:id/workflow-actions`
  - Permission: `kwp_forms:approve`
  - Applies one workflow action and returns the updated workflow state.

## Checkpoint

The only human checkpoint is the officer decision at the action endpoint. The response is a concise workflow brief: current status, current step, all steps, and allowed next actions.
