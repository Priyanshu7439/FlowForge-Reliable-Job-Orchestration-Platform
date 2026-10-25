param(
  [switch] $TestProcessRunner
)

$ErrorActionPreference = 'Continue'

Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

function Write-Section([string] $title) {
  Write-Output "`n=== $title ==="
}

function ConvertTo-WindowsProcessArgument {
  param([AllowEmptyString()][string] $Argument)

  $builder = [System.Text.StringBuilder]::new()
  [void] $builder.Append('"')
  $backslashCount = 0
  foreach ($character in $Argument.ToCharArray()) {
    if ($character -eq '\\') {
      $backslashCount++
      continue
    }
    if ($character -eq '"') {
      for ($index = 0; $index -lt (2 * $backslashCount + 1); $index++) {
        [void] $builder.Append('\\')
      }
      [void] $builder.Append('"')
      $backslashCount = 0
      continue
    }
    for ($index = 0; $index -lt $backslashCount; $index++) {
      [void] $builder.Append('\\')
    }
    [void] $builder.Append($character)
    $backslashCount = 0
  }
  for ($index = 0; $index -lt (2 * $backslashCount); $index++) {
    [void] $builder.Append('\\')
  }
  [void] $builder.Append('"')
  return $builder.ToString()
}

function ConvertTo-SafeWindowsProcessArgument {
  param([AllowEmptyString()][string] $Argument)

  $builder = [System.Text.StringBuilder]::new()
  [void] $builder.Append('"')
  $backslashCount = 0
  foreach ($character in $Argument.ToCharArray()) {
    if ($character -eq [char]92) {
      $backslashCount++
      continue
    }
    if ($character -eq '"') {
      for ($index = 0; $index -lt (2 * $backslashCount + 1); $index++) {
        [void] $builder.Append([char]92)
      }
      [void] $builder.Append('"')
      $backslashCount = 0
      continue
    }
    for ($index = 0; $index -lt $backslashCount; $index++) {
      [void] $builder.Append([char]92)
    }
    [void] $builder.Append($character)
    $backslashCount = 0
  }
  for ($index = 0; $index -lt (2 * $backslashCount); $index++) {
    [void] $builder.Append([char]92)
  }
  [void] $builder.Append('"')
  return $builder.ToString()
}

function Invoke-BoundedProcess {
  param(
    [Parameter(Mandatory = $true)][string] $FilePath,
    [Parameter(Mandatory = $true)][string[]] $ArgumentList,
    [int] $TimeoutMilliseconds = 15000
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $FilePath
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true
  $startInfo.Arguments = (($ArgumentList | ForEach-Object { ConvertTo-SafeWindowsProcessArgument $_ }) -join ' ')

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    [void] $process.Start()
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
      Write-Output "TIMEOUT after ${TimeoutMilliseconds}ms: $FilePath $($ArgumentList -join ' ')"
      $process.Kill()
      return
    }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    if ($stdout) { $stdout.TrimEnd() | Write-Output }
    if ($stderr) { $stderr.TrimEnd() | Write-Output }
    Write-Output "EXIT_CODE=$($process.ExitCode)"
  } catch {
    Write-Output "PROCESS_ERROR: $($_.Exception.Message)"
  } finally {
    $process.Dispose()
  }
}

if ($TestProcessRunner) {
  Write-Section 'Process runner self-test'
  $powerShell = Join-Path $PSHOME 'powershell.exe'
  Invoke-BoundedProcess $powerShell @('-NoProfile', '-Command', 'Write-Output FLOWFORGE PROCESS RUNNER OK') 5000
  exit 0
}

function Invoke-HttpProbe {
  param(
    [Parameter(Mandatory = $true)][string] $Name,
    [Parameter(Mandatory = $true)][string] $Uri,
    [Microsoft.PowerShell.Commands.WebRequestSession] $Session
  )

  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $request = @{
      Uri = $Uri
      Method = 'Get'
      TimeoutSec = 8
      UseBasicParsing = $true
      ErrorAction = 'Stop'
    }
    if ($Session) { $request.WebSession = $Session }
    $response = Invoke-WebRequest @request
    $timer.Stop()
    $body = $response.Content
    if ($body.Length -gt 500) { $body = $body.Substring(0, 500) + '...' }
    Write-Output "$Name STATUS=$($response.StatusCode) MS=$($timer.ElapsedMilliseconds) BODY=$body"
  } catch {
    $timer.Stop()
    $status = $_.Exception.Response.StatusCode.value__
    if (-not $status) { $status = 'NO_HTTP_STATUS' }
    Write-Output "$Name STATUS=$status MS=$($timer.ElapsedMilliseconds) ERROR=$($_.Exception.Message)"
  }
}

$docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $docker) {
  $docker = 'docker'
}

Write-Section 'Execution context'
Write-Output "DIRECTORY=$(Get-Location)"
Write-Output "IDENTITY=$(whoami)"
Write-Output 'Secrets and full environment values are not printed.'

Write-Section 'Compose status'
Invoke-BoundedProcess $docker @('compose', 'ps')

Write-Section 'Recent service logs'
Invoke-BoundedProcess $docker @('compose', 'logs', '--no-color', '--tail=120', 'api', 'worker', 'migrate')

Write-Section 'Redis from API container'
$redisProbe = @'
const Redis = require('ioredis');
const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 0, enableOfflineQueue: false });
const timer = setTimeout(() => { console.error('REDIS_TIMEOUT'); process.exit(2); }, 5000);
client.connect().then(() => client.ping()).then((value) => { clearTimeout(timer); console.log(`REDIS_PING=${value}`); return client.quit(); }).catch((error) => { clearTimeout(timer); console.error(`REDIS_ERROR=${error instanceof Error ? error.message : 'unknown error'}`); client.disconnect(); process.exit(1); });
'@
Invoke-BoundedProcess $docker @('compose', 'exec', '-T', 'api', 'node', '-e', $redisProbe) 10000

Write-Section 'Prisma migration status from API container'
Invoke-BoundedProcess $docker @('compose', 'exec', '-T', 'api', 'npx', 'prisma', 'migrate', 'status', '--schema', 'database/prisma/schema.prisma') 20000

Write-Section 'PostgreSQL schema checks'
$tableQuery = 'SELECT to_regclass(''public."OutboxEvent"'') AS outbox_table, (SELECT COUNT(*) FROM "_prisma_migrations") AS migration_rows;'
Invoke-BoundedProcess $docker @('compose', 'exec', '-T', 'postgres', 'psql', '-U', 'flowforge', '-d', 'flowforge', '-Atc', $tableQuery) 10000

Write-Section 'Public API health'
Invoke-HttpProbe 'LIVE' 'http://localhost:4000/health/live'
Invoke-HttpProbe 'SYSTEM_HEALTH' 'http://localhost:4000/api/v1/system/health'

$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
if ($env:FLOWFORGE_DEMO_EMAIL -and $env:FLOWFORGE_DEMO_PASSWORD) {
  Write-Section 'Optional authenticated session'
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $login = Invoke-WebRequest -Uri 'http://localhost:4000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body (@{ email = $env:FLOWFORGE_DEMO_EMAIL; password = $env:FLOWFORGE_DEMO_PASSWORD } | ConvertTo-Json -Compress) -WebSession $session -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    $timer.Stop()
    Write-Output "LOGIN STATUS=$($login.StatusCode) MS=$($timer.ElapsedMilliseconds) BODY=REDACTED"
  } catch {
    $timer.Stop()
    $status = $_.Exception.Response.StatusCode.value__
    if (-not $status) { $status = 'NO_HTTP_STATUS' }
    Write-Output "LOGIN STATUS=$status MS=$($timer.ElapsedMilliseconds) ERROR=$($_.Exception.Message)"
  }
} else {
  Write-Output 'LOGIN NOT_ATTEMPTED: set FLOWFORGE_DEMO_EMAIL and FLOWFORGE_DEMO_PASSWORD to test the existing seeded account; values are never printed.'
}

Write-Section 'Dashboard, account, and topology API probes'
Invoke-HttpProbe 'DASHBOARD_SUMMARY' 'http://localhost:4000/api/v1/dashboard/summary' $session
Invoke-HttpProbe 'ACCOUNT_ME' 'http://localhost:4000/api/v1/auth/me' $session
Invoke-HttpProbe 'TOPOLOGY_HEALTH' 'http://localhost:4000/api/v1/system/health' $session
