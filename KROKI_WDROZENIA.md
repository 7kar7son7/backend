# 🚀 Kroki wdrożenia powiadomień push - KROK PO KROKU

## ✅ KROK 1: Wygenerowanie plików (ZROBIONE)
Plik `.g.dart` został wygenerowany pomyślnie.

---

## 📝 KROK 2: Uzyskanie FCM Server Key

1. **Przejdź do Firebase Console:**
   - Otwórz: https://console.firebase.google.com/
   - Zaloguj się do swojego konta Google

2. **Wybierz projekt:**
   - Jeśli nie masz projektu, utwórz nowy
   - Wybierz projekt dla aplikacji BackOn.tv

3. **Pobierz Server Key:**
   - Kliknij ikonę ⚙️ (Settings) w lewym górnym rogu
   - Wybierz **Project Settings**
   - Przejdź do zakładki **Cloud Messaging**
   - W sekcji **Cloud Messaging API (Legacy)** znajdź **Server key**
   - Kliknij **Copy** aby skopiować klucz

   ⚠️ **WAŻNE:** Jeśli nie widzisz "Cloud Messaging API (Legacy)", musisz:
   - Przejść do **APIs & Services** → **Library**
   - Włączyć **Cloud Messaging API (Legacy)**

---

## 🔧 KROK 3: Dodanie FCM_SERVER_KEY na Railway

1. **Przejdź do Railway:**
   - Otwórz: https://railway.app/
   - Zaloguj się

2. **Wybierz projekt:**
   - Kliknij na projekt z backendem (np. "backend-production")

3. **Dodaj zmienną:**
   - Kliknij na zakładkę **Variables**
   - Kliknij **New Variable**
   - **Key:** `FCM_SERVER_KEY`
   - **Value:** Wklej skopiowany Server key z Firebase
   - Kliknij **Add**

4. **Weryfikacja:**
   - Sprawdź, czy zmienna `FCM_SERVER_KEY` pojawiła się na liście
   - Railway automatycznie zrestartuje aplikację

---

## 📱 KROK 4: Wdrożenie zmian w aplikacji mobilnej

### Opcja A: Jeśli masz dostęp do repozytorium mobilnego

1. **Commit i push zmian:**
   ```bash
   cd mobile
   git add .
   git commit -m "Add: FCM token registration in backend"
   git push
   ```

2. **Zbuduj nową wersję aplikacji:**
   - Jeśli używasz CI/CD, automatycznie zbuduje nową wersję
   - Lub zbuduj lokalnie i wyślij do Google Play/App Store

### Opcja B: Jeśli nie masz dostępu do repozytorium

1. **Przekaż zmiany:**
   - Przekaż zmienione pliki osobie odpowiedzialnej za aplikację mobilną
   - Lub zrób pull request do repozytorium

2. **Pliki do zmiany:**
   - `mobile/lib/core/network/device_token_api.dart` (NOWY)
   - `mobile/lib/core/network/device_token_api.g.dart` (WYGENEROWANY)
   - `mobile/lib/core/services/fcm_service.dart` (ZMIENIONY)
   - `mobile/lib/app/app.dart` (ZMIENIONY)

---

## 🧪 KROK 5: Testowanie

### 5.1. Sprawdź logi backendu na Railway:

1. Przejdź do Railway → Twój projekt → **Deployments**
2. Kliknij na najnowszy deployment
3. Sprawdź logi - **NIE powinno być:**
   ```
   FCM_SERVER_KEY not configured - simulating push notification dispatch
   ```

4. **Powinno być:**
   ```
   Sending FCM push notifications
   ```

### 5.2. Sprawdź logi aplikacji mobilnej:

1. Uruchom aplikację mobilną
2. Sprawdź logi (w Android Studio / Xcode lub przez `adb logcat`)
3. **Powinieneś zobaczyć:**
   ```
   ✅ FCM token registered in backend
   ```

### 5.3. Sprawdź bazę danych:

1. Przejdź do Railway → Twój projekt → **PostgreSQL**
2. Otwórz **Query Editor**
3. Wykonaj zapytanie:
   ```sql
   SELECT * FROM "DeviceToken" LIMIT 10;
   ```
4. **Powinny być rekordy** z tokenami FCM

### 5.4. Test ręczny powiadomienia:

1. **Śledź jakiś kanał** w aplikacji mobilnej
2. **Poczekaj na harmonogram** (np. codzienne przypomnienie o 11:00)
3. **Lub przetestuj ręcznie** przez API:
   ```bash
   # Pobierz deviceId z bazy danych
   # Następnie wyślij testowe powiadomienie przez endpoint (jeśli istnieje)
   ```

---

## ✅ KROK 6: Weryfikacja końcowa

### Checklist:

- [ ] `FCM_SERVER_KEY` dodany na Railway
- [ ] Backend nie loguje "FCM_SERVER_KEY not configured"
- [ ] Aplikacja mobilna loguje "✅ FCM token registered in backend"
- [ ] W bazie danych są rekordy w tabeli `DeviceToken`
- [ ] Powiadomienia są wysyłane (sprawdź logi backendu)

---

## 🆘 Rozwiązywanie problemów

### Problem: "FCM_SERVER_KEY not configured" w logach

**Rozwiązanie:**
- Sprawdź, czy zmienna `FCM_SERVER_KEY` jest dodana na Railway
- Sprawdź, czy wartość jest poprawna (bez spacji na początku/końcu)
- Zrestartuj aplikację na Railway

### Problem: "Failed to register FCM token in backend"

**Rozwiązanie:**
- Sprawdź, czy backend działa (sprawdź logi Railway)
- Sprawdź, czy endpoint `/device/tokens` jest dostępny
- Sprawdź, czy `X-Device-Id` header jest wysyłany

### Problem: Brak rekordów w tabeli DeviceToken

**Rozwiązanie:**
- Sprawdź logi aplikacji mobilnej - czy token został zarejestrowany?
- Sprawdź, czy aplikacja ma dostęp do internetu
- Sprawdź, czy Firebase jest poprawnie skonfigurowany

### Problem: Powiadomienia nie przychodzą

**Rozwiązanie:**
- Sprawdź, czy `FCM_SERVER_KEY` jest poprawny
- Sprawdź, czy tokeny są w bazie danych
- Sprawdź, czy urządzenie ma włączone powiadomienia
- Sprawdź logi Firebase Console

---

## 📚 Dodatkowe informacje

- **Dokumentacja:** Zobacz `backend/POWIADOMIENIA_SETUP.md`
- **Zmienne środowiskowe:** Zobacz `backend/PRODUCTION_VARIABLES.md`
- **Firebase Console:** https://console.firebase.google.com/
- **Railway Dashboard:** https://railway.app/

---

## 🎉 Gotowe!

Po wykonaniu wszystkich kroków powiadomienia push powinny działać! 🚀

