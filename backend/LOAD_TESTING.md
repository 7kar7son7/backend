# Testy obciążeniowe (wydajność)

## Wymagania

- **10k równoczesnych użytkowników** – symulacja ruchu (GET kanały, programy, health).
- **50k równoczesnych zgłoszeń** – symulacja masowego POST „Koniec reklam” (POST /events).
- **Monitoring:** CPU, RAM, czas żądania – backend loguje każdy request i udostępnia `/health/metrics`.

## Monitoring w backendzie

- **Czas żądania (request time):** każda odpowiedź jest logowana z polem `responseTimeMs` (Pino).
- **Błędy:** wszystkie błędy HTTP trafiają do `setErrorHandler` i są logowane z `reqId`, `method`, `url`, `statusCode`.
- **CPU / RAM:** `GET /health/metrics` zwraca:
  - `memory.heapUsedMb`, `memory.rssMb`
  - `cpu.loadAvg1m`, `cpu.loadAvg5m`, `cpu.loadAvg15m`

Przykład odpytywania metryk (co 10 s):

```bash
watch -n 10 'curl -s http://localhost:3000/health/metrics | jq'
```

## Narzędzia do testów

### k6 (zalecane)

Instalacja: https://k6.io/docs/get-started/installation/

```bash
# Windows (scoop)
scoop install k6
```

### Test 1: 10k równoczesnych użytkowników

Symulacja: wiele równoczesnych użytkowników odpytuje GET (health, channels, events).  
Zachowaj BASE_URL i ewentualnie nagłówki (X-Device-Id) jeśli wymagane.

Zapisz jako `load-10k-users.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 2000 },
    { duration: '2m', target: 10000 },
    { duration: '2m', target: 10000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health ok': (r) => r.status === 200 });

  const res2 = http.get(`${BASE_URL}/channels`, {
    headers: { 'X-Device-Id': `load-test-${__VU}-${__ITER}` },
  });
  check(res2, { 'channels ok': (r) => r.status === 200 });

  sleep(0.5 + Math.random());
}
```

Uruchomienie:

```bash
k6 run load-10k-users.js
# Z zewnętrznym URL:
BASE_URL=https://twoja-domena.pl k6 run load-10k-users.js
```

### Test 2: 50k równoczesnych zgłoszeń (POST /events)

Wymaga **prawidłowego `programId`** (UUID programu z bazy). Można je wziąć z API (GET /programs lub z bazy).

- Rate limit: domyślnie 10 POST /events na device na minutę – żeby symulować 50k zgłoszeń, każdy wirtualny użytkownik musi mieć inny `X-Device-Id` (np. `load-event-${__VU}-${__ITER}`), wtedy limit nie uderza w pojedynczy device.
- W jednym przebiegu można mieć 50k VUs, każdy wysyła 1 POST, albo mniej VUs i wiele iteracji.

Zapisz jako `load-50k-events.js`:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10000 },
    { duration: '2m', target: 50000 },
    { duration: '2m', target: 50000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PROGRAM_ID = __ENV.PROGRAM_ID || '00000000-0000-0000-0000-000000000000'; // zastąp prawdziwym UUID z bazy

export default function () {
  const payload = JSON.stringify({ programId: PROGRAM_ID });
  const res = http.post(`${BASE_URL}/events`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': `load-event-${__VU}-${__ITER}-${Date.now()}`,
    },
  });
  check(res, (r) => r.status === 200 || r.status === 201 || r.status === 409);
}
```

Uruchomienie (podaj prawdziwe PROGRAM_ID z bazy):

```bash
PROGRAM_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx k6 run load-50k-events.js
```

## Wyniki

- k6 podsumowuje: średni/czasy percentyli żądań, liczba błędów, żądań/s.
- Równolegle monitoruj backend: logi (responseTimeMs), `GET /health/metrics` (CPU/RAM).
- W razie problemów: zwiększ zasoby serwera, sprawdź limity połączeń do bazy i rate limity w env (np. `EVENT_RATE_LIMIT_CREATE_PER_MIN`).
