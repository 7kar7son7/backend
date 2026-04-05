import { FastifyRequest } from 'fastify';

export function getDeviceId(request: FastifyRequest): string {
  const header = request.headers['x-device-id'];

  if (typeof header !== 'string' || header.trim().length === 0) {
    throw new Error('Missing X-Device-Id header');
  }

  return header.trim();
}

