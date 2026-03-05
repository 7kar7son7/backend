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

# Automatyczne wykrywanie lokalnego adresu IP
Write-Host "Wykrywanie lokalnego adresu IP..." -ForegroundColor Cyan
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.IPAddress -notlike "169.254.*" 
} | Select-Object -First 1).IPAddress

if (-not $ipAddress) {
  # Fallback: użyj ipconfig
  $ipConfig = ipconfig | Select-String -Pattern "IPv4.*:\s*(\d+\.\d+\.\d+\.\d+)" | Select-Object -First 1
  if ($ipConfig -match "(\d+\.\d+\.\d+\.\d+)") {
    $ipAddress = $matches[1]
  }
}

if (-not $ipAddress) {
  Write-Host "Nie udało się wykryć adresu IP. Użyj ręcznie: --dart-define=API_BASE_URL=http://TWOJE_IP:3001" -ForegroundColor Red
  exit 1
}

$apiUrl = "http://$ipAddress:3001"
Write-Host "Używam adresu API: $apiUrl" -ForegroundColor Green
Write-Host "Upewnij się, że telefon jest w tej samej sieci WiFi!" -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/2] Uruchamiam backend (npm run dev)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location `"$backendDir`"; npm install --loglevel=error --no-audit --no-fund; npm run dev"
) | Out-Null

Start-Sleep -Seconds 6

Write-Host "[2/2] Uruchamiam Flutter na telefonie (flutter run)..." -ForegroundColor Cyan
Write-Host "Adres API: $apiUrl" -ForegroundColor Green
Write-Host ""
Write-Host "UWAGA: Upewnij się że:" -ForegroundColor Yellow
Write-Host "  1. Backend działa na porcie 3001" -ForegroundColor Yellow
Write-Host "  2. Firewall Windows pozwala na połączenia na porcie 3001" -ForegroundColor Yellow
Write-Host "  3. Telefon jest w tej samej sieci WiFi co komputer" -ForegroundColor Yellow
Write-Host ""
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location `"$mobileDir`"; flutter pub get; flutter run --dart-define=API_BASE_URL=$apiUrl"
) | Out-Null

Write-Host ""
Write-Host "Uruchomiono dwa okna PowerShell: backend i aplikacja Flutter." -ForegroundColor Green
Write-Host "Adres API dla telefonu: $apiUrl" -ForegroundColor Green
Write-Host "Zatrzymanie: zamknij odpowiednie okno lub wprowadź 'Ctrl+C'." -ForegroundColor Yellow

