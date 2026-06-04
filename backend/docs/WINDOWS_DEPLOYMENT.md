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

The eligible factory, CEMS/WPMS connection request, and device connection config features require migrations:

```text
0017_create_eligible_factories.ts
0019_create_cems_wpms_connection_requests.ts
0020_create_device_connection_configs.ts
```

These create:
- `eligible_factories` for factories selected as eligible
- `cems_wpms_connection_requests` for request form state
- `cems_wpms_measurement_points` for requested monitoring points
- `cems_wpms_request_status_history` for status audit trail
- `device_connection_configs` for Modbus RTU/TCP, MSSQL, and MySQL connection settings
- `device_measurement_channels` for multiple measurement devices under one connection point

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

## External parameter ingestion source

For the SQL Server account/table used to receive parameter values, configure a separate user, password, and table name in `.env`:

```env
PARAMETER_DB_HOST=localhost
PARAMETER_DB_PORT=1433
PARAMETER_DB_NAME=parameter_ingest
PARAMETER_DB_USER=parameter_ingest_user
PARAMETER_DB_PASSWORD=<parameter-ingest-password>
PARAMETER_DB_ENCRYPT=false
PARAMETER_DB_TRUST_SERVER_CERTIFICATE=true
PARAMETER_DB_SCHEMA=ingest
PARAMETER_DB_TABLE=parameter_values
```

If the parameter table is on another SQL Server/database, override the connection target:

```env
PARAMETER_DB_HOST=<sql-server-host-or-ip>
PARAMETER_DB_PORT=1433
PARAMETER_DB_NAME=<database-name>
```

This only configures the connection details. It does not create the database or parameter table.

Do not commit the server `.env`.
