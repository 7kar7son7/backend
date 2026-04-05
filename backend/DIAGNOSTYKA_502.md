# 🔍 Diagnostyka problemu 502 Bad Gateway

## Problem
Aplikacja dostaje **502 Bad Gateway** przy requestach do `backend.devstudioit.app`. Gdy request **dojdzie** do backendu, zwraca 200 i kanały działają. W **kodzie nic nie zmienialiśmy** – backend nadal nasłuchuje na tym samym porcie (3000) jak przy starym EPG; konfiguracji proxy nikt nie ruszał.

Czyli 502 zwraca **warstwa przed backendem** (hosting / reverse proxy). Możliwe przyczyny:
- po stronie hostingu (restart, inna instancja, błąd deployu),
- albo tymczasowe problemy (timeout, przeciążenie).

## Gdzie to sprawdzić

- **Jeśli backend hostujesz u kogoś (np. DevStudioIT.cloud):** w **panelu tego hostingu** – tam gdzie masz projekt/serwis backendu, domenę `backend.devstudioit.app` i ustawienia „na co kierować ruch”. Ewentualnie zapytaj support: czy serwis backendu działa i czy jest poprawnie wystawiony pod tą domeną.
- **Jeśli masz własny serwer (VPS) i sam stawiasz nginx/Caddy:** w **konfiguracji reverse proxy** na tym serwerze – virtual host / server block dla `backend.devstudioit.app` i proxy_pass na port, na którym działa Node (np. 3000).

Przydatny test: w przeglądarce `https://backend.devstudioit.app/health` – jeśli 200 i `{"status":"ok",...}`, to backend jest osiągalny; jeśli 502, request w ogóle do niego nie dochodzi.

---

## Dodatkowe możliwe przyczyny (gdy infrastruktura jest OK)
Backend działa po zbudowaniu, ale po jakimś czasie przestaje odpowiadać (błędy 502). Możliwe: timeouty, pamięć, crash procesu.

## Możliwe przyczyny

### 1. **Brak globalnych handlerów błędów** ✅ NAPRAWIONE
- **Problem:** Nieobsłużone wyjątki (`uncaughtException`, `unhandledRejection`) crashowały proces Node.js
- **Rozwiązanie:** Dodano globalne handlery błędów w `server.ts`
- **Status:** Naprawione w najnowszej wersji

### 2. **Problemy z połączeniem do bazy danych**
- **Problem:** Połączenie z bazą może się zrywać, a Prisma nie próbuje się ponownie połączyć
- **Rozwiązanie:** Dodano lepsze logowanie błędów i test połączenia przy starcie
- **Status:** Częściowo naprawione - monitoruj logi

### 3. **Limit pamięci na hostingu**
- **Problem:** EPG import może zużywać dużo pamięci (2GB limit w `NODE_OPTIONS`)
- **Objawy:** Proces może być zabijany przez system (OOM Killer)
- **Sprawdź:** Logi hostingu (DevStudioIT.cloud) - czy są komunikaty o braku pamięci
- **Rozwiązanie:** 
  - Zwiększ limit pamięci w `NODE_OPTIONS=--max-old-space-size=4096`
  - Lub zmniejsz `EPG_IMPORT_CHUNK_SIZE` (np. z 50 do 25)

### 4. **Timeouty na hostingu**
- **Problem:** Hosting może mieć limit czasu działania procesu
- **Objawy:** Proces jest zabijany po X minutach bezczynności
- **Sprawdź:** Dokumentacja DevStudioIT.cloud - czy mają limity czasu
- **Rozwiązanie:** 
  - Dodaj healthcheck endpoint który będzie pingowany co X minut
  - Lub skonfiguruj reverse proxy żeby nie timeoutował połączeń

### 5. **Problemy z reverse proxy (nginx/apache)**
- **Problem:** Reverse proxy może timeoutować połączenia do backendu
- **Objawy:** 502 Bad Gateway po jakimś czasie
- **Sprawdź:** Konfiguracja nginx/apache na DevStudioIT.cloud
- **Rozwiązanie:** Zwiększ timeouty w konfiguracji reverse proxy:
  ```nginx
  proxy_read_timeout 300s;
  proxy_connect_timeout 75s;
  proxy_send_timeout 300s;
  ```

### 6. **Problemy z cron jobs**
- **Problem:** Cron job (np. EPG import) może crashować proces
- **Objawy:** Backend crashuje podczas importu EPG
- **Status:** Cron jobs mają try-catch, ale sprawdź logi
- **Rozwiązanie:** Monitoruj logi podczas importu EPG

## Jak zdiagnozować problem

### 1. Sprawdź logi backendu
```bash
# W DevStudioIT.cloud sprawdź logi aplikacji
# Szukaj:
# - "UNCAUGHT EXCEPTION"
# - "UNHANDLED REJECTION"
# - "Database connection"
# - "EPG import"
# - "OOM" (Out of Memory)
```

### 2. Sprawdź logi hostingu
- Czy są komunikaty o braku pamięci?
- Czy są komunikaty o timeoutach?
- Czy proces jest zabijany przez system?

### 3. Sprawdź healthcheck
```bash
# Sprawdź czy healthcheck odpowiada
curl https://backend.devstudioit.app/health

# Powinno zwrócić:
# {"status":"ok","timestamp":"...","database":"ok"}
```

### 4. Monitoruj zużycie pamięci
- Sprawdź w panelu DevStudioIT.cloud czy backend zużywa dużo pamięci
- Jeśli tak, zwiększ limit lub zmniejsz `EPG_IMPORT_CHUNK_SIZE`

## Zalecane działania

1. **Wdróż najnowszą wersję** z globalnymi handlerami błędów
2. **Monitoruj logi** przez kilka dni
3. **Sprawdź konfigurację hostingu** - limity pamięci, timeouty
4. **Skonfiguruj healthcheck** jeśli hosting to wspiera
5. **Rozważ zwiększenie limitu pamięci** jeśli EPG import zużywa dużo

## Kontakt z hostingiem

Jeśli problem nadal występuje, skontaktuj się z DevStudioIT.cloud i zapytaj:
- Czy mają limity czasu działania procesu?
- Czy mają limity pamięci?
- Jak skonfigurować healthcheck?
- Jak zwiększyć timeouty w reverse proxy?

---

## Podsumowanie

- **502** = odpowiedź zwraca warstwa przed backendem (hosting/proxy). W kodzie backendu nic nie zmienialiśmy – nasłuchuje tak samo jak przy starym EPG (port 3000).
- Gdy request **dojdzie** do backendu → **200**, kanały się ładują.
- **Gdzie sprawdzić:** panel hostingu (gdzie ustawiasz domenę i serwis) albo, przy własnym VPS, konfig reverse proxy. Test: `https://backend.devstudioit.app/health`.

