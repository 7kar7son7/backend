# Konfiguracja powiadomień push (FCM)

## Problem: Powiadomienia nie działają

Powiadomienia push wymagają **dwóch rzeczy**:

1. **Backend musi mieć skonfigurowany `FCM_SERVER_KEY`**
2. **Aplikacja mobilna musi zarejestrować token FCM w backendzie**

## ✅ Co zostało naprawione

1. **Aplikacja mobilna teraz automatycznie rejestruje token FCM** przy starcie
2. **Token jest automatycznie odświeżany** gdy Firebase wygeneruje nowy token

## 🔧 Konfiguracja na Railway

### 1. Uzyskaj FCM Server Key

1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Wybierz swój projekt
3. Przejdź do **Project Settings** (⚙️) → **Cloud Messaging**
4. W sekcji **Cloud Messaging API (Legacy)** znajdź **Server key**
5. Skopiuj klucz

### 2. Dodaj zmienną na Railway

1. Przejdź do Railway → Twój projekt → **Variables**
2. Dodaj nową zmienną:
   - **Key:** `FCM_SERVER_KEY`
   - **Value:** Wklej skopiowany Server key z Firebase

### 3. Sprawdź, czy działa

Po dodaniu `FCM_SERVER_KEY`:
- Backend przestanie logować `"FCM_SERVER_KEY not configured - simulating push notification dispatch"`
- Powiadomienia będą rzeczywiście wysyłane do urządzeń

## 📱 Aplikacja mobilna

Aplikacja mobilna **automatycznie**:
- Pobiera token FCM przy starcie
- Rejestruje token w backendzie przez endpoint `/device/tokens`
- Odświeża token gdy Firebase wygeneruje nowy

**Nie wymaga żadnej dodatkowej konfiguracji!**

## 🧪 Testowanie

### Sprawdź, czy token jest zarejestrowany:

```bash
# Sprawdź w bazie danych Railway
# Powinny być rekordy w tabeli DeviceToken
```

### Sprawdź logi backendu:

```bash
# Powinieneś zobaczyć:
✅ "FCM token registered in backend" (w logach mobilnych)
✅ "Sending FCM push notifications" (w logach backendu przy wysyłce)
```

### Test ręczny:

1. Uruchom aplikację mobilną
2. Sprawdź logi aplikacji - powinieneś zobaczyć: `✅ FCM token registered in backend`
3. Sprawdź logi Railway - nie powinno być: `"FCM_SERVER_KEY not configured"`

## ⚠️ Ważne

- **Bez `FCM_SERVER_KEY`** backend tylko loguje symulację, ale nie wysyła powiadomień
- **Token musi być zarejestrowany** w backendzie, aby mógł wysłać powiadomienie do urządzenia
- **Token może się zmienić** - aplikacja automatycznie go odświeża

## 🔍 Diagnostyka

Jeśli powiadomienia nadal nie działają:

1. **Sprawdź logi backendu:**
   - Czy `FCM_SERVER_KEY` jest ustawione?
   - Czy są błędy przy wysyłaniu do FCM?

2. **Sprawdź logi aplikacji mobilnej:**
   - Czy token został zarejestrowany? (`✅ FCM token registered in backend`)
   - Czy są błędy przy rejestracji?

3. **Sprawdź Firebase Console:**
   - Czy projekt jest poprawnie skonfigurowany?
   - Czy Server key jest poprawny?

4. **Sprawdź bazę danych:**
   - Czy są rekordy w tabeli `DeviceToken`?
   - Czy `deviceId` w `DeviceToken` odpowiada `deviceId` w `FollowedItem`?

