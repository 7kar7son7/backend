import { env } from './config/env';
import { buildApp } from './app';

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

