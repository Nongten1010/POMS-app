# D-POMS Frontend Skill

Instructions for AI coding agents. Follow these rules to reduce common LLM coding mistakes and keep changes small, predictable, safe, and easy to review.

Use this skill when working on the D-POMS frontend application. It captures the project context, expected workflow, file organization, and implementation rules for agents and developers.

## Tech Stack

- Vite
- React
- Material UI
- MUI Icons
- Emotion, through MUI

Use MUI components and the `sx` prop as the default styling approach. Keep custom CSS minimal and only use it for global document rules.

## Project Overview

D-POMS is a frontend application for importing, collecting, processing, and presenting pollution-related data from factories across Thailand.

The system works with data from multiple sources:

- External APIs
- Manual data entry
- User-submitted forms
- Internal sample data used for development and UI testing

Core business workflows include:

- Approval flows
- Permission and authorization flows
- User and role-based access management
- Review states for submitted forms and factory data
- Data correction and resubmission flows

Primary UI surfaces include:

- Maps, especially Longdo Map-based views
- Forms for data entry, review, approval, and correction
- Tables for dense operational data
- Charts and graphs for summaries, trends, and pollution metrics
- Status chips, action buttons, and workflow indicators

Implementation implication:

- Treat the product as an operational system, not a marketing website.
- Prioritize readability, clear status communication, efficient workflows, and high-density data presentation.
- UI choices should support repeated daily use by administrators, reviewers, factories, and related internal users.

## Folder Structure

Use this structure for frontend source files:

```text
src/
  pages/
    .gitkeep
  components/
    .gitkeep
  datas/
    .gitkeep
```

### `pages`

Use `src/pages` for page-level screens. A page should compose components, connect page-specific data, and define the layout for a route or major view.

Examples:

- `DashboardPage.jsx`
- `RequestListPage.jsx`
- `RequestDetailPage.jsx`

Guidelines:

- Keep page files focused on screen composition.
- Avoid putting reusable UI primitives directly in page files.
- Move repeated page sections into `components`.

### `components`

Use `src/components` for reusable UI components shared across pages.

Examples:

- `StatusChip.jsx`
- `ActionButton.jsx`
- `SectionSurface.jsx`
- `DataTable.jsx`

Guidelines:

- Prefer MUI components and `sx`.
- Keep components reusable and prop-driven.
- Do not hard-code page-specific business data in shared components.

### `datas`

Use `src/datas` for sample data files used for local development, UI testing, and mock screens.

Examples:

- `requests.js`
- `statusOptions.js`
- `factories.js`

Guidelines:

- Store mock arrays, option lists, and sample objects here.
- Do not put production API clients or network calls in `datas`.
- Keep test data realistic enough to validate table density, long Thai labels, empty states, and status colors.

## Implementation Notes

When adding new UI, follow these rules:

- Use the color tokens and component patterns in `DESIGN.md` as the source of truth.
- Keep operational screens dense, readable, and practical.
- Prefer MUI components before creating custom components.
- Keep spacing consistent with `Stack`, `Grid`, and MUI theme spacing.
- Use status colors only for state labels.
- Use action type colors only for buttons or controls that trigger a workflow action.
- Keep all new screens consistent with `DESIGN.md` unless the product requirements say otherwise.

## API Reference Workflow

When a request involves APIs, authentication, request bodies, response bodies, headers, permissions, roles, access tokens, or the API Documentation page:

- Read `API.md` before making changes.
- Treat `API.md` as the source of truth for endpoint URLs, request/response shapes, field names, data dictionaries, role codes, permission keys, and permission data scopes.
- Keep UI examples, mock request bodies, API test payloads, and documentation tables consistent with `API.md`.
- If the user provides new API details, update `API.md` first or in the same change as the related UI/code update.
- Do not infer API fields from memory when `API.md` can answer the question.

## UI Quality Rules

- Use clear labels for forms, buttons, filters, tabs, table actions, and workflow actions.
- Ensure Thai text, long labels, status chips, buttons, table cells, form fields, maps, and charts do not overflow or overlap.
- Preserve keyboard-accessible controls when using MUI components.
- Show validation, loading, empty, and error states near the relevant field, table, chart, map, or action.
- Keep dense screens scannable with clear hierarchy, spacing, alignment, and status communication.

## Operating Principles

- Prefer caution, clarity, and small reviewable edits over speed.
- For trivial tasks, use judgment and avoid unnecessary process.
- Do not guess when the codebase can answer the question.
- Do not hide uncertainty. State assumptions and ask when ambiguity could cause risky changes.
- If multiple interpretations exist, choose the smallest reasonable one and mention the assumption.
- If a simpler approach exists, say so.
- Push back when the requested approach is unnecessarily complex or risky.

## Simplicity Rules

- Implement only what was requested.
- Do not add speculative features.
- Do not add abstractions for single-use code.
- Do not add configurability, flexibility, or extension points unless requested.
- Do not add error handling for impossible or unrealistic scenarios.
- Do not add new dependencies unless necessary. Explain why an existing tool or pattern is insufficient.
- If the solution becomes larger than necessary, simplify it.

Use this check:

> Would a senior engineer say this is overcomplicated?

If yes, reduce the scope or rewrite smaller.

## Safety Rules

- Do not expose, print, modify, or commit secrets, API keys, tokens, credentials, or `.env` values unless explicitly required.
- Do not install new packages, run network-dependent commands, or change lockfiles unless necessary for the task. Explain why when the need is not obvious.
- Do not commit, push, create branches, open pull requests, or change remote state unless explicitly requested.
- Do not run destructive commands, delete files, or rewrite history unless the request clearly requires it.
- Do not overwrite, revert, or remove user changes unless explicitly asked.
- If unrelated changes are present, leave them intact and work around them when possible.

## GitHub Push Workflow

Only run this workflow when the user explicitly asks to push, publish, deploy to GitHub, or gives a direct GitHub push instruction. Do not commit, push, create branches, open pull requests, or change remote state during normal implementation work.

Current target used for this project:

- Repository: `git@github.com:Nongten1010/POMS-app.git`
- Branch: `main`
- Destination folder in the repository: `frontend`

Required information before pushing:

- Repository URL
- Target branch
- Destination folder or path inside the repository
- Whether to push directly or open a pull request
- Commit message, or a concise message inferred from the requested work when the user does not provide one

Recommended push steps:

1. Confirm the local project is ready.
   - Run relevant validation first, usually `npm run lint` and `npm run build`.
   - Do not include `node_modules`, `dist`, `.DS_Store`, local env files, or generated build artifacts.

2. Check remote access.
   - Use `git ls-remote --heads <repo-url> <branch>` to confirm SSH access and that the branch exists.
   - If access fails, stop and report the blocker.

3. Clone the target repository into a temporary directory.
   - Example: `git clone --branch main git@github.com:Nongten1010/POMS-app.git /tmp/poms-app-push.<suffix>`
   - Do not initialize this standalone frontend folder as a separate git repository when the target repository already exists.

4. Inspect the target repository before syncing.
   - Run `git status -sb`.
   - Inspect the destination folder, for example `frontend`.
   - If the destination folder contains existing files beyond placeholders, check the diff carefully before overwriting anything.

5. Sync the frontend project into the destination folder.
   - Use a scoped sync that excludes local-only and generated files.
   - Example:

```bash
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.DS_Store' \
  /path/to/local/frontend/ \
  /tmp/poms-app-push.<suffix>/frontend/
```

6. Validate inside the cloned repository destination.
   - Run `npm ci` in `frontend` when dependencies are not installed.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Report warnings such as Vite bundle-size warnings, but they do not block push unless they indicate a real failure.

7. Stage only the intended destination folder.
   - Prefer `git add frontend`.
   - Check `git status -sb` and `git diff --cached --stat` before committing.
   - Do not stage unrelated backend, docs, root, or user changes.

8. Commit and push.
   - Commit with a concise message, for example `Update frontend app`.
   - Push to the requested branch: `git push origin main`.
   - If branch protection, authentication, or remote rejection blocks the push, stop and report the exact blocker.

9. Report the result.
   - Include repository, branch, destination folder, commit hash, validation results, and any warnings.

## Change Scope Rules

Touch only what is necessary for the request.

When editing existing code:

- Read the directly related files first.
- For large repositories, do not read the entire codebase unless necessary. Start with the files directly related to the request.
- Prefer targeted search tools such as `rg` before broad exploration.
- Inspect nearby patterns before introducing new ones.
- Match existing style, naming, structure, and conventions.
- Reuse existing utilities, theme tokens, MUI components, and folder conventions when applicable.
- Do not refactor unrelated code.
- Do not improve adjacent code, comments, formatting, or structure unless required.
- Do not rename, move, or delete files unless required by the request.
- Do not edit generated files, build artifacts, or vendored code unless the request explicitly requires it.
- Do not add large binary files unless necessary for the task.
- If unrelated dead code is found, mention it but do not remove it.

When your changes create unused code:

- Remove imports, variables, functions, files, or branches made unused by your change.
- Do not remove pre-existing dead code unless explicitly asked.

Every intentional change should trace directly to the user's request or to a cleanup required by that change.

## Required Workflow

### 1. Inspect

Before editing:

- Read the page, component, data file, theme file, test, config, or module directly related to the request.
- Confirm codebase structure from files instead of guessing.
- Check nearby implementation patterns.
- Check current relevant changes when working in a dirty worktree, so you do not overwrite user work.

### 2. Plan

Before editing, state a short plan:

- Files expected to change.
- Purpose of each change.
- Assumptions, if the request is ambiguous.
- Validation you expect to run.

For multi-step work, use:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

### 3. Edit

While editing:

- Make the smallest complete change.
- Keep changes scoped to the requested behavior or UI.
- Preserve existing public behavior unless the request changes it.
- Avoid unrelated refactors and cleanup.
- Remove only unused code created by your own changes.
- Add or update tests when the behavior is important, bug-prone, or already covered by nearby tests.

### 4. Verify

Turn the task into verifiable success criteria.

Examples:

- "Add validation" -> add/update tests for invalid inputs, then make them pass.
- "Fix bug" -> reproduce with a test or clear check, then make it pass.
- "Refactor X" -> ensure relevant tests pass before and after when practical.
- "Change UI" -> check layout, text overflow, responsive behavior, and visual side effects.

Run validation commands relevant to this frontend project when available. Common examples:

```bash
npm run lint
npm run build
npm test # only if a test script exists
```

Use other validation commands only if they already exist in the project.

Also check:

- Imports
- Component props
- Type errors
- Responsive layout
- Visual side effects
- UI text overflow
- Design system colors and styling

For UI changes, use visual verification when practical:

- Check the affected page or component in a browser.
- Verify responsive layouts at relevant screen sizes.
- Use screenshots when visual regressions are likely.

If a validation command is missing, unavailable, too slow, or cannot be run:

- State which validation was skipped.
- Explain why.
- Run the closest practical alternative when one exists.
- Mention any risk created by skipped validation or visual checks.
- Stop or report any long-running processes started during verification when they are no longer needed.

### 5. Report

After finishing, summarize briefly:

- Files changed.
- What changed in plain language.
- Validation results.
- Anything not completed.
- Remaining risks, if any.

Keep the final response concise and focused on what changed, what was verified, and what the user should know next.

## Definition of Done

A task is done when:

- The requested behavior is implemented.
- The diff is small and directly related to the request.
- Existing project patterns are preserved.
- Relevant tests were added or updated when appropriate.
- Relevant validation has passed or the reason it could not run is stated.
- No unrelated user changes were overwritten or removed.
- No secrets or credentials were exposed.
- Any remaining risk is clearly reported.
