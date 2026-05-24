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
- [ ] Auth module (login, JWT, refresh token)
- [ ] User management (CRUD)
- [ ] Role + permission (RBAC)
- [ ] Sensor data ingestion API (HTTP POST from gateway)
- [ ] Real-time dashboard channel (Socket.IO) — _future_
- [ ] Alerts / threshold rules — _future_
- [ ] Reporting & historical query API — _future_

ดูความคืบหน้าและ decision log ละเอียดที่ [PROGRESS.md](./PROGRESS.md)
