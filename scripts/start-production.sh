#!/bin/sh
set -e

# Serwer startuje od razu (health check PaaS), migracje w tle.
# Prisma CLI musi być w dependencies (nie tylko devDependencies).
(
  npx prisma migrate deploy && echo "[start] prisma migrate deploy OK"
) || echo "[start] prisma migrate deploy WARN (serwer i tak wystartuje)" &

exec node --max-old-space-size=2048 dist/server.js
