$ErrorActionPreference = 'Stop'
$repo = 'C:\apps\POMS-app'
$backend = Join-Path $repo 'backend'
$front = 'C:\sites\poms'
Write-Host ('Backend service: ' + (Get-Service 'poms-app-backend').Status)
foreach ($item in @(
  @{ Path = (Join-Path $backend '.env'); Keys = @('ELIGIBLE_OPERATOR_ACCESS_ENABLED', 'FACTORY_STATUS_SYNC_ENABLED', 'FACTORY_STATUS_SYNC_HOUR', 'FACTORY_STATUS_MAX_AGE_SECONDS') },
  @{ Path = (Join-Path $repo 'frontend\.env.production'); Keys = @('VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED') }
)) {
  $lines = [IO.File]::ReadAllLines($item.Path)
  foreach ($key in $item.Keys) {
    $matches = @($lines | Where-Object { $_ -match ('^\s*' + [regex]::Escape($key) + '\s*=') })
    if ($matches.Count -gt 1) { throw "Duplicate allowlisted configuration: $key" }
    $value = if ($matches.Count) { ($matches[0] -split '=', 2)[1].Trim() } else { '<default>' }
    if ($value -notmatch '^(true|false|[0-9]+|<default>)$') { throw "Unexpected value for $key" }
    Write-Host "$key=$value"
  }
}
foreach ($marker in @((Join-Path $backend 'DEPLOYED_SHA.txt'), (Join-Path $front 'DEPLOYED_SHA.txt'))) {
  if (Test-Path $marker) { Get-Content $marker | Where-Object { $_ -match '^(sha|run_id|deployed_at)=' } | Write-Host }
}
$configPath = "$env:windir\System32\inetsrv\config\applicationHost.config"
[xml]$config = [IO.File]::ReadAllText($configPath)
$sites = $config.configuration.'system.applicationHost'.sites
foreach ($site in $sites.site) {
  $bindings = @($site.bindings.binding | ForEach-Object { $_.bindingInformation })
  $roots = @($site.application.virtualDirectory | ForEach-Object { $_.physicalPath })
  Write-Host (ConvertTo-Json -Compress -Depth 5 ([ordered]@{
    site = $site.name; id = $site.id; bindings = $bindings; roots = $roots
    logFile = $site.logFile.OuterXml; defaultLogFile = $sites.siteDefaults.logFile.OuterXml
  }))
}
Write-Host ('IIS tracing enabled locations: ' + @($config.configuration.location | Where-Object { $_.'system.webServer'.tracing.traceFailedRequests.add }).Count)
$canary = 'poms-access-audit-' + $env:AUDIT_RUN_ID
try { Invoke-WebRequest -UseBasicParsing -Uri ("https://d-poms.diw.go.th/api/v1/eligible-factories/1/operator-access/candidates?query=$canary") -TimeoutSec 20 | Out-Null } catch {
  if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw 'Access-log probe did not return the expected unauthenticated response.' }
}
& netsh http flush logbuffer | Out-Null
$roots = @('C:\inetpub\logs\LogFiles')
foreach ($site in $sites.site) {
  if ($site.logFile.directory) { $roots += [Environment]::ExpandEnvironmentVariables($site.logFile.directory) }
}
if ($sites.siteDefaults.logFile.directory) { $roots += [Environment]::ExpandEnvironmentVariables($sites.siteDefaults.logFile.directory) }
foreach ($root in ($roots | Select-Object -Unique)) {
  if (!(Test-Path $root)) { continue }
  foreach ($file in (Get-ChildItem $root -Filter '*.log' -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 6)) {
    $header = [string](Get-Content $file.FullName -TotalCount 10 | Where-Object { $_ -like '#Fields:*' } | Select-Object -Last 1)
    $tail = Get-Content $file.FullName -Tail 3000
    Write-Host (ConvertTo-Json -Compress ([ordered]@{ log = $file.Name; siteDirectory = $file.Directory.Name; fields = $header; canaryQueryMatches = @($tail | Where-Object { $_.Contains($canary) }).Count; operatorPathMatches = @($tail | Where-Object { $_.Contains('/operator-access/candidates') }).Count }))
  }
}
Push-Location $backend
try {
  @'
(async () => {
  const { db } = require('./dist/config/database');
  const { factorySourceDb, factorySourceTableName } = require('./dist/config/factory-source-database');
  try {
    const eligible = await db('eligible_factories').whereNull('deleted_at').count({ count: '*' });
    const grants = await db('user_eligible_factory_access').select('status').count({ count: '*' }).groupBy('status');
    const source = await factorySourceDb(factorySourceTableName()).select('FFLAG').first().timeout(10000);
    const runs = await db('eligible_factory_status_runs').select('run_key','status','checked_count','failed_count','finished_at').orderBy('run_key','desc').limit(2);
    console.log(JSON.stringify({eligibleCount:eligible[0].count,grantCounts:grants,sourceReachable:!!source,runs}));
  } finally { await Promise.all([db.destroy(),factorySourceDb.destroy()]); }
})().catch(() => { console.error('Production readiness database probe failed; connection details withheld.'); process.exitCode=1; });
'@ | node
  if ($LASTEXITCODE -ne 0) { throw 'Database readiness probe failed.' }
} finally { Pop-Location }
