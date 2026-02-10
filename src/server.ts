import { env } from './config/env';
import { buildApp } from './app';

// Globalne handlery błędów - zapobiegają crashowaniu procesu
process.on('uncaughtException', (error: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION - proces może się crashować:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
  // W produkcji lepiej pozwolić procesowi się crashować i pozwolić orchestratorowi (Railway/Docker) go zrestartować
  // niż kontynuować z nieznanym stanem
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('❌ UNHANDLED REJECTION - obietnica została odrzucona bez obsługi:', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
    } : reason,
    promise: promise.toString(),
  });
  // W produkcji logujemy ale nie crashujemy - unhandledRejection nie zawsze oznacza krytyczny błąd
  // Ale warto to monitorować
});

async function main() {
  const app = await buildApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    app.log.info(`🚀 Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
}

void main();

