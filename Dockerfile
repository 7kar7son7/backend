FROM node:20-alpine

WORKDIR /app

# Kopiuj pliki package
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Zainstaluj wszystkie zależności (też dev dla builda)
RUN npm ci

# Wygeneruj Prisma Client (przed buildem TypeScript)
RUN npx prisma generate

# Skopiuj kod źródłowy
COPY src ./src

# Zbuduj TypeScript
RUN npm run build

# Usuń dev dependencies (opcjonalne, oszczędza miejsce)
RUN npm prune --production

# Uruchom migracje i start z większym limitem pamięci dla dużych plików EPG
CMD ["sh", "-c", "npx prisma migrate deploy && node --max-old-space-size=2048 dist/server.js"]

