#requires -Version 5.1

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir 'backend'
$mobileDir = Join-Path $scriptDir 'mobile'

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found at '$backendDir'"
}

if (-not (Test-Path $mobileDir)) {
  throw "Mobile directory not found at '$mobileDir'"
}

Write-Host "[1/2] Uruchamiam backend (npm run dev)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location `"$backendDir`"; npm install --loglevel=error --no-audit --no-fund; npm run dev"
) | Out-Null

Start-Sleep -Seconds 6

Write-Host "[2/2] Uruchamiam Flutter (flutter run)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location `"$mobileDir`"; flutter pub get; flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001"
) | Out-Null

Write-Host "Uruchomiono dwa okna PowerShell: backend i aplikacja Flutter." -ForegroundColor Green
Write-Host "Zatrzymanie: zamknij odpowiednie okno lub wprowadź 'Ctrl+C'." -ForegroundColor Yellow
