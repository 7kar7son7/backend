# Zmienne środowiskowe dla produkcji (Railway.app)

## 🔴 WYMAGANE (bez nich aplikacja nie zadziała)

```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=disable
```
**Opis:** URL połączenia do bazy danych PostgreSQL. Railway automatycznie dostarcza tę zmienną, ale możesz ją nadpisać.

---

## ⚙️ PODSTAWOWE KONFIGURACJE

```bash
NODE_ENV=production
```
**Opis:** Środowisko uruchomieniowe. Musi być `production` na produkcji.

```bash
PORT=3001
```
**Opis:** Port, na którym aplikacja nasłuchuje. Railway automatycznie ustawia port, ale możesz go nadpisać.

```bash
HOST=0.0.0.0
```
**Opis:** Adres IP, na którym aplikacja nasłuchuje. `0.0.0.0` oznacza wszystkie interfejsy (wymagane dla Railway).

```bash
NODE_OPTIONS=--max-old-space-size=2048
```
**Opis:** Limit pamięci dla Node.js (2GB). Wymagane dla dużych plików EPG.

```bash
LOG_LEVEL=info
```
**Opis:** Poziom logowania. Możliwe wartości: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.  
**Domyślnie:** `info` w produkcji, `debug` w development.

---

## 📺 EPG - ŹRÓDŁA DANYCH

```bash
EPG_SOURCE_URL=https://www.open-epg.com/files/poland1.xml.gz
```
**Opis:** URL źródła EPG. Jeśli puste, używa automatycznego fallback (próbuje różnych źródeł).  
**Rekomendowane źródła:**
- `https://www.open-epg.com/files/poland1.xml.gz` (583 kanały, aktualizacja codzienna o 20:00 CET)
- `https://www.open-epg.com/files/poland2.xml.gz` (618 kanałów, aktualizacja codzienna o 20:00 CET)
- `https://epg.ovh/plar.xml` (10-dniowe EPG z 5-dniowym archiwum)
- `https://epg.ovh/pl.xml` (5-dniowe EPG)
- `https://epg.ovh/pltv.xml` (EPG z dodatkowymi informacjami)

```bash
EPG_SOURCE_FILE=
```
**Opis:** Ścieżka do lokalnego pliku EPG (jeśli używasz lokalnego źródła). Zazwyczaj puste na produkcji.

```bash
EPG_LOGO_DATA_FILE=
```
**Opis:** Ścieżka do pliku JSON z logotypami kanałów. Zazwyczaj puste (logotypy są pobierane z XML EPG).

```bash
EPG_CHANNEL_DATA_FILE=
```
**Opis:** Ścieżka do pliku JSON z listą dozwolonych kanałów. Zazwyczaj puste (używa prefiksów).

---

## ⏰ EPG - AUTOMATYCZNY IMPORT

```bash
EPG_AUTO_IMPORT_ENABLED=true
```
**Opis:** Włącza automatyczny import EPG według harmonogramu.  
**Domyślnie:** `false`

```bash
EPG_AUTO_IMPORT_SCHEDULE=0 21 * * *
```
**Opis:** Harmonogram importu w formacie cron (minuta, godzina, dzień, miesiąc, dzień tygodnia).  
**Format:** `minuta godzina dzień miesiąc dzień_tygodnia`  
**Przykłady:**
- `0 21 * * *` - codziennie o 21:00 (po aktualizacji open-epg.com o 20:00 CET)
- `0 3 * * *` - codziennie o 03:00
- `0 */6 * * *` - co 6 godzin

```bash
EPG_AUTO_IMPORT_TIMEZONE=Europe/Warsaw
```
**Opis:** Strefa czasowa dla harmonogramu cron.  
**Domyślnie:** `Europe/Warsaw`

```bash
EPG_AUTO_IMPORT_RUN_ON_START=true
```
**Opis:** Czy uruchomić import EPG przy starcie aplikacji.  
**Domyślnie:** `false`

---

## 🔧 EPG - KONFIGURACJA IMPORTU

```bash
IPTV_ORG_MAX_CHANNELS=10000
```
**Opis:** Maksymalna liczba kanałów do zaimportowania.  
**Domyślnie:** `10000`

```bash
IPTV_ORG_MAX_DAYS=7
```
**Opis:** Liczba dni w przód, dla których importować programy.  
**Domyślnie:** `7`

```bash
IPTV_ORG_ALLOWED_PREFIXES=pl/
```
**Opis:** Prefiksy ID kanałów do zaimportowania (oddzielone przecinkami).  
**Domyślnie:** `pl/` (tylko polskie kanały)  
**Przykład:** `pl/,de/` - polskie i niemieckie kanały

```bash
IPTV_ORG_SELECTED_IDS=
```
**Opis:** Lista konkretnych ID kanałów do zaimportowania (oddzielone przecinkami).  
**Jeśli puste:** importuje wszystkie kanały z dozwolonym prefiksem.  
**Przykład:** `pl/tvp1,pl/tvp2,pl/tvpinfo`

```bash
EPG_IMPORT_CHUNK_SIZE=50
```
**Opis:** Liczba programów przetwarzanych w jednej transakcji bazy danych.  
**Domyślnie:** `50` (optymalne dla większości przypadków)

```bash
EPG_PRUNE_MAX_AGE_DAYS=1
```
**Opis:** Liczba dni wstecz, dla których zostawić programy w bazie. Programy starsze są automatycznie usuwane.  
**Domyślnie:** `1` (usuwa programy starsze niż 1 dzień)

---

## 🛠️ EPG - GRAB (opcjonalne)

```bash
EPG_GRAB_ENABLED=false
```
**Opis:** Włącza użycie zewnętrznego narzędzia `grab` do pobierania EPG.  
**Domyślnie:** `false` (używa bezpośredniego importu z URL)

```bash
EPG_GRAB_COMMAND=
```
**Opis:** Komenda do uruchomienia `grab`. Używane tylko jeśli `EPG_GRAB_ENABLED=true`.

```bash
EPG_GRAB_WORKDIR=
```
**Opis:** Katalog roboczy dla komendy `grab`. Używane tylko jeśli `EPG_GRAB_ENABLED=true`.

---

## 🔔 POWIADOMIENIA (FCM)

```bash
FCM_PROJECT_ID=
```
**Opis:** ID projektu Firebase Cloud Messaging (opcjonalne).

```bash
FCM_CLIENT_EMAIL=
```
**Opis:** Email klienta FCM (opcjonalne).

```bash
FCM_PRIVATE_KEY=
```
**Opis:** Klucz prywatny FCM (opcjonalne).

```bash
FCM_SERVER_KEY=
```
**Opis:** Klucz serwera FCM do wysyłania powiadomień push.  
**Wymagane:** Jeśli chcesz wysyłać powiadomienia push.

---

## ⏰ HARMONOGRAMY

```bash
DAILY_REMINDER_SCHEDULE=0 11 * * *
```
**Opis:** Harmonogram codziennych przypomnień w formacie cron.  
**Domyślnie:** `0 11 * * *` (codziennie o 11:00)

---

## 🔐 BEZPIECZEŃSTWO

```bash
JWT_SECRET=replace-with-secure-secret
```
**Opis:** Sekretny klucz do podpisywania tokenów JWT. **MUSI być unikalny i bezpieczny!**  
**⚠️ WAŻNE:** Zmień na losowy, długi string (min. 32 znaki).

---

## 📋 PRZYKŁADOWA KONFIGURACJA DLA PRODUKCJI

```bash
# WYMAGANE
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=disable
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
NODE_OPTIONS=--max-old-space-size=2048

# EPG - ŹRÓDŁO (opcjonalne - używa automatycznego fallback)
# EPG_SOURCE_URL=https://www.open-epg.com/files/poland1.xml.gz

# EPG - AUTOMATYCZNY IMPORT
EPG_AUTO_IMPORT_ENABLED=true
EPG_AUTO_IMPORT_SCHEDULE=0 21 * * *
EPG_AUTO_IMPORT_TIMEZONE=Europe/Warsaw
EPG_AUTO_IMPORT_RUN_ON_START=true

# EPG - KONFIGURACJA
IPTV_ORG_MAX_CHANNELS=10000
IPTV_ORG_MAX_DAYS=7
IPTV_ORG_ALLOWED_PREFIXES=pl/
# IPTV_ORG_SELECTED_IDS=  # Puste = wszystkie polskie kanały
EPG_IMPORT_CHUNK_SIZE=50
EPG_PRUNE_MAX_AGE_DAYS=1

# EPG - GRAB (wyłączone)
EPG_GRAB_ENABLED=false

# POWIADOMIENIA (opcjonalne)
# FCM_SERVER_KEY=your-fcm-server-key

# HARMONOGRAMY
DAILY_REMINDER_SCHEDULE=0 11 * * *

# BEZPIECZEŃSTWO
JWT_SECRET=your-secure-random-secret-min-32-chars

# LOGOWANIE
LOG_LEVEL=info
```

---

## 📝 UWAGI

1. **Railway automatycznie dostarcza:**
   - `DATABASE_URL` - jeśli używasz Railway PostgreSQL
   - `PORT` - port na którym aplikacja ma nasłuchować
   - `RAILWAY_ENVIRONMENT` - środowisko Railway

2. **Zmienne opcjonalne:**
   - Jeśli zmienna nie jest ustawiona, aplikacja używa wartości domyślnych
   - Większość zmiennych EPG ma sensowne domyślne wartości

3. **Bezpieczeństwo:**
   - **NIGDY** nie commituj prawdziwych wartości `DATABASE_URL`, `JWT_SECRET`, `FCM_SERVER_KEY` do repozytorium
   - Używaj Railway Variables do przechowywania wrażliwych danych

4. **Aktualizacja EPG:**
   - Open-EPG aktualizuje się codziennie o **20:00 CET**
   - Harmonogram importu (`EPG_AUTO_IMPORT_SCHEDULE=0 21 * * *`) uruchamia się o **21:00**, aby mieć pewność, że dane są zaktualizowane

