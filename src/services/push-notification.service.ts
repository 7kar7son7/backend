import type { FastifyBaseLogger } from 'fastify';
import { fetch } from 'undici';
import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';

import { env } from '../config/env';
import { DeviceTokenService } from './device-token.service';
import { chunkArray } from '../utils/array';

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
  image?: string;
};

const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';
const MAX_TOKENS_PER_REQUEST = 1000;

export class PushNotificationService {
  private readonly deviceTokenService: DeviceTokenService;
  private firebaseAdmin: admin.app.App | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.deviceTokenService = new DeviceTokenService(prisma);
    this.initializeFirebaseAdmin();
  }

  private initializeFirebaseAdmin() {
    // Jeśli mamy Firebase Admin SDK credentials, użyj ich
    if (env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY && env.FCM_PROJECT_ID) {
      try {
        // Sprawdź czy już jest zainicjalizowane
        try {
          this.firebaseAdmin = admin.app();
        } catch {
          // Nie ma jeszcze zainicjalizowanego app, stwórz nowe
          const privateKey = env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n');
          this.firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert({
              projectId: env.FCM_PROJECT_ID,
              clientEmail: env.FCM_CLIENT_EMAIL,
              privateKey: privateKey,
            }),
          });
          this.logger.info('Firebase Admin SDK initialized');
        }
      } catch (error) {
        this.logger.warn({ error }, 'Failed to initialize Firebase Admin SDK');
      }
    }
  }

  async send(deviceIds: string[], message: PushMessage) {
    if (deviceIds.length === 0) {
      return;
    }

    // Pobierz tokeny FCM dla deviceIds
    const deviceTokens = await this.deviceTokenService.getTokensForDevices(deviceIds);
    const tokens = deviceTokens.map((dt) => dt.token).filter(Boolean);

    if (tokens.length === 0) {
      this.logger.debug({ deviceIds }, 'No FCM tokens found for deviceIds');
      return;
    }

    // Spróbuj użyć Firebase Admin SDK (nowsze API, lepsze)
    if (this.firebaseAdmin) {
      try {
        await this.sendWithAdminSDK(tokens, message);
        return;
      } catch (error) {
        this.logger.warn({ error }, 'Failed to send with Firebase Admin SDK, falling back to legacy API');
      }
    }

    // Fallback do legacy FCM API jeśli nie ma Admin SDK lub się nie udało
    if (!env.FCM_SERVER_KEY) {
      this.logger.warn(
        {
          count: deviceIds.length,
          title: message.title,
          body: message.body,
          data: message.data,
        },
        'FCM_SERVER_KEY not configured and Firebase Admin SDK not available - cannot send notifications',
      );
      return;
    }

    await this.sendWithLegacyAPI(tokens, message);
  }

  private async sendWithAdminSDK(tokens: string[], message: PushMessage) {
    if (!this.firebaseAdmin) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    this.logger.info(
      {
        tokenCount: tokens.length,
        title: message.title,
      },
      'Sending FCM push notifications via Firebase Admin SDK',
    );

    const messaging = admin.messaging(this.firebaseAdmin);
    const invalidTokens: string[] = [];

    // Firebase Admin SDK pozwala na max 500 tokenów na request
    const tokenChunks = chunkArray(tokens, 500);

    for (const chunk of tokenChunks) {
      try {
        const multicastMessage: admin.messaging.MulticastMessage = {
          notification: {
            title: message.title,
            body: message.body,
          },
          data: message.data ?? {},
          tokens: chunk,
        };

        if (message.image) {
          multicastMessage.android = {
            notification: {
              imageUrl: message.image,
            },
          };
          multicastMessage.apns = {
            payload: {
              aps: {
                'mutable-content': 1,
              },
            },
            fcmOptions: {
              imageUrl: message.image,
            },
          };
        }

        const response = await messaging.sendEachForMulticast(multicastMessage);

        // Zbierz nieprawidłowe tokeny
        response.responses.forEach((result, index) => {
          if (!result.success) {
            const error = result.error;
            if (
              error?.code === 'messaging/registration-token-not-registered' ||
              error?.code === 'messaging/invalid-registration-token'
            ) {
              const token = chunk[index];
              if (token) {
                invalidTokens.push(token);
              }
            }
          }
        });

        this.logger.info(
          {
            successCount: response.successCount,
            failureCount: response.failureCount,
          },
          'Firebase Admin SDK batch sent',
        );
      } catch (error) {
        this.logger.error(error, 'Failed to send FCM batch via Admin SDK');
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

  private async sendWithLegacyAPI(tokens: string[], message: PushMessage) {
    if (!env.FCM_SERVER_KEY) {
      throw new Error('FCM_SERVER_KEY not configured');
    }

    this.logger.info(
      {
        tokenCount: tokens.length,
        title: message.title,
      },
      'Sending FCM push notifications via legacy API',
    );

    // FCM pozwala na max 1000 tokenów na request, więc dzielimy na chunki
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
            'FCM request failed',
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
        this.logger.error(error, 'Failed to send FCM batch');
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
