# POMS App

Monorepo for the POMS project.

```text
backend/   Real backend project
frontend/  Frontend workspace, currently empty until the frontend work is added
docs/      Project notes
```

## Work Boundaries

Read `AGENTS.md` before using AI tools or starting changes. Backend work stays in `backend/`; frontend work stays in `frontend/`. Do not edit both sides in one change unless the task explicitly requires it.

## Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

Useful backend commands:

```bash
npm run build
npm run typecheck
npm test
```

## Windows Service

The backend service config is stored at:

```text
backend/deploy/windows/poms-app-backend.winsw.xml
```

The service id is:

```text
poms-app-backend
```

## Frontend

The frontend folder is intentionally empty for now. Add the frontend project under:

```text
frontend/
```

Do not commit `.env`, `node_modules`, `dist`, `coverage`, or runtime logs.
