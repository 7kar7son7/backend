import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

// Konfiguracja Prisma Client z lepszą obsługą błędów i timeoutów
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error', 'warn'],
  errorFormat: 'pretty',
});

// Obsługa błędów połączenia z bazą danych
prisma.$on('error' as never, (e: { message: string; target?: string }) => {
  console.error('❌ Prisma Client Error:', e);
});

export default fp(async (fastify) => {
  // Test połączenia przy starcie
  try {
    await prisma.$connect();
    fastify.log.info('✅ Database connection established');
  } catch (error) {
    fastify.log.error(error, '❌ Failed to connect to database');
    throw error;
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
    fastify.log.info('Database connection closed');
  });
});

