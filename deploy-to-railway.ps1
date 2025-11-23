#requires -Version 5.1

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir 'backend'
$envFile = Join-Path $backendDir '.env'

if (-not (Test-Path $envFile)) {
    Write-Host "❌ Nie znaleziono pliku backend/.env" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Przygotowuję zmienne środowiskowe dla Railway..." -ForegroundColor Cyan

# Wczytaj .env
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"').Trim("'")
        $envVars[$key] = $value
    }
}

# Przygotuj zmienne dla Railway
$railwayVars = @{}

# Skopiuj podstawowe zmienne
$railwayVars['DATABASE_URL'] = $envVars['DATABASE_URL']
$railwayVars['NODE_ENV'] = 'production'
$railwayVars['HOST'] = '0.0.0.0'
$railwayVars['PORT'] = $envVars['PORT'] ?? '3001'

# EPG - użyj URL zamiast pliku
if ($envVars.ContainsKey('EPG_SOURCE_URL')) {
    $railwayVars['EPG_SOURCE_URL'] = $envVars['EPG_SOURCE_URL']
} else {
    $railwayVars['EPG_SOURCE_URL'] = 'https://iptv-org.github.io/epg/guides/pl/pl.xml'
    Write-Host "✅ Ustawiono EPG_SOURCE_URL na domyślny URL" -ForegroundColor Green
}

# Wyłącz EPG grab (nie ma folderu epg-source w kontenerze)
$railwayVars['EPG_GRAB_ENABLED'] = 'false'

# Skopiuj pozostałe zmienne EPG
$epgKeys = @(
    'IPTV_ORG_MAX_CHANNELS',
    'IPTV_ORG_MAX_DAYS',
    'IPTV_ORG_ALLOWED_PREFIXES',
    'EPG_IMPORT_CHUNK_SIZE',
    'EPG_AUTO_IMPORT_ENABLED',
    'EPG_AUTO_IMPORT_SCHEDULE',
    'EPG_AUTO_IMPORT_TIMEZONE',
    'EPG_AUTO_IMPORT_RUN_ON_START',
    'IPTV_ORG_SELECTED_IDS',
    'DAILY_REMINDER_SCHEDULE'
)

foreach ($key in $epgKeys) {
    if ($envVars.ContainsKey($key)) {
        $railwayVars[$key] = $envVars[$key]
    }
}

# Firebase (jeśli jest)
if ($envVars.ContainsKey('FCM_SERVER_KEY')) {
    $railwayVars['FCM_SERVER_KEY'] = $envVars['FCM_SERVER_KEY']
}

# Zapisz do pliku
$outputFile = Join-Path $scriptDir 'railway-variables.txt'
$output = @()
$output += "# Zmienne srodowiskowe dla Railway.app"
$output += "# Skopiuj te zmienne do Railway Variables"
$output += "#"
$output += ""

foreach ($key in $railwayVars.Keys | Sort-Object) {
    $value = $railwayVars[$key]
    $output += "$key=$value"
}

$output | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "✅ Przygotowano plik: railway-variables.txt" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Następne kroki:" -ForegroundColor Cyan
Write-Host "1. Otwórz plik railway-variables.txt" -ForegroundColor Yellow
Write-Host "2. W Railway.app -> Variables -> kliknij Raw Editor" -ForegroundColor Yellow
Write-Host "3. Wklej zawartosc pliku" -ForegroundColor Yellow
Write-Host "4. Zapisz" -ForegroundColor Yellow
Write-Host ""

# Pokaż podgląd
Write-Host "Podgląd zmiennych:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
$railwayVars.Keys | Sort-Object | ForEach-Object {
    $key = $_
    $value = $railwayVars[$key]
    if ($key -eq "DATABASE_URL" -or $key -eq "FCM_SERVER_KEY") {
        Write-Host "$key=***ukryte***" -ForegroundColor Gray
    } else {
        Write-Host "$key=$value" -ForegroundColor Gray
    }
}

