# Konfiguracja AKPA – kanały i logotypy

Aplikacja wyświetla listę kanałów z **bazy danych**. Kanały trafiają do bazy dopiero po **imporcie EPG ze źródła AKPA**. Jeśli lista kanałów jest pusta, najpierw skonfiguruj zmienne środowiskowe, a potem uruchom import.

## 1. Zmienne środowiskowe (`.env` lub panel hostingu)

Dodaj do pliku `backend/.env` (lokalnie) lub do zmiennych środowiskowych na produkcji:

### API EPG (wymagane do listy kanałów)

```env
# Źródło: AKPA (gdy ustawione, import pobiera kanały z api-epg.akpa.pl)
AKPA_API_URL=https://api-epg.akpa.pl/api/v1
AKPA_API_TOKEN=q5h9PB50WYL5x6G0tjiVN77hTAGfDwnDLzoXpP8zVjDrzeXz1ZNnJ57odNrv6rcM

# Opcjonalnie: typ autoryzacji (Bearer / Token / X-Api-Key). Domyślnie Bearer.
# AKPA_AUTH_TYPE=Bearer

# Jawnie ustaw źródło na AKPA (jeśli masz też EPG_SOURCE_URL, żeby nie użyć IPTV)
EPG_SOURCE=akpa
```

### Import przy starcie (zalecane)

```env
EPG_AUTO_IMPORT_ENABLED=true
EPG_AUTO_IMPORT_RUN_ON_START=true
```

### Logotypy kanałów (opcjonalne)

Logotypy z aktualnej oferty:

```env
AKPA_LOGOS_BASE_URL=https://logotypy.akpa.pl/logotypy-tv
AKPA_LOGOS_USER=logotypy_tv
AKPA_LOGOS_PASSWORD=logos_2024@
```

Ostatnie rebrandingi (fallback):

```env
AKPA_LOGOS_NEW_BASE_URL=https://logotypy.akpa.pl/nowe-logotypy
AKPA_LOGOS_NEW_USER=nowe_logotypy
AKPA_LOGOS_NEW_PASSWORD=zmiany2019a1
```

## 2. Uruchomienie importu

- **Przy starcie backendu** – jeśli `EPG_AUTO_IMPORT_RUN_ON_START=true` (domyślnie przy AKPA), import uruchomi się sam po starcie serwera.
- **Ręcznie (bez restartu)** – wywołaj:
  ```http
  POST /epg/import
  ```
  (np. z Postmana lub `curl -X POST https://TwojBackend/epg/import`)

Po udanym imporcie endpoint `GET /channels` zwróci listę kanałów z AKPA, a aplikacja mobilna będzie mogła je wyświetlić.

## 3. Sprawdzenie

- Logi backendu przy starcie: szukaj wpisów typu `Import EPG z AKPA`, `Pobrano X kanałów z API AKPA`, `AKPA: zaimportowano X kanałów`.
- Test API kanałów: `GET https://TwojBackend/channels` – powinna wrócić lista z polami `id`, `name`, `logoUrl` itd.

## Dlaczego brak listy kanałów?

1. **Brak `AKPA_API_TOKEN`** – backend nie wie, że ma używać AKPA; import nie pobiera kanałów.
2. **`EPG_SOURCE=iptv`** – wymusza źródło IPTV zamiast AKPA.
3. **Import nigdy nie został uruchomiony** – po ustawieniu zmiennych trzeba zrestartować backend (run on start) lub wywołać `POST /epg/import`.
4. **Błąd importu (np. 403)** – sprawdź logi; ewentualnie zmień `AKPA_AUTH_TYPE` na `Token` lub `X-Api-Key`.
