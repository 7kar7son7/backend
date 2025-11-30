import { FastifyInstance } from 'fastify';

export default async function appRoutes(app: FastifyInstance) {
  app.get('/version', async () => {
    // Najnowsza wersja aplikacji
    // Format: "1.0.26" (bez build number)
    return {
      data: {
        version: '1.0.26',
        buildNumber: 62,
        minRequiredVersion: '1.0.20', // Minimalna wymagana wersja (opcjonalnie)
        updateUrl: 'https://play.google.com/store/apps/details?id=com.backontv.app',
      },
    };
  });
}

