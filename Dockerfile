FROM node:20-alpine

WORKDIR /app

# Kopiuj pliki package
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Zainstaluj wszystkie zależności (też dev dla builda)
RUN npm ci

# Skopiuj kod źródłowy
COPY src ./src

# Zbuduj TypeScript
RUN npm run build

# Wygeneruj Prisma Client
RUN npx prisma generate

# Usuń dev dependencies (opcjonalne, oszczędza miejsce)
RUN npm prune --production

# Uruchom migracje i start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

