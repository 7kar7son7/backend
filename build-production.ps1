#requires -Version 5.1

$ErrorActionPreference = 'Stop'

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "",
    
    [Parameter(Mandatory=$false)]
    [int]$BuildNumber = 0
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobileDir = Join-Path $scriptDir 'mobile'

if (-not (Test-Path $mobileDir)) {
    throw "Mobile directory not found at '$mobileDir'"
}

Write-Host "🚀 Budowanie aplikacji na produkcję..." -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Green

# Sprawdź czy URL zaczyna się od https
if (-not $ApiUrl.StartsWith("https://")) {
    Write-Host "⚠️  UWAGA: URL nie używa HTTPS!" -ForegroundColor Yellow
    Write-Host "Google Play może wymagać HTTPS dla produkcji." -ForegroundColor Yellow
    $confirm = Read-Host "Kontynuować? (y/n)"
    if ($confirm -ne "y") {
        exit 1
    }
}

# Zwiększ wersję jeśli podano
if ($Version -ne "" -or $BuildNumber -gt 0) {
    $pubspecPath = Join-Path $mobileDir "pubspec.yaml"
    $pubspecContent = Get-Content $pubspecPath -Raw
    
    if ($Version -ne "") {
        Write-Host "Aktualizuję wersję do: $Version" -ForegroundColor Cyan
        $pubspecContent = $pubspecContent -replace 'version:\s*\d+\.\d+\.\d+\+\d+', "version: $Version"
    }
    
    if ($BuildNumber -gt 0) {
        Write-Host "Aktualizuję build number do: $BuildNumber" -ForegroundColor Cyan
        if ($pubspecContent -match 'version:\s*(\d+\.\d+\.\d+)\+(\d+)') {
            $currentVersion = $matches[1]
            $pubspecContent = $pubspecContent -replace "version:\s*$currentVersion\+\d+", "version: $currentVersion+$BuildNumber"
        }
    }
    
    Set-Content -Path $pubspecPath -Value $pubspecContent -NoNewline
}

Write-Host ""
Write-Host "[1/3] Pobieranie zależności..." -ForegroundColor Cyan
Set-Location $mobileDir
flutter pub get

Write-Host ""
Write-Host "[2/3] Budowanie AAB..." -ForegroundColor Cyan
flutter build appbundle --release --dart-define=API_BASE_URL=$ApiUrl

if ($LASTEXITCODE -eq 0) {
    $aabPath = Join-Path $mobileDir "build\app\outputs\bundle\release\app-release.aab"
    Write-Host ""
    Write-Host "✅ Aplikacja zbudowana pomyślnie!" -ForegroundColor Green
    Write-Host "Plik: $aabPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Następne kroki:" -ForegroundColor Cyan
    Write-Host "1. Wgraj plik do Google Play Console" -ForegroundColor Yellow
    Write-Host "2. Przejdź do: Testy zamknięte → Utwórz nowy release" -ForegroundColor Yellow
    Write-Host "3. Wgraj: $aabPath" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Błąd podczas budowania!" -ForegroundColor Red
    exit 1
}

