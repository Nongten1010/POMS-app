# Windows Backend Deployment Notes

Production backend currently runs as a Windows service:

```text
Service id: poms-app-backend
Working directory: C:\apps\POMS-app\backend
Entrypoint: dist\server.js
```

## Important: stop the service before `npm ci`

Do not run `npm ci` while `poms-app-backend` is running.

The running Node process can hold native dependency files open, especially:

```text
C:\apps\POMS-app\backend\node_modules\bcrypt\prebuilds\win32-x64\bcrypt.node
```

If the service is still running, `npm ci` can fail with:

```text
EPERM: operation not permitted, unlink ... bcrypt.node
```

After that failure, `node_modules/.bin` may be missing or incomplete, which then causes follow-up commands to fail:

```text
'rimraf' is not recognized
'tsc' is not recognized
'knex' is not recognized
```

That is not a code/build error. It means dependency installation did not finish.

## Safe deploy sequence

Run PowerShell as Administrator on the server:

```powershell
cd C:\apps\POMS-app

net stop poms-app-backend

git pull origin main

cd backend
npm ci
npm run build
npm run db:migrate

net start poms-app-backend
```

If `net stop` says the service is not running, continue.

If `npm ci` still fails with `EPERM`, check for another process holding files:

```powershell
Get-Process node -ErrorAction SilentlyContinue
```

Only stop processes you know belong to this backend service.

## Database migration reminder

Run migrations against the server's real `.env` and database. Do not copy local `.env` to the server.

The eligible factory feature requires migration:

```text
0017_create_eligible_factories.ts
```

This creates the `eligible_factories` table used to store factories selected as eligible.

## External DIW factory source

For real candidate factory data, configure the server `.env` with:

```env
FACTORY_SOURCE_MODE=external
FACTORY_DB_HOST=<sql-server-host-or-ip>
FACTORY_DB_PORT=1433
FACTORY_DB_NAME=diw
FACTORY_DB_USER=<username>
FACTORY_DB_PASSWORD=<password>
FACTORY_DB_ENCRYPT=false
FACTORY_DB_TRUST_SERVER_CERTIFICATE=true
FACTORY_DB_SCHEMA=dbo
FACTORY_DB_TABLE=fac_import
```

If `diw` is on the same SQL Server and uses the same credentials as POMS, these can match the main `DB_*` values except `FACTORY_DB_NAME=diw`.

Do not commit the server `.env`.
