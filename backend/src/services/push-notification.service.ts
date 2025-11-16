import type { FastifyBaseLogger } from 'fastify';

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export class PushNotificationService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async send(deviceIds: string[], message: PushMessage) {
    if (deviceIds.length === 0) {
      return;
    }

    this.logger.info(
      {
        count: deviceIds.length,
        title: message.title,
        body: message.body,
        data: message.data,
      },
      'Simulated push notification dispatch',
    );

    // TODO: Integrate with FCM once production credentials are available.
  }
}
