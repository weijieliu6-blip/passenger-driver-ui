$ErrorActionPreference = 'Stop'
$TOKEN = (Get-Content -Path 'scripts/e2e-token2.txt').Trim()
$base = "http://localhost:3000/api/driver/grab/$TOKEN"

# Use Start-Process to fire both in parallel; capture HTTP code via separate -o file + -w
$procA = Start-Process -FilePath 'curl.exe' -ArgumentList @(
  '-s','-X','POST', $base,
  '-H','Content-Type: application/json',
  '--max-time','30',
  '--data-binary','@scripts/e2e-driverA.json',
  '-o','scripts/race-A-resp.json',
  '-w','HTTP=%{http_code}'
) -NoNewWindow -PassThru -RedirectStandardOutput 'scripts/race-A-stdout.txt'

$procB = Start-Process -FilePath 'curl.exe' -ArgumentList @(
  '-s','-X','POST', $base,
  '-H','Content-Type: application/json',
  '--max-time','30',
  '--data-binary','@scripts/e2e-driverB.json',
  '-o','scripts/race-B-resp.json',
  '-w','HTTP=%{http_code}'
) -NoNewWindow -PassThru -RedirectStandardOutput 'scripts/race-B-stdout.txt'

# Wait for both
$procA.WaitForExit()
$procB.WaitForExit()

Write-Host 'A stdout:' (Get-Content scripts/race-A-stdout.txt)
Write-Host 'B stdout:' (Get-Content scripts/race-B-stdout.txt)
Write-Host 'A response:' (Get-Content scripts/race-A-resp.json)
Write-Host 'B response:' (Get-Content scripts/race-B-resp.json)