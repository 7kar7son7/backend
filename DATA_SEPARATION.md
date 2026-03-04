# Oddzielenie danych EPG od danych użytkowników

Dokument opisuje podział danych w bazie (zgodność z umową/licencją) oraz procedurę usunięcia danych przy zakończeniu umowy.

## Dane EPG (ramówka)

Są to dane pochodzące z dostawcy EPG (np. AKPA), nie przypisane do konkretnych użytkowników:

| Tabela | Opis |
|--------|------|
| `channels` | Kanały TV |
| `programs` | Programy (emisje) z datami startu/końca |
| `program_notification_log` | Log wysłanych powiadomień o starcie programu |

**Retencja:** Programy zakończone starsze niż **14 dni** są automatycznie usuwane (cron codziennie o 4:00 oraz przy każdym imporcie EPG). Wartość konfigurowalna: `EPG_PRUNE_MAX_AGE_DAYS` (domyślnie 14).

## Dane użytkowników

Dane powiązane z urządzeniami/użytkownikami (RODO, umowa):

| Tabela | Opis |
|--------|------|
| `point_entries` | Wpisy punktów (powiązane z eventami i saldem) |
| `point_balance` | Saldo punktów per urządzenie |
| `reminder_log` | Log wysłanych przypomnień (push/local) |
| `event_confirmations` | Potwierdzenia „koniec reklam” |
| `events` | Zgłoszenia „koniec reklam” |
| `followed_items` | Obserwowane kanały/programy |
| `device_tokens` | Tokeny FCM do push |
| `blocked_devices` | Zablokowane urządzenia (nadużycia) |
| `device_reputation` | Reputacja urządzeń (opcjonalnie) |

## Usunięcie danych przy zakończeniu umowy

Endpoint **POST /app/delete-data** (prefiks zależny od rejestracji tras; np. `POST /app/delete-data`).

- **Autoryzacja:** nagłówek `X-Admin-Secret` = wartość `ADMIN_EVENT_SECRET` z konfiguracji.
- **Body (JSON):**
  - `scope`: `"user"` – usuwa tylko tabele z danymi użytkowników (patrz wyżej).
  - `scope`: `"all"` – usuwa dane użytkowników **oraz** dane EPG (channels, programs, program_notification_log).
  - `confirm`: **musi być `true`** – zabezpieczenie przed przypadkowym wywołaniem.

**Przykład (tylko dane użytkowników):**
```bash
curl -X POST "https://<API>/app/delete-data" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: <ADMIN_EVENT_SECRET>" \
  -d '{"scope":"user","confirm":true}'
```

**Przykład (wszystko, w tym EPG):**
```bash
curl -X POST "https://<API>/app/delete-data" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: <ADMIN_EVENT_SECRET>" \
  -d '{"scope":"all","confirm":true}'
```

Odpowiedź zwraca liczbę usuniętych rekordów per tabela, np. `{ "status": "ok", "scope": "user", "deleted": { "point_entries": 100, ... } }`.

## Automatyczne czyszczenie EPG (>14 dni)

- **Cron:** codziennie o 4:00 (timezone: `EPG_AUTO_IMPORT_TIMEZONE`, domyślnie Europe/Warsaw) uruchamiany jest job „EPG prune”, który wywołuje usuwanie programów zakończonych starszych niż `EPG_PRUNE_MAX_AGE_DAYS` (domyślnie 14).
- Dodatkowo przy każdym imporcie EPG (np. co 6 h) wykonywane jest to samo czyszczenie – cron stanowi zabezpieczenie, gdy import przez dłuższy czas się nie wykona.
