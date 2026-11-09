$ErrorActionPreference = 'Stop'
$action = $env:CONTROL_ACTION
if ($action -notin @('enable', 'verify', 'disable')) { throw 'Unsupported production action.' }
$backend = 'C:\apps\POMS-app\backend'
$backendEnv = Join-Path $backend '.env'
$frontendEnv = 'C:\apps\POMS-app\frontend\.env.production'
$patcher = Join-Path $env:GITHUB_WORKSPACE '.github\scripts\eligible-operator-env.cjs'
Add-Type -Path "$env:windir\System32\inetsrv\Microsoft.Web.Administration.dll"

function Test-PrivateAccessLogging {
  $manager = New-Object Microsoft.Web.Administration.ServerManager
  try {
    $site = $manager.Sites['POMS']
    if (!$site -or $site.Applications['/'].VirtualDirectories['/'].PhysicalPath -ne 'C:\sites\poms') { throw 'Unexpected IIS site.' }
    $logMode = [string]$manager.GetApplicationHostConfiguration().GetSection('system.applicationHost/log').GetAttributeValue('centralLogFileMode')
    if ($logMode -ne 'Site') { throw 'Central IIS logging needs a separate privacy review.' }
    if (!$site.LogFile.Enabled -or [string]$site.LogFile.LogFormat -ne 'W3C') { throw 'Expected active W3C site logging.' }
    if ($site.TraceFailedRequestsLogging.Enabled) { throw 'Disable or review failed-request tracing before enabling candidate search.' }
    $custom = $site.GetChildElement('logFile').GetChildElement('customFields').GetCollection()
    if ($custom.Count -gt 0) { throw 'Custom IIS access fields need a separate privacy review.' }
    return [int]$site.LogFile.LogExtFileFlags
  } finally { $manager.Dispose() }
}

function Test-PrivateAccessProbe {
$canary = 'poms-private-audit-' + $env:AUDIT_RUN_ID
try {
  Invoke-WebRequest -UseBasicParsing -Headers @{ Referer = "https://d-poms.diw.go.th/?query=$canary" } -Uri ("https://d-poms.diw.go.th/api/v1/eligible-factories/1/operator-access/candidates?query=$canary") -TimeoutSec 20 | Out-Null
  throw 'Unauthenticated operator search unexpectedly succeeded.'
} catch {
  if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw 'Unauthenticated operator search did not return 401.' }
}
& netsh http flush logbuffer | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot flush IIS logs for verification.' }
Start-Sleep -Seconds 2
$manager = New-Object Microsoft.Web.Administration.ServerManager
try { $logRoot = [Environment]::ExpandEnvironmentVariables($manager.Sites['POMS'].LogFile.Directory) } finally { $manager.Dispose() }
$latest = Get-ChildItem (Join-Path $logRoot 'W3SVC2') -Filter '*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$latest) { throw 'No POMS access log available.' }
$lines = @(Get-Content $latest.FullName -Tail 5000)
$headerIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -like '#Fields:*') { $headerIndex = $i } }
if ($headerIndex -lt 0 -or $lines[$headerIndex] -match 'cs-uri-query|cs\(Referer\)') { throw 'IIS has not started a private log segment.' }
if (@($lines | Where-Object { $_.Contains($canary) }).Count) { throw 'Canary query/referrer leaked into access logs.' }
$segment = @($lines | Select-Object -Skip ($headerIndex + 1))
$probeLogged = @($segment | Where-Object { $_ -match '/operator-access/candidates' -and $_ -match '\s401\s' }).Count -gt 0
if (!$probeLogged) { throw 'Cannot confirm the protected probe in the new IIS log segment.' }
Write-Host 'IIS probe confirmed: request path and 401 logged; query and Referer canaries absent.'
}

$initialFlags = Test-PrivateAccessLogging
if ($action -ne 'verify') {
  $backup = Join-Path 'C:\apps\POMS-backups' ('operator-access-' + $env:AUDIT_RUN_ID + '-' + (Get-Date -Format 'yyyyMMddHHmmss'))
  New-Item -ItemType Directory -Path $backup | Out-Null
  & icacls $backup /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot protect the configuration backup.' }
  Copy-Item -LiteralPath $backendEnv -Destination (Join-Path $backup 'backend.env')
  Copy-Item -LiteralPath $frontendEnv -Destination (Join-Path $backup 'frontend.env.production')
  [string]$initialFlags | Set-Content (Join-Path $backup 'iis-log-flags.txt')
  Copy-Item "$env:windir\System32\inetsrv\config\applicationHost.config" (Join-Path $backup 'applicationHost.config')
  Write-Host "Protected backup: $backup"
  $manager = New-Object Microsoft.Web.Administration.ServerManager
  try {
    $site = $manager.Sites['POMS']
    $privateFields = [int][Microsoft.Web.Administration.LogExtFileFlags]::UriQuery -bor [int][Microsoft.Web.Administration.LogExtFileFlags]::Referer
    $site.LogFile.LogExtFileFlags = [Microsoft.Web.Administration.LogExtFileFlags]($initialFlags -band (-bnot $privateFields))
    $manager.CommitChanges()
  } finally { $manager.Dispose() }
  Test-PrivateAccessProbe
  try {
    $mode = if ($action -eq 'enable') { 'backend' } else { 'disable-backend' }
    & node $patcher $mode $backendEnv
    if ($LASTEXITCODE -ne 0) { throw 'Cannot patch backend switches.' }
    $mode = if ($action -eq 'enable') { 'frontend' } else { 'disable-frontend' }
    & node $patcher $mode $frontendEnv
    if ($LASTEXITCODE -ne 0) { throw 'Cannot patch frontend switch.' }
    Restart-Service -Name 'poms-app-backend' -Force
    (Get-Service 'poms-app-backend').WaitForStatus('Running', '00:00:30')
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      try {
        $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 5
        $contract = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/openapi.json' -TimeoutSec 5
        $expected = $action -eq 'enable'
        if ($health.success -and $contract.'x-poms-eligible-operator-access-enabled' -eq $expected -and $contract.'x-poms-factory-status-sync-enabled' -eq $expected) { $ready = $true; break }
      } catch { }
      Start-Sleep -Seconds 2
    }
    if (!$ready) { throw 'Runtime did not confirm the requested feature switches.' }
  } catch {
    Copy-Item (Join-Path $backup 'backend.env') $backendEnv -Force
    Copy-Item (Join-Path $backup 'frontend.env.production') $frontendEnv -Force
    Restart-Service -Name 'poms-app-backend' -Force
    throw 'Activation failed; environment files restored and backend restarted. Private access logging remains enabled.'
  }
}

$currentFlags = Test-PrivateAccessLogging
$privateFields = [int][Microsoft.Web.Administration.LogExtFileFlags]::UriQuery -bor [int][Microsoft.Web.Administration.LogExtFileFlags]::Referer
if (($currentFlags -band $privateFields) -ne 0) { throw 'Sensitive query/referrer logging is still enabled.' }
$contract = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/openapi.json' -TimeoutSec 10
Write-Host (ConvertTo-Json -Compress ([ordered]@{
  accessEnabled = $contract.'x-poms-eligible-operator-access-enabled'
  dailySyncEnabled = $contract.'x-poms-factory-status-sync-enabled'
  iisLogFields = [string][Microsoft.Web.Administration.LogExtFileFlags]$currentFlags
}))
Test-PrivateAccessProbe
Push-Location $backend
try {
  @'
(async () => {
  const {db}=require('./dist/config/database');
  const {factorySourceDb}=require('./dist/config/factory-source-database');
  try {
    const runs=await db('eligible_factory_status_runs').select('run_key','status','checked_count','failed_count','finished_at').orderBy('run_key','desc').limit(2);
    const statusCounts=await db('eligible_factory_source_status').select('flag','error_code').count({count:'*'}).groupBy('flag','error_code');
    const grantCounts=await db('user_eligible_factory_access').select('status').count({count:'*'}).groupBy('status');
    console.log(JSON.stringify({runs,statusCounts,grantCounts}));
  } finally { await Promise.all([db.destroy(),factorySourceDb.destroy()]); }
})().catch(()=>{ console.error('Status verification failed; details withheld.');process.exitCode=1; });
'@ | node
  if ($LASTEXITCODE -ne 0) { throw 'Status verification failed.' }
} finally { Pop-Location }
