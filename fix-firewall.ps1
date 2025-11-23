# Skrypt do otwarcia portu 3001 w firewall Windows
# Uruchom jako Administrator!

Write-Host "Dodawanie reguły firewall dla portu 3001..." -ForegroundColor Cyan

# Sprawdź czy jesteś administratorem
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "BŁĄD: Musisz uruchomić jako Administrator!" -ForegroundColor Red
    Write-Host "Kliknij prawym na PowerShell i wybierz 'Uruchom jako administrator'" -ForegroundColor Yellow
    exit 1
}

# Dodaj regułę dla portu 3001
netsh advfirewall firewall add rule name="Backend API Port 3001" dir=in action=allow protocol=TCP localport=3001

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Reguła firewall dodana pomyślnie!" -ForegroundColor Green
    Write-Host "Port 3001 jest teraz otwarty dla połączeń z sieci lokalnej." -ForegroundColor Green
} else {
    Write-Host "❌ Błąd podczas dodawania reguły firewall" -ForegroundColor Red
    exit 1
}

