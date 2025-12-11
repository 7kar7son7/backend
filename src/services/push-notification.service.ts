import type { FastifyBaseLogger } from 'fastify';
import { fetch } from 'undici';
import { PrismaClient } from '@prisma/client';

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

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.deviceTokenService = new DeviceTokenService(prisma);
  }

  async send(deviceIds: string[], message: PushMessage) {
    if (deviceIds.length === 0) {
      return;
    }

    // Jeśli brak klucza FCM, logujemy symulację
    if (!env.FCM_SERVER_KEY) {
      this.logger.warn(
        {
          count: deviceIds.length,
          title: message.title,
          body: message.body,
          data: message.data,
        },
        'FCM_SERVER_KEY not configured - simulating push notification dispatch',
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
      },
      'Sending FCM push notifications',
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
