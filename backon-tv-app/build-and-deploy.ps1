#requires -Version 5.1

$ErrorActionPreference = 'Stop'

param(
    [Parameter(Mandatory=$false)]
    [string]$RailwayUrl = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "",
    
    [Parameter(Mandatory=$false)]
    [int]$BuildNumber = 0
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobileDir = Join-Path $scriptDir 'mobile'
$backendDir = Join-Path $scriptDir 'backend'

Write-Host "🚀 Automatyczne wdrożenie aplikacji" -ForegroundColor Cyan
Write-Host ""

# KROK 1: Przygotuj zmienne dla Railway
Write-Host "[1/4] Przygotowuję zmienne dla Railway..." -ForegroundColor Cyan
& "$scriptDir\deploy-to-railway.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Błąd podczas przygotowywania zmiennych" -ForegroundColor Red
    exit 1
}

# KROK 2: Sprawdź czy backend działa lokalnie
Write-Host ""
Write-Host "[2/4] Sprawdzam backend lokalnie..." -ForegroundColor Cyan
Set-Location $backendDir
if (-not (Test-Path "node_modules")) {
    Write-Host "Instaluję zależności..." -ForegroundColor Yellow
    npm install --silent
}
npm run build | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend zbudowany poprawnie" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend ma błędy, ale kontynuuję..." -ForegroundColor Yellow
}

# KROK 3: Pobierz URL z Railway (jeśli nie podano)
if ($RailwayUrl -eq "") {
    Write-Host ""
    Write-Host "[3/4] Konfiguracja URL API..." -ForegroundColor Cyan
    Write-Host "Podaj URL z Railway.app (np. https://backontv-production.up.railway.app)" -ForegroundColor Yellow
    Write-Host "Lub naciśnij Enter żeby użyć domyślnego (będziesz mógł zmienić później)" -ForegroundColor Yellow
    $RailwayUrl = Read-Host "Railway URL"
    
    if ($RailwayUrl -eq "") {
        Write-Host "⚠️  Musisz podać URL! Uruchom ponownie z parametrem:" -ForegroundColor Yellow
        Write-Host ".\build-and-deploy.ps1 -RailwayUrl 'https://twoj-url.railway.app'" -ForegroundColor Yellow
        exit 1
    }
}

# Sprawdź czy URL jest poprawny
if (-not $RailwayUrl.StartsWith("http")) {
    $RailwayUrl = "https://$RailwayUrl"
}

Write-Host "Używam URL: $RailwayUrl" -ForegroundColor Green

# KROK 4: Zbuduj aplikację
Write-Host ""
Write-Host "[4/4] Buduję aplikację..." -ForegroundColor Cyan
Set-Location $mobileDir

# Zwiększ wersję jeśli podano
if ($Version -ne "" -or $BuildNumber -gt 0) {
    $pubspecPath = Join-Path $mobileDir "pubspec.yaml"
    $pubspecContent = Get-Content $pubspecPath -Raw
    
    if ($Version -ne "") {
        Write-Host "Aktualizuję wersję do: $Version" -ForegroundColor Yellow
        $pubspecContent = $pubspecContent -replace 'version:\s*\d+\.\d+\.\d+\+\d+', "version: $Version"
    }
    
    if ($BuildNumber -gt 0) {
        Write-Host "Aktualizuję build number do: $BuildNumber" -ForegroundColor Yellow
        if ($pubspecContent -match 'version:\s*(\d+\.\d+\.\d+)\+(\d+)') {
            $currentVersion = $matches[1]
            $pubspecContent = $pubspecContent -replace "version:\s*$currentVersion\+\d+", "version: $currentVersion+$BuildNumber"
        }
    }
    
    Set-Content -Path $pubspecPath -Value $pubspecContent -NoNewline
}

# Pobierz zależności
Write-Host "Pobieranie zależności Flutter..." -ForegroundColor Yellow
flutter pub get | Out-Null

# Zbuduj
Write-Host "Budowanie AAB z URL: $RailwayUrl" -ForegroundColor Yellow
flutter build appbundle --release --dart-define=API_BASE_URL=$RailwayUrl

if ($LASTEXITCODE -eq 0) {
    $aabPath = Join-Path $mobileDir "build\app\outputs\bundle\release\app-release.aab"
    Write-Host ""
    Write-Host "✅ GOTOWE!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Plik AAB: $aabPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Następne kroki:" -ForegroundColor Cyan
    Write-Host "1. W Railway.app:" -ForegroundColor Yellow
    Write-Host "   - Otwórz railway-variables.txt" -ForegroundColor White
    Write-Host "   - Wklej zmienne do Railway → Variables → Raw Editor" -ForegroundColor White
    Write-Host "   - Poczekaj na deploy" -ForegroundColor White
    Write-Host "   - Skopiuj publiczny URL" -ForegroundColor White
    Write-Host ""
    Write-Host "2. W Google Play Console:" -ForegroundColor Yellow
    Write-Host "   - Testy zamknięte → Utwórz nowy release" -ForegroundColor White
    Write-Host "   - Wgraj: $aabPath" -ForegroundColor White
    Write-Host "   - Opublikuj" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Błąd podczas budowania!" -ForegroundColor Red
    exit 1
}












