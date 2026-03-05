## Specyfikacja Aplikacji Mobilnej „Telemagazyn Events”

### 1. Cel projektu
- **Główna funkcja**: mobilna aplikacja (Android + iOS) umożliwiająca przegląd programu TV, śledzenie audycji oraz obsługę systemu wydarzeń z powiadomieniami push.
- **Model użytkownika**: brak kont, identyfikacja urządzenia po lokalnym `deviceId`.
- **Docelowy poziom jakości**: MVP gotowe do publikacji w Google Play i App Store, z zachowaniem wytycznych UI/UX.

### 2. Stos technologiczny
- **Frontend mobilny**: Flutter 3.x (Dart), architektura MVVM + Riverpod.
- **Backend/API**: Node.js 20 LTS, framework Fastify, TypeScript, uruchomienie w środowisku on-prem (w ramach projektu).
- **Baza danych**: Branchly Cloud (PostgreSQL) – połączenie `postgresql://admin:ywBo4LmfUTfdKz2glFD3CUuP@57.129.12.11:5432/branchly_0769ebfb_cbb1_4782_9fc8_c758fc7380b9_main?sslmode=disable`.
- **Migrations/ORM**: Prisma (TypeScript) do definicji schematów i migracji.
- **Powiadomienia push**: Firebase Cloud Messaging (FCM) + Apple Push Notification service (pośrednio przez FCM).
- **Hosting API**: dockerowy kontener z webhookami FCM, reverse proxy (np. Caddy) – konfiguracja do ustalenia na etapie wdrożenia.
- **Kontrola wersji**: Git (repozytorium prywatne).

### 3. Architektura systemu
- **Warstwa danych**:
  - Tabela `channels`: lista kanałów TV (nazwa, identyfikator z EPG, opcjonalny URL logotypu).
  - Tabela `programs`: programy TV (kanał, tytuł, opis, godziny emisji, identyfikator odcinka).
  - Tabela `followed_items`: relacje urządzenie–kanał/program, typ, znaczniki czasowe.
  - Tabela `events`: zgłoszone wydarzenia (program, czas inicjacji, źródło – deviceId, status).
  - Tabela `event_confirmations`: odpowiedzi użytkowników (pole wyboru 1 lub 2, czas reakcji, opóźnienie).
  - Tabela `reminder_log`: odnotowane wysyłki przypomnień (limit 2 per wydarzenie, max 8 dziennie, blok nocny).
  - Tabela `points`: bilans punktów per deviceId oraz log przyznania (typ, wartość, data).
- **Integracje**:
  - Import danych EPG z darmowych źródeł (np. IPTV-Org). Harmonogram CRON co 3h: pobranie feedu, mapowanie kanałów, aktualizacja tabel `channels` i `programs`.
  - FCM do wysyłki powiadomień (topic per program + fallback na device tokeny).
- **Logika wydarzeń**:
  - Urządzenie A klikając „Uruchom wydarzenie” tworzy rekord w `events` (status `pending`).
  - Backend wysyła push do pozostałych obserwujących (topic `program:{id}`).
  - Zliczanie potwierdzeń w `event_confirmations`; po osiągnięciu progu (5–10) status `validated`.
- **Mechanizm przypomnień**:
  - Worker w tle (Node cron job) sprawdza `events` z brakiem reakcji i generuje przypomnienia FCM (max 2, zachowanie limitu dziennego i wyłączenie nocne 22:00–07:00).
  - Flutter używa `WorkManager` (Android) i `background_fetch` (iOS) do lokalnych przypomnień w razie braku internetu.

### 4. Funkcjonalności aplikacji
- **Onboarding**:
  - 3–4 slajdy z animacjami, objaśniające zasady działania (śledzenie, uruchamianie wydarzeń, punkty).
  - Akceptacja regulaminu (checkbox).
- **Ekran główny**:
  - Zakładki: `Kanały`, `Programy`, `Moje`.
  - Tryb dzienny/nocny (przełącznik w ustawieniach i auto-detekcja systemowa).
- **Lista kanałów**:
  - Wyszukiwarka, filtry (alfabetycznie, kategorie).
  - Co kilka pozycji placeholder reklamy (możliwość ukrycia w przyszłości).
  - Przycisk `Śledź` per kanał (zmiana na `Śledzony` po aktywacji).
- **Program TV kanału**:
  - Oś czasu na 7 dni, sekcja „Dzisiaj”, „Jutro”, „Wkrótce”.
  - Detale programu: tytuł, opis, godziny, status (`Na żywo`, `Wkrótce`, `Zakończone`), cta `Śledź program`.
- **System wydarzeń**:
  - Dla śledzonych programów UI wyświetla kartę „Rozpocznij wydarzenie”.
  - Po inicjacji – event tracker (liczba potwierdzeń, pozostały czas).
  - Odbiorcy otrzymują push „Wydarzenie — potwierdź”; kliknięcie otwiera modal.
- **Popup potwierdzenia**:
  - Modal pełnoekranowy, półprzezroczyste tło, duże przyciski `1` i `2`, link `Odłóż na chwilę`.
  - Miejsce na 2–3 banery (placeholder grafiki + etykieta „Reklama”).
  - Zamyka się po kliknięciu, automatyczne zliczenie do punktów.
- **Przypomnienia**:
  - Lokalny licznik przypomnień (max 2/zdarzenie, max 8/dzień).
  - Tryb nocny wyłącza wysyłkę (22:00–07:00).
- **Punkty i aktywność**:
  - Ekran `Moje` pokazuje saldo punktów, historię (ostatnie 10 aktywności), progi (np. 100 – mniej reklam).
  - Gamifikacja: badge za streak 3 dni, 7 dni, 30 dni.
- **Ustawienia**:
  - Przełączniki: `Dźwięk powiadomień`, `Wibracja`, `Tryb nocny` (manualny + auto).
  - Lista śledzonych kanałów/programów z możliwością usunięcia.
  - Sekcja „O aplikacji” (wersja, polityka prywatności, kontakt).

### 5. UX/UI
- **Kolorystyka**: gradienty (np. fiolet → granat) w trybie dziennym, kontrastowe akcenty neonowe w trybie nocnym.
- **Typografia**: Inter / SF Pro (iOS) z fallbackiem Roboto (Android), rozmiary min. 16 pt.
- **Komponenty**:
  - Karty kanałów: zaokrąglenie 16 px, cienie warstwy 2.
  - Przyciski: `Filled` z animacją skali, minimum 48 px wysokości.
  - Animacje hero transition, `Implicit animations` dla przełączania zakładek.
- **Dostępność**:
  - Kontrast WCAG AA.
  - Tłumaczenia PL/EN (system lokalizacji Flutter `intl`).
  - Wsparcie dla screen readerów (semantyczne labelki).

### 6. Integracje i konfiguracja
- **Firebase**:
  - Projekt FCM z dwoma aplikacjami (Android/iOS).
  - Konfiguracja kanalów (`notification_channel` na Android 13+) dla dźwięków/wibracji.
  - Obsługa tokenów: rejestracja w backendzie, mapowanie na deviceId.
- **Branchly/Prisma**:
  - Definicje modeli, migracje startowe (struktur wymienionych w sekcji 3).
  - Seed initial: import kanałów + programów z pliku EPG.
- **Import EPG**:
  - Cron `0 */3 * * *` – pobranie feedu XML/JSON, transformacja do tabel, flagowanie aktualizacji.
  - Fallback: manualny import (CLI) w razie awarii.

### 7. Logika powiadomień i limitów
- **Event pipeline**:
  1. Użytkownik inicjuje → API tworzy `events`, status `pending`, timestamp.
  2. Backend wysyła push do `program:{id}` (FCM topic).
  3. Aplikacja lokalnie zapisuje event w pamięci, wyświetla modal.
  4. Reakcja `1`/`2` → POST `/events/{id}/confirm`, zapis w `event_confirmations`, obliczenie opóźnienia.
  5. Jeśli brak reakcji: po 2 minutach przypomnienie #1; po kolejnych 5 minutach przypomnienie #2 (jeśli limit dobowy na urządzeniu nie przekroczony).
- **Limity**:
  - 8 przypomnień dziennie/urządzenie – egzekwowane w aplikacji + backendzie.
  - Blokada nocna – lokalny scheduler i backend sprawdzają godzinę w strefie użytkownika (wyznaczanej z ustawień systemowych).

### 8. System punktowy
- **Typy akcji**:
  - `FAST_CONFIRM`: potwierdzenie do 60 sekund od powiadomienia – 5 pkt.
  - `REMINDER_CONFIRM`: potwierdzenie po przypomnieniu – 3 pkt.
  - `DAILY_STREAK`: codzienna aktywność – 2 pkt dziennie + bonusy za serie (np. 20 pkt za 7 dni pod rząd).
- **Nagrody**:
  - 100 pkt – redukcja reklam w pop-upie do 1 banera.
  - 250 pkt – odznaka `Aktywny`.
  - 500 pkt – odznaka `Mistrz Wydarzeń`.
- **Reset**: brak kar za brak aktywności; streak resetuje się po 48 h braku potwierdzenia.

### 9. Bezpieczeństwo i prywatność
- Brak danych osobowych, identyfikacja tylko przez `deviceId` + token FCM.
- Połączenia API szyfrowane TLS (reverse proxy).
- Ograniczenie dostępu do bazy Branchly (lista IP + role).
- Polityka prywatności: informacja o braku danych osobowych, wykorzystaniu FCM i Branchly.

### 10. Testy i jakość
- **Testy jednostkowe**: logika Riverpod, serwisy FCM, konwersje EPG.
- **Testy integracyjne**: API endpoints (Fastify + Prisma + Postgres).
- **Testy end-to-end**: Flutter `integration_test` – główne scenariusze (śledzenie, wydarzenie, przypomnienia).
- **Monitoring**: wstępna integracja z Firebase Crashlytics.

### 11. Publikacja i wsparcie
- Przygotowanie listingów w Google Play / App Store (teksty PL/EN, screenshoty).
- Konfiguracja certyfikatów (iOS provisioning, Android keystore).
- Instrukcja wdrożenia (README, komendy startowe, migracje).
- 30 dni wsparcia powdrożeniowego (poprawki krytycznych błędów).

### 12. Harmonogram (zgodnie z umową)
- **Tydzień 1**: analiza, doprecyzowanie wymagań, makiety UX, przygotowanie schematu bazy.
- **Tydzień 2–5**: implementacja (frontend + backend + integracje).
- **Tydzień 6–7**: testy manualne i automatyczne, optymalizacja, przygotowanie do publikacji.


