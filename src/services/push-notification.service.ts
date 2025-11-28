import type { FastifyBaseLogger } from 'fastify';
import { fetch } from 'undici';
import { PrismaClient } from '@prisma/client';
import { GoogleAuth } from 'google-auth-library';

import { env } from '../config/env';
import { DeviceTokenService } from './device-token.service';
import { chunkArray } from '../utils/array';

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

// V1 API endpoint
const getFcmEndpoint = (projectId: string) =>
  `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

const MAX_TOKENS_PER_REQUEST = 1000;

export class PushNotificationService {
  private readonly deviceTokenService: DeviceTokenService;
  private auth: GoogleAuth | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.deviceTokenService = new DeviceTokenService(prisma);
    this._initializeAuth();
  }

  private _initializeAuth() {
    // Użyj V1 API jeśli są dostępne dane Service Account
    if (
      env.FCM_PROJECT_ID &&
      env.FCM_CLIENT_EMAIL &&
      env.FCM_PRIVATE_KEY
    ) {
      try {
        // Zastąp \n w kluczu prywatnym (często jest w formacie string z \n)
        const privateKey = env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n');

        this.auth = new GoogleAuth({
          credentials: {
            client_email: env.FCM_CLIENT_EMAIL,
            private_key: privateKey,
          },
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
        this.logger.info('FCM V1 API initialized with Service Account');
      } catch (error) {
        this.logger.error(error, 'Failed to initialize FCM V1 API auth');
      }
    }
  }

  private async _getAccessToken(): Promise<string | null> {
    if (!this.auth) {
      return null;
    }

    try {
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      return accessToken.token || null;
    } catch (error) {
      this.logger.error(error, 'Failed to get FCM access token');
      return null;
    }
  }

  async send(deviceIds: string[], message: PushMessage) {
    if (deviceIds.length === 0) {
      return;
    }

    // Sprawdź czy mamy konfigurację V1 API lub Legacy
    const useV1Api =
      env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY;
    const useLegacyApi = env.FCM_SERVER_KEY;

    if (!useV1Api && !useLegacyApi) {
      this.logger.warn(
        {
          count: deviceIds.length,
          title: message.title,
          body: message.body,
          data: message.data,
        },
        'FCM not configured (neither V1 nor Legacy) - simulating push notification dispatch',
      );
      return;
    }

    // Pobierz tokeny FCM dla deviceIds
    const deviceTokens = await this.deviceTokenService.getTokensForDevices(deviceIds);
    const tokens = deviceTokens.map((dt) => dt.token).filter(Boolean);

    if (tokens.length === 0) {
      this.logger.debug({ deviceIds }, 'No FCM tokens found for deviceIds');
      return;
    }

    this.logger.info(
      {
        deviceCount: deviceIds.length,
        tokenCount: tokens.length,
        title: message.title,
        apiVersion: useV1Api ? 'V1' : 'Legacy',
      },
      'Sending FCM push notifications',
    );

    if (useV1Api) {
      await this._sendV1(tokens, message);
    } else {
      await this._sendLegacy(tokens, message);
    }
  }

  private async _sendV1(tokens: string[], message: PushMessage) {
    if (!env.FCM_PROJECT_ID) {
      return;
    }

    const accessToken = await this._getAccessToken();
    if (!accessToken) {
      this.logger.error('Failed to get FCM access token');
      return;
    }

    const endpoint = getFcmEndpoint(env.FCM_PROJECT_ID);
    const invalidTokens: string[] = [];

    // V1 API wymaga wysyłania każdej wiadomości osobno
    // Wysyłamy równolegle dla lepszej wydajności
    const promises = tokens.map(async (token) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title: message.title,
                body: message.body,
              },
              data: message.data
                ? Object.fromEntries(
                    Object.entries(message.data).map(([k, v]) => [k, String(v)]),
                  )
                : undefined,
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                },
              },
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          const json = JSON.parse(text) as { error?: { code?: number; message?: string } };

          // Sprawdź czy token jest nieprawidłowy
          if (
            json.error?.code === 404 ||
            json.error?.code === 400 ||
            json.error?.message?.includes('InvalidRegistration') ||
            json.error?.message?.includes('NotRegistered')
          ) {
            invalidTokens.push(token);
          } else {
            this.logger.error(
              { status: response.status, body: text, token: token.substring(0, 20) + '...' },
              'FCM V1 request failed',
            );
          }
          return;
        }

        // Sukces
        return;
      } catch (error) {
        this.logger.error(
          { error, token: token.substring(0, 20) + '...' },
          'Failed to send FCM V1 message',
        );
      }
    });

    await Promise.allSettled(promises);

    // Usuń nieprawidłowe tokeny z bazy
    if (invalidTokens.length > 0) {
      await this.deviceTokenService.removeInvalidTokens(invalidTokens);
      this.logger.info(
        { count: invalidTokens.length },
        'Removed invalid FCM tokens',
      );
    }
  }

  private async _sendLegacy(tokens: string[], message: PushMessage) {
    if (!env.FCM_SERVER_KEY) {
      return;
    }

    const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';
    const tokenChunks = chunkArray(tokens, MAX_TOKENS_PER_REQUEST);
    const invalidTokens: string[] = [];

    for (const chunk of tokenChunks) {
      try {
        const response = await fetch(FCM_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `key=${env.FCM_SERVER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registration_ids: chunk,
            notification: {
              title: message.title,
              body: message.body,
              sound: 'default',
            },
            data: message.data ?? {},
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(
            { status: response.status, body: text },
            'FCM Legacy request failed',
          );
          continue;
        }

        const json = (await response.json()) as {
          results?: Array<{ error?: string }>;
        };

        // Zbierz nieprawidłowe tokeny do usunięcia
        if (json?.results) {
          json.results.forEach((result, index) => {
            if (
              result.error &&
              ['NotRegistered', 'InvalidRegistration'].includes(result.error)
            ) {
              const invalidToken = chunk[index];
              if (invalidToken) {
                invalidTokens.push(invalidToken);
              }
            }
          });
        }
      } catch (error) {
        this.logger.error(error, 'Failed to send FCM Legacy batch');
      }
    }

    // Usuń nieprawidłowe tokeny z bazy
    if (invalidTokens.length > 0) {
      await this.deviceTokenService.removeInvalidTokens(invalidTokens);
      this.logger.info(
        { count: invalidTokens.length },
        'Removed invalid FCM tokens',
      );
    }
  }
}
