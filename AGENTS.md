# AGENTS.md

Rules for AI assistants and contributors working in this repository.

## Scope Rules

- Backend work must stay under `backend/`.
- Frontend work must stay under `frontend/`.
- Documentation-only work may edit `README.md`, `AGENTS.md`, or files under `docs/`.
- Do not edit both `backend/` and `frontend/` in the same change unless the user explicitly asks for a cross-stack change.
- Do not move, delete, rename, or replace files across `backend/` and `frontend/` without explicit confirmation.
- Do not edit application code unless the user explicitly asks to modify code, implement, fix, update, or wire the UI/API/backend/frontend.
- If the user asks to "ปรับ md", "ทำ md", "อัพใน md", "แก้เอกสาร", or only mentions Markdown/docs, edit only Markdown files under `docs/`, `README.md`, `AGENTS.md`, or explicitly named `.md` files.
- Do not infer that a screenshot, UI description, or desired field list is permission to edit frontend code. Explain the needed code change first and wait for explicit approval before touching application code.
- If a request could require both code and documentation, ask for confirmation before changing code.
- When the user says "เล่าก่อน", "อธิบายก่อน", "ดูให้ก่อน", or "วางแผนก่อน", do not edit files until the user explicitly approves implementation.
- For request-form field changes in this project, work in the backend contract/validation and Markdown documentation only. Do not edit `frontend/` in any case unless the user explicitly says the exact phrase "แก้ frontend ด้วย".
- Mentions of "หน้าขอเชื่อมต่อ", screenshots, field labels, or missing inputs describe the desired backend/API contract unless the user explicitly says "แก้ frontend ด้วย".

## Backend Documentation

- `docs/backend/` is the canonical home and the only entry point for active backend documentation shared with frontend, backend, and QA.
- `NOTES.md` and `workflows/*.md` are the only location exceptions: they are the skill-managed workspace for `loop-me`, not published backend/API documentation, and must be linked from the backend hub when relevant.
- Backend owns and maintains these documents. API pages must be understandable to frontend consumers while also linking backend maintainers to implementation sources, tests, and deeper explanations.
- Place every new active backend Markdown document in exactly one of these categories: `docs/backend/api/`, `docs/backend/explanations/`, `docs/backend/guides/`, or `docs/backend/evidence/`.
- Organize `docs/backend/api/` around user-facing menus or business capabilities, not backend module names. A menu document may aggregate endpoints from multiple backend modules and should link back to each implementation source.
- Divide API documentation into `docs/backend/api/menus/` for user-facing menus, `docs/backend/api/shared/` for cross-cutting APIs, and `docs/backend/api/integrations/` for external-system contracts.
- Give every documented menu a stable directory under `docs/backend/api/menus/` with `README.md` as its landing page. Keep a small menu in that single file; split a large menu into focused subpages linked from the landing page.
- Structure each menu landing page for two readers without duplicating the contract: give frontend a quick start and endpoint contract first, then give backend maintainers links to routes, validators, types, tests, explanations, and evidence.
- Use English kebab-case for documentation directories and filenames, Thai for display headings and prose, and exact code identifiers for methods, paths, fields, statuses, permissions, and error codes. Do not maintain duplicate full-page Thai and English versions.
- For each endpoint, include field tables and one minimal request/response JSON example. Put copy-paste curl in the menu quick start and add endpoint-specific curl only for special flows such as uploads or complex authentication. Define shared error envelopes once and link to them.
- Start new menu and endpoint documents from the templates indexed under `docs/backend/guides/documentation/`.
- Do not add manually maintained `Last updated` fields or per-file changelogs. Use Git history for normal changes and update `docs/backend/api/CHANGELOG.md` only for breaking API changes, including impact, migration steps, and links to affected canonical pages.
- Use `docs/backend/archive/` only for historical material. Archived documents are not an API contract or a current implementation reference.
- Do not create or maintain copies of backend contracts in `APIDoc/`, `docs/APIDoc/`, `backend/docs/`, or `frontend/md/`. During migration, those locations may contain only legacy files, archive material, or short links to the canonical document.
- Make every active backend document reachable from `docs/backend/README.md` through its category indexes; an unindexed or orphan document is not part of the maintained documentation set.
- Link to a canonical document instead of copying its content into another file.
- Every change that touches `backend/` must declare its documentation impact in the PR or change summary: either `Docs impact: updated` with canonical document links, or `Docs impact: none` with a concrete reason.
- Use the machine-readable PR fields exactly as documented: `Docs impact`, `Canonical docs`, `Reason`, `Client impact`, and `Breaking change`. When `Breaking change: yes`, link the matching entry in `docs/backend/api/CHANGELOG.md`.
- Backend changes must go through a pull request into protected `main`; do not push backend changes directly to `main`. Required code and documentation checks must pass before merge, after which the existing `main` push workflow may deploy.
- Run the docs guard in transition mode until legacy migration is complete: enforce PR declarations, reject new Markdown in legacy backend-doc locations, and validate links/orphans under `docs/backend/` without failing on untouched legacy files. Switch to strict whole-repository placement checks after migration.
- Do not edit the frozen legacy backend-contract copies under `frontend/md/` listed in the migration workflow. Update canonical backend docs instead; frontend-only Markdown remains outside this freeze.
- The sole backend owner may self-review documentation impact after required CI checks; do not require a second backend approval. Add a reviewer who owns the consuming client when a client-visible API contract changes: use a frontend reviewer for frontend-consumed APIs and the relevant integration owner for external APIs.
- Any client-visible API change requires `Docs impact: updated`, including backward-compatible additions such as an optional field, a new endpoint, or a new error code. Use `Docs impact: none` only when request, response, authentication, permission, validation, status, error, and observable behavior are unchanged.
- Canonical API documents are the published contract, while code and tests are executable behavior. If they disagree, treat the mismatch as a defect and do not merge until both are aligned or the requirement is explicitly revised.

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
