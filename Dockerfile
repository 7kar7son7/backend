FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

RUN npm ci

RUN npx prisma generate

COPY src ./src
COPY static ./static/

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/
RUN chmod +x scripts/start-production.sh

# Produkcja: prisma CLI + @prisma/client (migrate deploy przy starcie)
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static

EXPOSE 3000

CMD ["sh", "scripts/start-production.sh"]
