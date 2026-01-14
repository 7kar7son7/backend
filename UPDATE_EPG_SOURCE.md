# Aktualizacja źródła EPG

## ✅ Co zostało zrobione:

1. ✅ Zmieniono URL EPG w kodzie na `https://epg.ovh/pl.xml` (aktualizowane codziennie)
2. ✅ Kod został wypchnięty na GitHub
3. ✅ Import został przetestowany lokalnie

## 🔧 Co musisz zrobić na Railway:

### 1. Zaktualizuj zmienną środowiskową `EPG_SOURCE_URL`:

1. Wejdź na Railway → Twój projekt → Variables
2. Znajdź zmienną `EPG_SOURCE_URL`
3. Zmień wartość z:
   ```
   https://iptv-org.github.io/epg/guides/pl/pl.xml
   ```
   na:
   ```
   https://epg.ovh/pl.xml
   ```
4. Zapisz zmiany

### 2. Zrestartuj deployment:

1. Wejdź na Railway → Twój projekt → Deployments
2. Kliknij "Redeploy" lub "Restart"

### 3. Uruchom ręczny import EPG:

Po restarcie, wywołaj endpoint:
```
POST https://backend-production-21e5.up.railway.app/epg/import
```

Lub poczekaj na automatyczny import przy starcie (jeśli `EPG_AUTO_IMPORT_RUN_ON_START=true`)

## 📋 Sprawdź czy działa:

1. Sprawdź logi na Railway - powinny pokazać:
   - `📡 Rozpoczynam import EPG z https://epg.ovh/pl.xml`
   - `✅ Zaimportowano X kanałów i Y audycji`

2. Sprawdź w aplikacji mobilnej - powinny być programy na dzisiaj

## ⚠️ Jeśli nadal nie działa:

1. Sprawdź logi - mogą pokazać błąd parsowania XML (epg.ovh może mieć inny format)
2. Jeśli format jest inny, może trzeba będzie dostosować parser XML

