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
          this.logger.info('Firebase Admin SDK already initialized');
        } catch {
          // Nie ma jeszcze zainicjalizowanego app, stwórz nowe
          // Parsuj klucz prywatny - zamień \n na rzeczywiste znaki nowej linii
          // i usuń białe znaki na początku/końcu
          let privateKey = env.FCM_PRIVATE_KEY.trim();
          
          // Logowanie do debugowania formatu klucza - BARDZO SZCZEGÓŁOWE
          this.logger.error({
            originalKeyLength: env.FCM_PRIVATE_KEY.length,
            originalKeyFirstChars: env.FCM_PRIVATE_KEY.substring(0, 100),
            originalKeyLastChars: env.FCM_PRIVATE_KEY.substring(Math.max(0, env.FCM_PRIVATE_KEY.length - 100)),
            hasNewlines: env.FCM_PRIVATE_KEY.includes('\n'),
            hasLiteralN: env.FCM_PRIVATE_KEY.includes('\\n'),
            hasColons: env.FCM_PRIVATE_KEY.includes(':'),
            hasBegin: env.FCM_PRIVATE_KEY.includes('-----BEGIN'),
            hasEnd: env.FCM_PRIVATE_KEY.includes('-----END'),
            looksLikeBase64: /^[A-Za-z0-9+/=:]+$/.test(env.FCM_PRIVATE_KEY),
            firstChar: env.FCM_PRIVATE_KEY[0],
            lastChar: env.FCM_PRIVATE_KEY[env.FCM_PRIVATE_KEY.length - 1],
            // Pełny klucz (UWAGA: to może być długie!)
            fullKey: env.FCM_PRIVATE_KEY,
          }, 'FCM_PRIVATE_KEY FULL ANALYSIS - DEBUGGING');
          
          // Jeśli klucz wygląda jak base64 z dwukropkami (Railway może tak kodować), spróbuj zdekodować
          // Railway może kodować klucz w base64 i dzielić go na części z dwukropkami
          if (privateKey.includes(':') && !privateKey.includes('-----BEGIN') && /^[A-Za-z0-9+/=:]+$/.test(privateKey)) {
            this.logger.info('Detected base64-encoded key with colons, attempting to decode...');
            try {
              // Połącz części base64 (usunąć dwukropki) i zdekoduj
              const base64String = privateKey.replace(/:/g, '');
              
              // Sprawdź czy base64 jest poprawny (długość powinna być wielokrotnością 4)
              const paddingNeeded = (4 - (base64String.length % 4)) % 4;
              const paddedBase64 = base64String + '='.repeat(paddingNeeded);
              
              const decoded = Buffer.from(paddedBase64, 'base64').toString('utf-8');
              
              this.logger.error({
                originalLength: privateKey.length,
                base64Length: base64String.length,
                paddedLength: paddedBase64.length,
                decodedLength: decoded.length,
                decodedFirstChars: decoded.substring(0, 200),
                decodedLastChars: decoded.substring(Math.max(0, decoded.length - 200)),
                decodedFull: decoded, // Pełny zdekodowany string do debugowania
                hasBegin: decoded.includes('-----BEGIN'),
                hasEnd: decoded.includes('-----END'),
                isJSON: (() => {
                  try {
                    JSON.parse(decoded);
                    return true;
                  } catch {
                    return false;
                  }
                })(),
              }, 'Base64 decoded key - FULL DEBUG');
              
              // Jeśli dekodowanie dało poprawny PEM, użyj go
              if (decoded.includes('-----BEGIN PRIVATE KEY-----') && decoded.includes('-----END PRIVATE KEY-----')) {
                privateKey = decoded;
                this.logger.info('Successfully decoded base64 key to PEM format');
              } else {
                // Może być to JSON z kluczem wewnątrz - spróbuj sparsować jako JSON
                try {
                  const jsonParsed = JSON.parse(decoded);
                  if (jsonParsed.private_key || jsonParsed.privateKey || jsonParsed.key) {
                    const extractedKey = jsonParsed.private_key || jsonParsed.privateKey || jsonParsed.key;
                    if (extractedKey && extractedKey.includes('-----BEGIN PRIVATE KEY-----') && extractedKey.includes('-----END PRIVATE KEY-----')) {
                      privateKey = extractedKey;
                      this.logger.info('Successfully extracted PEM key from decoded JSON');
                    } else {
                      // Może być to base64 w JSON - spróbuj zdekodować jeszcze raz
                      if (typeof extractedKey === 'string' && /^[A-Za-z0-9+/=]+$/.test(extractedKey)) {
                        try {
                          const doubleDecoded = Buffer.from(extractedKey, 'base64').toString('utf-8');
                          if (doubleDecoded.includes('-----BEGIN PRIVATE KEY-----') && doubleDecoded.includes('-----END PRIVATE KEY-----')) {
                            privateKey = doubleDecoded;
                            this.logger.info('Successfully double-decoded base64 key from JSON');
                          } else {
                            this.logger.warn('Decoded base64 does not contain valid PEM markers, trying other methods...');
                          }
                        } catch (doubleDecodeError) {
                          this.logger.warn('Failed to double-decode base64, trying other methods...');
                        }
                      } else {
                        this.logger.warn('Decoded base64 does not contain valid PEM markers, trying other methods...');
                      }
                    }
                  } else {
                    this.logger.warn('Decoded base64 does not contain valid PEM markers, trying other methods...');
                  }
                } catch (jsonError) {
                  // Nie jest to JSON - może być to base64-encoded PEM bezpośrednio
                  // Spróbuj użyć zdekodowanego stringa jako klucza, jeśli wygląda na PEM
                  if (decoded.trim().startsWith('-----BEGIN') && decoded.trim().includes('-----END')) {
                    privateKey = decoded;
                    this.logger.info('Using decoded string as PEM key (looks like PEM without markers)');
                  } else {
                    this.logger.warn('Decoded base64 does not contain valid PEM markers, trying other methods...');
                  }
                }
              }
            } catch (decodeError) {
              this.logger.warn({ error: decodeError }, 'Failed to decode base64 key, trying other methods...');
            }
          }
          
          // Zamień literalne \n na rzeczywiste znaki nowej linii (obsługa różnych formatów)
          // Railway/Heroku mogą przechowywać z różnymi escapowaniami
          privateKey = privateKey.replace(/\\n/g, '\n');
          privateKey = privateKey.replace(/\\\\n/g, '\n'); // Podwójne escapowanie
          privateKey = privateKey.replace(/\\r\\n/g, '\n'); // Windows line endings
          privateKey = privateKey.replace(/\\r/g, '\n'); // Old Mac line endings
          
          // Usuń cudzysłowy jeśli klucz jest w nich opakowany (JSON format)
          if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
              (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
            privateKey = privateKey.slice(1, -1);
            // Zamień ponownie \n po usunięciu cudzysłowów
            privateKey = privateKey.replace(/\\n/g, '\n');
          }
          
          // Jeśli nadal nie ma znaków nowej linii, może hosting już je przekonwertował
          // lub klucz jest w jednej linii - spróbuj dodać znaki nowej linii po BEGIN i przed END
          if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN')) {
            privateKey = privateKey
              .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
              .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
          }
          
          // Sprawdź czy klucz wygląda na prawidłowy PEM
          if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
            this.logger.error(
              {
                hasBegin: privateKey.includes('-----BEGIN'),
                hasEnd: privateKey.includes('-----END'),
                keyLength: privateKey.length,
                keyPreview: privateKey.substring(0, 100),
                originalKeyLength: env.FCM_PRIVATE_KEY.length,
                originalKeyPreview: env.FCM_PRIVATE_KEY.substring(0, 100),
              },
              'FCM_PRIVATE_KEY does not appear to be in valid PEM format',
            );
            throw new Error('Invalid PEM format: missing BEGIN or END markers');
          }
          
          this.logger.debug(
            {
              keyLength: privateKey.length,
              hasNewlines: privateKey.includes('\n'),
              beginPos: privateKey.indexOf('-----BEGIN'),
              endPos: privateKey.indexOf('-----END'),
            },
            'Attempting to initialize Firebase Admin SDK with parsed private key',
          );
          
          this.firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert({
              projectId: env.FCM_PROJECT_ID,
              clientEmail: env.FCM_CLIENT_EMAIL,
              privateKey: privateKey,
            }),
          });
          this.logger.info('Firebase Admin SDK initialized successfully');
        }
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
            } : error,
            hasClientEmail: !!env.FCM_CLIENT_EMAIL,
            hasPrivateKey: !!env.FCM_PRIVATE_KEY,
            hasProjectId: !!env.FCM_PROJECT_ID,
            privateKeyLength: env.FCM_PRIVATE_KEY?.length || 0,
          },
          'Failed to initialize Firebase Admin SDK - push notifications will NOT work',
        );
      }
    } else {
      this.logger.error(
        {
          hasClientEmail: !!env.FCM_CLIENT_EMAIL,
          hasPrivateKey: !!env.FCM_PRIVATE_KEY,
          hasProjectId: !!env.FCM_PROJECT_ID,
        },
        'Firebase Admin SDK credentials not fully configured - push notifications will NOT work. Legacy API is disabled and deprecated.',
      );
    }
  }

  async send(deviceIds: string[], message: PushMessage) {
    this.logger.info(
      {
        deviceIdsCount: deviceIds.length,
        deviceIds: deviceIds,
        messageTitle: message.title,
      },
      'PushNotificationService.send called',
    );

    if (deviceIds.length === 0) {
      this.logger.warn('No deviceIds provided to PushNotificationService.send');
      return;
    }

    // Pobierz tokeny FCM dla deviceIds
    const deviceTokens = await this.deviceTokenService.getTokensForDevices(deviceIds);
    const tokens = deviceTokens.map((dt) => dt.token).filter(Boolean);

    this.logger.info(
      {
        deviceIdsCount: deviceIds.length,
        deviceTokensFound: deviceTokens.length,
        tokensFound: tokens.length,
        deviceIds: deviceIds,
        deviceTokens: deviceTokens.map((dt) => ({ deviceId: dt.deviceId, hasToken: !!dt.token })),
      },
      'FCM tokens lookup result',
    );

    if (tokens.length === 0) {
      this.logger.warn(
        {
          deviceIds: deviceIds,
          deviceTokens: deviceTokens,
        },
        'No FCM tokens found for deviceIds - push notifications will NOT be sent',
      );
      return;
    }

    // Użyj Firebase Admin SDK (v1 API) - to jest jedyne wspierane API
    if (this.firebaseAdmin) {
      try {
        await this.sendWithAdminSDK(tokens, message);
        return;
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? {
              message: error.message,
              code: (error as any).code,
            } : error,
            tokenCount: tokens.length,
          },
          'Failed to send with Firebase Admin SDK (v1 API) - push notifications failed',
        );
        // Nie próbuj używać legacy API - jest wyłączone i wycofane
        return;
      }
    }

    // Jeśli Admin SDK nie jest dostępny, nie możemy wysłać powiadomień
    // Legacy API jest wyłączone i wycofane (20.06.2024)
    this.logger.error(
      {
        count: deviceIds.length,
        title: message.title,
        body: message.body,
        data: message.data,
        hasFirebaseAdmin: !!this.firebaseAdmin,
        hasClientEmail: !!env.FCM_CLIENT_EMAIL,
        hasPrivateKey: !!env.FCM_PRIVATE_KEY,
        hasProjectId: !!env.FCM_PROJECT_ID,
      },
      'Firebase Admin SDK (v1 API) not available - cannot send push notifications. Legacy API is disabled and deprecated.',
    );
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
