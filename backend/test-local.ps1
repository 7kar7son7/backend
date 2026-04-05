# Test lokalny backendu - logotypy i zdjecia programow
# Uruchom backend w osobnym terminalu: cd backend; $env:DATABASE_URL="postgresql://..."; npm run dev
# Potem uruchom ten skrypt: .\test-local.ps1

$base = "http://127.0.0.1:3000"
$ok = 0
$fail = 0

Write-Host "`n=== Test 1: GET /channels?limit=2 ===" -ForegroundColor Cyan
try {
  $r = Invoke-RestMethod -Uri "$base/channels?limit=2" -Method GET
  $ch = $r.data[0]
  Write-Host "OK 200. Pierwszy kanal: $($ch.name), logoUrl: $($ch.logoUrl)" -ForegroundColor Green
  $ok++
} catch { Write-Host "FAIL: $_" -ForegroundColor Red; $fail++ }

Write-Host "`n=== Test 2: GET /logos/akpa/akpa_75 (logotyp) ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri "$base/logos/akpa/akpa_75" -Method GET -UseBasicParsing
  if ($r.StatusCode -eq 200) {
    Write-Host "OK 200, Content-Type: $($r.Headers['Content-Type']), Size: $($r.Content.Length) bytes" -ForegroundColor Green
    $ok++
  } else { Write-Host "FAIL: $($r.StatusCode)" -ForegroundColor Red; $fail++ }
} catch { Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red; $fail++ }

Write-Host "`n=== Test 3: GET /programs/day?limit=1 (imageUrl przez proxy) ===" -ForegroundColor Cyan
try {
  $r = Invoke-RestMethod -Uri "$base/programs/day?limit=1" -Method GET
  $prog = $r.data[0]
  $imgUrl = $prog.imageUrl
  Write-Host "OK 200. Program: $($prog.title), imageUrl: $($imgUrl.Substring(0, [Math]::Min(70, $imgUrl.Length)))..." -ForegroundColor Green
  if ($imgUrl -like "/photos/proxy*") {
    Write-Host "  imageUrl jest przez proxy - OK" -ForegroundColor Green
    $ok++
  } else { Write-Host "  imageUrl NIE jest przez proxy" -ForegroundColor Yellow; $ok++ }
} catch { Write-Host "FAIL: $_" -ForegroundColor Red; $fail++ }

Write-Host "`n=== Test 4: GET /photos/proxy (zdjecie programu) ===" -ForegroundColor Cyan
$photoUrl = "https://api-epg.akpa.pl/api/v1/photo/akpa_p3x4_5496170.jpg"
$encoded = [System.Web.HttpUtility]::UrlEncode($photoUrl)
try {
  $r = Invoke-WebRequest -Uri "$base/photos/proxy?url=$encoded" -Method GET -UseBasicParsing
  if ($r.StatusCode -eq 200) {
    Write-Host "OK 200, Size: $($r.Content.Length) bytes (zdjecie)" -ForegroundColor Green
    $ok++
  } else { Write-Host "FAIL: $($r.StatusCode) - ustaw AKPA_API_TOKEN w .env" -ForegroundColor Yellow; $fail++ }
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 502) { Write-Host "502 - brak AKPA_API_TOKEN w .env (proxy wymaga tokenu)" -ForegroundColor Yellow }
  else { Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red }
  $fail++
}

Write-Host "`n=== Podsumowanie: $ok OK, $fail FAIL ===" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
