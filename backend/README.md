# POMS Backend

Backend API สำหรับ **POMS (Plant Operations Monitoring System)** — ระบบตรวจวัด/มอนิเตอร์โรงงาน
รับข้อมูลจาก sensor (ผ่าน HTTP gateway), จัดการ user / สิทธิ์, และให้ React frontend เรียก API

## Tech Stack

| Layer        | Choice                                    |
| ------------ | ----------------------------------------- |
| Runtime      | Node.js 20+                               |
| Language     | TypeScript                                |
| Framework    | Express 5                                 |
| Database     | Microsoft SQL Server (MSSQL)              |
| DB Access    | `mssql` driver + Knex query builder       |
| Auth         | JWT (access + refresh token), bcrypt      |
| Validation   | Zod                                       |
| Logging      | Winston (daily-rotated file logs)         |
| Tests        | Jest + Supertest                          |
| Deployment   | Windows Server                            |

## Production deploy

Production backend deploys are handled by GitHub Actions on pushes to `main`.
The deploy workflow runs `npm run typecheck`, `npm test`, and `npm run build`,
then updates `C:\apps\POMS-app\backend`, restarts `poms-app-backend`, and checks
`http://127.0.0.1:3000/health`.
The production Windows service name is `poms-app-backend`.
Backend verification reuses the production `.env` on the server without storing
secrets in Git.
The workflow falls back to the previous local commit when a rerun cannot access
the original push range.
The runner marks the checked-out workspace as a trusted Git directory before
detecting changed paths.
Production dependencies are prepared in `C:\apps\POMS-app\backend-release`
before the running backend service is stopped and updated.
Run `npm run db:migrate` after backend deploys that include new migration files.

## Project Structure

```
backend/
├── src/
│   ├── config/              # env, db, logger configuration
│   ├── shared/              # ของกลางที่ใช้ร่วมกันทุก module
│   │   ├── middlewares/     # auth, rbac, error-handler, etc.
│   │   ├── utils/           # password, jwt, response helpers
│   │   ├── errors/          # custom error classes
│   │   └── types/           # shared TS types
│   ├── modules/             # feature modules
│   │   ├── auth/            # login, logout, refresh token
│   │   ├── connection-requests/ # CEMS/WPMS connection request workflow
│   │   ├── device-connections/  # device connection settings + mock connection test
│   │   ├── eligible-factories/  # selected eligible factory management
│   │   ├── users/           # user CRUD
│   │   └── roles/           # role + permission (RBAC)
│   ├── db/
│   │   ├── migrations/      # Knex migrations
│   │   └── seeds/           # seed data
│   ├── app.ts               # Express app configuration
│   └── server.ts            # entry point (boot HTTP server)
├── tests/
│   ├── unit/                # unit tests
│   └── integration/         # API integration tests (supertest)
├── docs/                    # docs (architecture, API spec, etc.)
├── logs/                    # runtime log output (gitignored)
├── scripts/                 # utility scripts
├── .env.example             # template สำหรับ .env
├── knexfile.ts              # Knex CLI config
└── PROGRESS.md              # log บันทึก dev session แต่ละครั้ง
```

### Module convention

แต่ละ feature module มีไฟล์เหล่านี้ (เพิ่มตามต้องการ):

```
modules/<feature>/
├── <feature>.routes.ts        # Express router
├── <feature>.controller.ts    # request/response handler
├── <feature>.service.ts       # business logic
├── <feature>.repository.ts    # data access (Knex/mssql)
├── <feature>.validator.ts     # Zod schemas
└── <feature>.types.ts         # TypeScript types/DTOs
```

## Getting Started

### 1. Prerequisites

- Node.js 20+
- MSSQL Server (local หรือ remote)
- npm 10+

### 2. Setup

```bash
# install dependencies
npm install

# create .env from template
cp .env.example .env
# แก้ค่าใน .env ให้ตรงกับ environment ของคุณ

# run migrations (after creating migration files)
npm run db:migrate

# seed initial data (optional)
npm run db:seed
```

### 3. Development

```bash
npm run dev           # start dev server with hot-reload (tsx watch)
npm run lint          # ESLint check
npm run format        # Prettier format
npm run typecheck     # TypeScript type check
npm test              # run Jest tests
```

### 4. Production build

```bash
npm run build         # compile to dist/
npm start             # run compiled server
```

## Available Scripts

| Script                    | Description                                |
| ------------------------- | ------------------------------------------ |
| `npm run dev`             | Dev server with hot-reload                 |
| `npm run build`           | Compile TypeScript to `dist/`              |
| `npm start`               | Run compiled production server             |
| `npm test`                | Run unit + integration tests               |
| `npm run test:watch`      | Run tests in watch mode                    |
| `npm run test:coverage`   | Generate coverage report                   |
| `npm run lint`            | ESLint check                               |
| `npm run lint:fix`        | ESLint auto-fix                            |
| `npm run format`          | Prettier write                             |
| `npm run typecheck`       | TypeScript type check (no emit)            |
| `npm run db:migrate`      | Run pending migrations                     |
| `npm run db:migrate:make` | Generate a new migration file              |
| `npm run db:rollback`     | Rollback last migration batch              |
| `npm run db:seed`         | Run seed files                             |

## Roadmap

- [x] Project skeleton + tooling
- [x] Auth module (login, JWT, refresh token)
- [x] User management (CRUD)
- [x] Role + permission (RBAC)
- [x] Eligible factory selection API
- [x] CEMS/WPMS connection request API (เพิ่มจุดตรวจวัด + status workflow)
- [x] Device connection config API (Modbus RTU/TCP, MSSQL, MySQL + mock test)
- [x] Parameter values query API (อ่านจาก `PARAMETER_DB_*` / `ingest.S0001_data_*`)
- [ ] Sensor data ingestion API (HTTP POST from gateway)
- [ ] Real-time dashboard channel (Socket.IO) — _future_
- [ ] Alerts / threshold rules — _future_
- [ ] Reporting & historical query API — _future_

ดูความคืบหน้าและ decision log ละเอียดที่ [PROGRESS.md](./PROGRESS.md)
