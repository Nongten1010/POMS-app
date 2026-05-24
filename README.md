# POMS App

Monorepo for the POMS project.

```text
backend/   Real backend project
frontend/  Frontend workspace, currently empty until the frontend work is added
docs/      Project notes
```

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

## Frontend

The frontend folder is intentionally empty for now. Add the frontend project under:

```text
frontend/
```

Do not commit `.env`, `node_modules`, `dist`, `coverage`, or runtime logs.

