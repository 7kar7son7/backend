# 🚀 Wdrożenie Backendu na Publiczny Serwer

Aplikacja z Google Play **MUSI** mieć publiczny backend! Koledzy z Polski nie mogą łączyć się z twoim lokalnym komputerem w Austrii.

## 🎯 Najszybsze rozwiązanie: Railway.app (DARMOWE!)

Railway.app oferuje darmowy tier i jest super proste w użyciu.

### Krok 1: Przygotuj backend

1. **Zbuduj backend lokalnie** (żeby sprawdzić czy działa):
   ```powershell
   cd backend
   npm install
   npm run build
   ```

2. **Sprawdź czy masz wszystkie zmienne środowiskowe** w `.env`:
   - `DATABASE_URL` - masz już (Branchly Cloud)
   - `PORT` - Railway ustawi automatycznie
   - `HOST=0.0.0.0` - już masz
   - `FCM_SERVER_KEY` - jeśli używasz powiadomień

### Krok 2: Wdróż na Railway

1. **Załóż konto na Railway.app:**
   - Idź na https://railway.app
   - Zaloguj się przez GitHub

2. **Utwórz nowy projekt:**
   - Kliknij "New Project"
   - Wybierz "Deploy from GitHub repo"
   - Wybierz swoje repo (lub "Empty Project" jeśli nie masz na GitHub)

3. **Dodaj serwis:**
   - Kliknij "New" → "GitHub Repo" (lub "Empty Service")
   - Wybierz folder `backend`

4. **Skonfiguruj zmienne środowiskowe:**
   - W Railway, przejdź do "Variables"
   - Dodaj wszystkie zmienne z `backend/.env`:
     ```
     DATABASE_URL=postgresql://admin:changeme_secure_password@57.129.12.11:5432/...
     NODE_ENV=production
     PORT=3001
     HOST=0.0.0.0
     EPG_SOURCE_FILE=../epg-source/guide.xml
     EPG_LOGO_DATA_FILE=../epg-source/temp/data/logos.json
     EPG_CHANNEL_DATA_FILE=../epg-source/temp/data/channels.json
     EPG_GRAB_ENABLED=true
     EPG_GRAB_WORKDIR=../epg-source
     EPG_GRAB_COMMAND=npm run grab --- --site=tvprofil.com --lang=pl --output guide.xml --maxConnections=5
     IPTV_ORG_MAX_CHANNELS=10000
     IPTV_ORG_MAX_DAYS=7
     IPTV_ORG_ALLOWED_PREFIXES=pl/
     EPG_IMPORT_CHUNK_SIZE=50
     EPG_AUTO_IMPORT_ENABLED=true
     EPG_AUTO_IMPORT_SCHEDULE=0 3 * * *
     EPG_AUTO_IMPORT_TIMEZONE=Europe/Warsaw
     EPG_AUTO_IMPORT_RUN_ON_START=true
     IPTV_ORG_SELECTED_IDS=pl/tvp1,pl/tvp2,pl/tvpinfo,pl/tvpsport,pl/tvpseriale,pl/tvn,pl/tvn24,pl/tvn7,pl/tvnstyl,pl/polsat,pl/polsatnews,pl/polsatsport,pl/tv4,pl/tvpuls,pl/tvphistoria,pl/ttv,pl/canalplus,pl/canalplusfilm,pl/canalplussport,pl/eleven1,pl/eleven2,pl/discoverychannel,pl/discoverylife,pl/nationalgeographic,pl/animalplanet,pl/bbcbrit,pl/bbcearth,pl/hbo,pl/hbo2,pl/hbo3,pl/cinemax,pl/axn,pl/minimini,pl/disneychannel,pl/nickelodeon,pl/cartoonnetwork,pl/eskatv,pl/4fundance,pl/fokustv
     DAILY_REMINDER_SCHEDULE=0 11 * * *
     ```

5. **Skonfiguruj build:**
   - Railway automatycznie wykryje Dockerfile
   - Lub ustaw "Build Command": `npm install && npm run build`
   - "Start Command": `npx prisma migrate deploy && node dist/server.js`

6. **Poczekaj na deploy:**
   - Railway zbuduje i uruchomi backend
   - Sprawdź logi czy wszystko działa

7. **Pobierz publiczny URL:**
   - W Railway, kliknij na serwis
   - Znajdź "Settings" → "Generate Domain"
   - Skopiuj URL (np. `https://backontv-production.up.railway.app`)

### Krok 3: Zbuduj aplikację z publicznym URL

```powershell
cd mobile

# Zwiększ wersję w pubspec.yaml
# version: 1.0.1+3

# Zbuduj z publicznym URL
flutter build appbundle --release --dart-define=API_BASE_URL=https://twoj-backend.railway.app
```

### Krok 4: Wgraj nową wersję do Google Play

1. Wejdź do Google Play Console
2. Przejdź do "Testy zamknięte" → "Releases"
3. Kliknij "Utwórz nowy release"
4. Wgraj nowy AAB z `mobile/build/app/outputs/bundle/release/app-release.aab`
5. Dodaj notatki: "Backend na publicznym serwerze - działa z Polski"
6. Opublikuj

## 🔄 Alternatywne rozwiązania:

### Render.com (też darmowe)
1. Załóż konto na render.com
2. "New" → "Web Service"
3. Połącz z GitHub repo
4. Ustaw:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npx prisma migrate deploy && node dist/server.js`
5. Dodaj zmienne środowiskowe
6. Render da ci URL typu `https://backontv.onrender.com`

### VPS (jeśli masz)
1. Zainstaluj Node.js na VPS
2. Sklonuj repo
3. Ustaw zmienne środowiskowe
4. Uruchom: `npm install && npm run build && npm start`
5. Użyj nginx jako reverse proxy z SSL (Let's Encrypt)

## ⚠️ WAŻNE:

1. **HTTPS jest wymagane** - Google Play blokuje HTTP w produkcji
2. **CORS** - Backend już ma CORS skonfigurowany (`origin: true`)
3. **Firebase** - Jeśli używasz FCM, upewnij się że klucze są poprawne
4. **Baza danych** - Masz już Branchly Cloud, więc to jest OK

## 🧪 Testowanie:

Po wdrożeniu, przetestuj:
```powershell
curl https://twoj-backend.railway.app/health
```

Powinno zwrócić status OK.

## 📝 Checklist:

- [ ] Backend zbudowany lokalnie i działa
- [ ] Konto na Railway.app (lub innym serwisie)
- [ ] Backend wdrożony i działa
- [ ] Publiczny URL działa (test curl)
- [ ] Aplikacja zbudowana z publicznym URL
- [ ] Nowa wersja wgrana do Google Play
- [ ] Testerzy mogą pobrać i używać aplikacji

