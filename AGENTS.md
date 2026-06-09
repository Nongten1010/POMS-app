# AGENTS.md

Rules for AI assistants and contributors working in this repository.

## Scope Rules

- Backend work must stay under `backend/`.
- Frontend work must stay under `frontend/`.
- Documentation-only work may edit `README.md`, `AGENTS.md`, or files under `docs/`.
- Do not edit both `backend/` and `frontend/` in the same change unless the user explicitly asks for a cross-stack change.
- Do not move, delete, rename, or replace files across `backend/` and `frontend/` without explicit confirmation.

## Backend Tasks

When the user asks for backend work:

- Inspect and modify only `backend/` unless documentation updates are needed.
- Do not edit `frontend/`.
- For any parameter/value response contract, include the unit together with the
  parameter display name whenever the API returns human-readable parameter
  labels or parameter-keyed maps. Prefer labels such as `BOD (mg/l)`,
  `COD (mg/l)`, `CO2 (ppm)`, or `CO (%)` instead of bare names like `BOD`,
  `COD`, `CO2`, or `CO`, so clients can distinguish parameters that share a
  similar name but use different units.
- If a response must keep machine-stable parameter codes for compatibility,
  also return a human-readable label/display name that includes the unit.
- Parameter status fields for each measured value, such as `co2_status`,
  `co_status`, `bod_status`, or `cod_status`, must use one of these statuses:
  `Normal`, `Calibration`, `Defective`, `Maintenance`, `Start up`,
  `Shut Down`, `Turnaround`, or `Etc.`.
- Prefer these checks before finishing when relevant:

```bash
cd backend
npm run typecheck
npm test
```

## Frontend Tasks

When the user asks for frontend work:

- Inspect and modify only `frontend/` unless documentation updates are needed.
- Do not edit `backend/`.
- Use the frontend project's own package scripts after the frontend project is added.

## Secrets And Generated Files

Never commit:

- `.env` or real environment files
- `node_modules/`
- `dist/`
- `coverage/`
- runtime logs
- real passwords, tokens, Client IDs, private keys, or production credentials

## Before Commit

Before committing or pushing:

- Run `git status --short`.
- Confirm changed paths are inside the requested scope.
- Summarize changed paths to the user.
- If unexpected files changed, stop and ask before committing.

## Branch Naming

Use clear branch prefixes:

```text
backend/feature-name
frontend/feature-name
docs/topic-name
```
