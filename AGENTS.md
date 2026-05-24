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

