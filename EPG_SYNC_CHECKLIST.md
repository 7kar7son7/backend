# Checklist: automatyczna synchronizacja EPG (AKPA)

## 1. Automatyczne pobieranie z API AKPA

| Wymaganie | Status | Opis |
|-----------|--------|------|
| Harmonogram min. co kilka godzin | Tak | Domyślnie cron `0 */6 * * *` (co 6 h) przy źródle AKPA. Zmienna `EPG_AUTO_IMPORT_SCHEDULE` (np. `0 */4 * * *` = co 4 h). |
| Import przy starcie serwera | Tak | `EPG_AUTO_IMPORT_RUN_ON_START=true` (domyślnie przy AKPA). |
| Strefa czasowa crona | Tak | `EPG_AUTO_IMPORT_TIMEZONE=Europe/Warsaw` (domyślnie). |

## 2. Nadpisywanie zmian w ramówce

| Wymaganie | Status | Opis |
|-----------|--------|------|
| Programy się przesuwają | Tak | Import używa `upsert` po `externalId` – istniejące programy są aktualizowane (tytuł, start, end itd.). |

## 3. Usuwanie danych starszych niż 14 dni (zgodnie z licencją)

| Wymaganie | Status | Opis |
|-----------|--------|------|
| Usuwanie starych programów | Tak | Po każdym imporcie AKPA wywoływane jest `pruneOldPrograms(maxAgeDays)`. Domyślnie **14 dni** (`EPG_PRUNE_MAX_AGE_DAYS=14`). Usuwane są programy z `endsAt < (now - maxAgeDays)`. |

## 4. Obsługa błędów importu

| Wymaganie | Status | Opis |
|-----------|--------|------|
| Log | Tak | Błędy logowane przez `app.log.error` (szczegóły + stack). |
| Alert | Opcjonalnie | Obecnie brak wbudowanego alertu (mail/webhook). Można podpiąć monitoring logów (np. Railway, Sentry) lub dodać `ADMIN_ALERT_WEBHOOK_URL`. |
| Kontynuacja przy błędzie chunka | Tak | Błąd zapisu jednego chunka programów nie przerywa importu – log + następny kanał. |

## 5. Fallback gdy API chwilowo niedostępne

| Wymaganie | Status | Opis |
|-----------|--------|------|
| Zachowanie poprzednich danych | Tak | Przy błędzie importu (np. timeout AKPA) **nie** nadpisujemy bazy – poprzednia ramówka zostaje. Kolejny udany import nadpisuje. |
| Retry auth AKPA | Tak | Przy 403 importer próbuje różnych metod auth (Bearer, Token, X-Api-Key, query param). |

## 6. Spójność strefy czasowej

| Wymaganie | Status | Opis |
|-----------|--------|------|
| Cron w Europe/Warsaw | Tak | `EPG_AUTO_IMPORT_TIMEZONE=Europe/Warsaw`. |
| Powiadomienia (czas lokalny) | Tak | W powiadomieniach używane `Europe/Warsaw` do wyświetlania czasu. |
| Daty z API | Tak | AKPA zwraca ISO 8601 (UTC). W bazie przechowujemy UTC; prezentacja w aplikacji/powiadomieniach w strefie użytkownika (PL). |

---

## Zmienne środowiskowe (skrót)

- `EPG_AUTO_IMPORT_ENABLED` – włączenie auto-importu (domyślnie true przy AKPA).
- `EPG_AUTO_IMPORT_SCHEDULE` – cron (domyślnie `0 */6 * * *` dla AKPA).
- `EPG_AUTO_IMPORT_TIMEZONE` – strefa crona (domyślnie `Europe/Warsaw`).
- `EPG_AUTO_IMPORT_RUN_ON_START` – import przy starcie (domyślnie true przy AKPA).
- `EPG_PRUNE_MAX_AGE_DAYS` – po ilu dniach usuwać zakończone programy (domyślnie **14** przy AKPA).
- `AKPA_API_TOKEN`, `AKPA_API_URL` – wymagane do importu z AKPA.
