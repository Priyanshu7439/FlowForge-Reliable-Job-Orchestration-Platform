[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://127.0.0.1:4400/api/v1',
  [int]$JobCount = 10,
  [int]$Concurrency = 1,
  [int]$PollIntervalMs = 100,
  [int]$PollTimeoutSeconds = 60,
  [switch]$VerifyAttempts,
  [switch]$SkipReliabilityChecks,
  [string]$OutputPath = 'docs/benchmark-run-results.json'
)

$ErrorActionPreference = 'Stop'
if ($JobCount -lt 1 -or $JobCount -gt 50) { throw 'JobCount must be between 1 and 50.' }
if ($Concurrency -lt 1 -or $Concurrency -gt 10) { throw 'Concurrency must be between 1 and 10.' }
if ($PollIntervalMs -lt 100 -or $PollIntervalMs -gt 5000) { throw 'PollIntervalMs must be between 100 and 5000.' }
if ([string]::IsNullOrWhiteSpace($env:BENCHMARK_EMAIL) -or [string]::IsNullOrWhiteSpace($env:BENCHMARK_PASSWORD)) {
  throw 'Set BENCHMARK_EMAIL and BENCHMARK_PASSWORD for the isolated benchmark account.'
}

function Invoke-ApiJson {
  param(
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [string]$Method,
    [string]$Path,
    [object]$Body
  )

  $request = @{ Uri = "$BaseUrl$Path"; Method = $Method; WebSession = $Session; UseBasicParsing = $true; TimeoutSec = 15 }
  if ($null -ne $Body) {
    $request.ContentType = 'application/json'
    $request.Body = $Body | ConvertTo-Json -Depth 10 -Compress
  }

  try {
    $response = Invoke-WebRequest @request
    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Body = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
    }
  } catch {
    $statusCode = 0
    if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
    $content = $null
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
      $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    [pscustomobject]@{
      StatusCode = $statusCode
      Body = if ($content) { $content | ConvertFrom-Json } else { $null }
    }
  }
}

function Get-Percentile {
  param([double[]]$Values, [double]$Percentile)
  if (!$Values -or $Values.Count -eq 0) { return $null }
  $sorted = @($Values | Sort-Object)
  $rank = [Math]::Ceiling($Percentile * $sorted.Count)
  return [Math]::Round([double]$sorted[[Math]::Max(0, [int]$rank - 1)], 3)
}

function Wait-ForTerminalJob {
  param(
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [string]$JobId
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($PollTimeoutSeconds)
  do {
    Start-Sleep -Milliseconds 100
    $response = Invoke-ApiJson -Session $Session -Method GET -Path "/jobs/$JobId"
    if ($response.StatusCode -ne 200) { throw "Job lookup failed with HTTP $($response.StatusCode)." }
    $job = $response.Body.job
    if (@('COMPLETED', 'FAILED', 'CANCELLED') -contains $job.status) { return $job }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Timed out waiting for job $JobId."
}

function Get-Attempts {
  param([Microsoft.PowerShell.Commands.WebRequestSession]$Session, [string]$JobId)
  $response = Invoke-ApiJson -Session $Session -Method GET -Path "/jobs/$JobId/attempts"
  if ($response.StatusCode -ne 200) { throw "Attempt lookup failed with HTTP $($response.StatusCode)." }
  return @($response.Body.attempts)
}

$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$login = Invoke-ApiJson -Session $session -Method POST -Path '/auth/login' -Body @{ email = $env:BENCHMARK_EMAIL; password = $env:BENCHMARK_PASSWORD }
if ($login.StatusCode -ne 200) { throw "Benchmark login failed with HTTP $($login.StatusCode)." }

$samples = [System.Collections.Generic.List[object]]::new()
$workerScript = @'
param($baseUrl, $email, $password, $indices, $pollTimeoutSeconds, $pollIntervalMs, $verifyAttempts)
$ErrorActionPreference = 'Stop'
$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
function Invoke-WorkerJson {
  param([string]$Method, [string]$Path, [object]$Body)
  $request = @{ Uri = "$baseUrl$Path"; Method = $Method; WebSession = $session; UseBasicParsing = $true; TimeoutSec = 15 }
  if ($null -ne $Body) { $request.ContentType = 'application/json'; $request.Body = $Body | ConvertTo-Json -Depth 10 -Compress }
  $response = Invoke-WebRequest @request
  [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Body = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null } }
}
$login = Invoke-WorkerJson -Method POST -Path '/auth/login' -Body @{ email = $email; password = $password }
if ($login.StatusCode -ne 200) { throw 'Benchmark login failed.' }
$results = [System.Collections.Generic.List[object]]::new()
foreach ($index in $indices) {
  $payload = @{ records = @(@{ name = "Benchmark-$index"; team = 'Performance' }); select = @('name') }
  $body = @{ type = 'JSON_TRANSFORM'; payload = $payload; idempotencyKey = "benchmark-$([guid]::NewGuid())" }
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $created = Invoke-WorkerJson -Method POST -Path '/jobs' -Body $body
  if ($created.StatusCode -ne 202) { throw "Job submission $index failed with HTTP $($created.StatusCode)." }
  $jobId = [string]$created.Body.job.id
  $enqueueMs = $timer.Elapsed.TotalMilliseconds
  $deadline = [DateTime]::UtcNow.AddSeconds($pollTimeoutSeconds)
  do {
    Start-Sleep -Milliseconds $pollIntervalMs
    $currentResponse = Invoke-WorkerJson -Method GET -Path "/jobs/$jobId"
    if ($currentResponse.StatusCode -ne 200) { throw "Job lookup $jobId failed with HTTP $($currentResponse.StatusCode)." }
    $final = $currentResponse.Body.job
    if (@('COMPLETED', 'FAILED', 'CANCELLED') -contains $final.status) { break }
  } while ([DateTime]::UtcNow -lt $deadline)
  $timer.Stop()
  if (@('COMPLETED', 'FAILED', 'CANCELLED') -notcontains $final.status) { throw "Timed out waiting for job $jobId." }
  $attempts = @()
  if ($verifyAttempts) {
    $attemptResponse = Invoke-WorkerJson -Method GET -Path "/jobs/$jobId/attempts"
    if ($attemptResponse.StatusCode -ne 200) { throw "Attempt lookup $jobId failed with HTTP $($attemptResponse.StatusCode)." }
    $attempts = @($attemptResponse.Body.attempts)
  }
  $results.Add([pscustomobject]@{
    sequence = $index
    jobId = $jobId
    taskType = 'JSON_TRANSFORM'
    status = [string]$final.status
    enqueueMs = [Math]::Round($enqueueMs, 3)
    endToEndMs = [Math]::Round($timer.Elapsed.TotalMilliseconds, 3)
    attemptCount = $attempts.Count
    resultPersisted = [bool]($final.resultSummary)
  })
}
$results
'@

$pool = [RunspaceFactory]::CreateRunspacePool(1, $Concurrency)
$pool.Open()
$pending = [System.Collections.Generic.List[object]]::new()
$assignments = @()
for ($slot = 0; $slot -lt $Concurrency; $slot++) { $assignments += ,([int[]]@()) }
for ($index = 1; $index -le $JobCount; $index++) {
  $slot = ($index - 1) % $Concurrency
  $assignments[$slot] = @($assignments[$slot] + $index)
}
$runStopwatch = [Diagnostics.Stopwatch]::StartNew()
try {
  for ($slot = 0; $slot -lt $Concurrency; $slot++) {
    $powerShell = [PowerShell]::Create()
    $powerShell.RunspacePool = $pool
    $null = $powerShell.AddScript($workerScript).AddArgument($BaseUrl).AddArgument($env:BENCHMARK_EMAIL).AddArgument($env:BENCHMARK_PASSWORD).AddArgument($assignments[$slot]).AddArgument($PollTimeoutSeconds).AddArgument($PollIntervalMs).AddArgument([bool]$VerifyAttempts)
    $pending.Add([pscustomobject]@{ PowerShell = $powerShell; Handle = $powerShell.BeginInvoke() })
  }
  foreach ($item in $pending) {
    foreach ($sample in @($item.PowerShell.EndInvoke($item.Handle))) { $samples.Add($sample) }
    $item.PowerShell.Dispose()
  }
} finally {
  $runStopwatch.Stop()
  $pool.Close()
  $pool.Dispose()
}
$orderedSamples = [System.Collections.Generic.List[object]]::new()
foreach ($sample in ($samples | Sort-Object sequence)) { $orderedSamples.Add($sample) }
$samples = $orderedSamples

$retry = [ordered]@{ status = 'NOT_MEASURED'; reason = 'Skipped for this bounded workload run.' }
$idempotency = [ordered]@{ status = 'NOT_MEASURED'; reason = 'Skipped for this bounded workload run.' }
if (-not $SkipReliabilityChecks) {
  $retryBody = @{ type = 'FAILURE_SIMULATION'; payload = @{ failUntilAttempt = 1 }; idempotencyKey = "benchmark-retry-$([guid]::NewGuid())" }
  $retryCreated = Invoke-ApiJson -Session $session -Method POST -Path '/jobs' -Body $retryBody
  if ($retryCreated.StatusCode -ne 202) { throw "Retry benchmark submission failed with HTTP $($retryCreated.StatusCode)." }
  $retryJob = Wait-ForTerminalJob -Session $session -JobId ([string]$retryCreated.Body.job.id)
  $retryAttempts = Get-Attempts -Session $session -JobId ([string]$retryCreated.Body.job.id)
  $retry = [ordered]@{ status = 'MEASURED'; jobId = [string]$retryCreated.Body.job.id; finalStatus = [string]$retryJob.status; attempts = $retryAttempts.Count; recovered = ($retryJob.status -eq 'COMPLETED'); attemptStatuses = @($retryAttempts | ForEach-Object { $_.status }) }

  $idempotencyKey = "benchmark-idempotency-$([guid]::NewGuid())"
  $idempotencyBody = @{ type = 'JSON_TRANSFORM'; payload = @{ records = @(@{ name = 'Idempotent' }) }; idempotencyKey = $idempotencyKey }
  $first = Invoke-ApiJson -Session $session -Method POST -Path '/jobs' -Body $idempotencyBody
  $second = Invoke-ApiJson -Session $session -Method POST -Path '/jobs' -Body $idempotencyBody
  $conflictBody = @{ type = 'JSON_TRANSFORM'; payload = @{ records = @(@{ name = 'Conflict' }) }; idempotencyKey = $idempotencyKey }
  $conflict = Invoke-ApiJson -Session $session -Method POST -Path '/jobs' -Body $conflictBody
  $idempotency = [ordered]@{ status = 'MEASURED'; firstStatus = $first.StatusCode; secondStatus = $second.StatusCode; sameJobId = ([string]$first.Body.job.id -eq [string]$second.Body.job.id); conflictStatus = $conflict.StatusCode; duplicateSuppressed = ([string]$first.Body.job.id -eq [string]$second.Body.job.id -and $conflict.StatusCode -eq 409) }
}

$latencies = @($samples | ForEach-Object { [double]$_.endToEndMs })
$completed = @($samples | Where-Object status -eq 'COMPLETED').Count
$failed = @($samples | Where-Object status -eq 'FAILED').Count
$cancelled = @($samples | Where-Object status -eq 'CANCELLED').Count
$durationSeconds = [Math]::Max(0.001, $runStopwatch.Elapsed.TotalSeconds)

$result = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  status = 'MEASURED'
  environment = [ordered]@{ baseUrl = $BaseUrl; taskType = 'JSON_TRANSFORM'; jobCount = $JobCount; concurrency = $Concurrency; warmupJobs = 0; pollIntervalMs = $PollIntervalMs; authenticatedWorkers = $Concurrency; existingDevelopmentDataUsed = $false }
  rawSamples = @($samples)
  summary = [ordered]@{
    endToEndMs = [ordered]@{ p50 = Get-Percentile $latencies 0.50; p95 = Get-Percentile $latencies 0.95; p99 = Get-Percentile $latencies 0.99; max = if ($latencies) { ($latencies | Measure-Object -Maximum).Maximum } else { $null } }
    submittedJobsPerSecond = [Math]::Round($JobCount / $durationSeconds, 3)
    completedJobsPerSecond = [Math]::Round($completed / $durationSeconds, 3)
    outcomes = [ordered]@{ submitted = $JobCount; completed = $completed; failed = $failed; cancelled = $cancelled; successRatePercent = [Math]::Round(($completed / [Math]::Max(1, $JobCount)) * 100, 3); failureRatePercent = [Math]::Round(($failed / [Math]::Max(1, $JobCount)) * 100, 3) }
  }
  retry = $retry
  idempotency = $idempotency
}

$parent = Split-Path -Parent $OutputPath
if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
$result | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 $OutputPath
$result | ConvertTo-Json -Depth 12
