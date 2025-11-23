# 🚀 Szybki Start - Produkcja dla Google Play

## Problem:
Aplikacja w Google Play próbuje łączyć się z `localhost`, co nie działa - koledzy z Polski nie mogą używać aplikacji!

## Rozwiązanie w 3 krokach:

### KROK 1: Wdróż backend na Railway.app (5 minut)

1. **Załóż konto:** https://railway.app (przez GitHub)
2. **Nowy projekt:** "New Project" → "Deploy from GitHub repo"
3. **Dodaj serwis:** Wybierz folder `backend`
4. **Dodaj zmienne środowiskowe:**
   - Skopiuj wszystkie z `backend/.env` do Railway Variables
   - **WAŻNE:** Ustaw `NODE_ENV=production`
5. **Poczekaj na deploy** (2-3 minuty)
6. **Skopiuj URL:** Railway da ci URL typu `https://backontv-production.up.railway.app`

**Szczegóły:** Zobacz `WDROZENIE_BACKEND.md`

### KROK 2: Zbuduj aplikację z publicznym URL

```powershell
# Użyj skryptu (najłatwiej):
.\build-production.ps1 -ApiUrl "https://twoj-backend.railway.app" -Version "1.0.1" -BuildNumber 3

# LUB ręcznie:
cd mobile
flutter build appbundle --release --dart-define=API_BASE_URL=https://twoj-backend.railway.app
```

**WAŻNE:** 
- Zwiększ wersję w `pubspec.yaml` (np. `1.0.0+2` → `1.0.1+3`)
- Użyj HTTPS (Google Play wymaga)

### KROK 3: Wgraj do Google Play

1. Wejdź do Google Play Console
2. **Testy zamknięte** → **Utwórz nowy release**
3. Wgraj plik: `mobile/build/app/outputs/bundle/release/app-release.aab`
4. Dodaj notatki: "Backend na publicznym serwerze - działa z Polski"
5. **Przejrzyj release** → **Rozpocznij testy zamknięte**

## ✅ Gotowe!

Koledzy z Polski mogą teraz:
1. Otrzymać link do testów
2. Pobrać aplikację z Google Play
3. Używać aplikacji - backend jest publiczny!

## 🧪 Testowanie:

Przed wgraniem do Google Play, przetestuj czy backend działa:

```powershell
# Z komputera:
curl https://twoj-backend.railway.app/health

# Z telefonu (przeglądarka):
# Otwórz: https://twoj-backend.railway.app/health
```

## ⚠️ Ważne:

1. **HTTPS jest wymagane** - Railway daje HTTPS automatycznie
2. **CORS** - Backend już ma skonfigurowane (`origin: true`)
3. **Baza danych** - Masz Branchly Cloud, więc działa z całego świata
4. **Firebase** - Jeśli używasz, sprawdź czy klucze są poprawne

## 🔄 Aktualizacje:

Gdy chcesz zaktualizować aplikację:

```powershell
# 1. Zwiększ wersję w pubspec.yaml
# 2. Zbuduj:
.\build-production.ps1 -ApiUrl "https://twoj-backend.railway.app" -Version "1.0.2" -BuildNumber 4
# 3. Wgraj nowy AAB do Google Play
```

## 🆘 Problemy?

- **Backend nie działa?** Sprawdź logi w Railway
- **Aplikacja nie łączy się?** Sprawdź czy URL jest poprawny (HTTPS!)
- **Błąd CORS?** Backend ma `origin: true`, powinno działać
- **Baza danych?** Sprawdź czy `DATABASE_URL` jest poprawny w Railway

