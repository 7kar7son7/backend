import { Prisma } from '@prisma/client';

/** Kanał bez logoData/logoContentType – na listy i JSON API (logo przez GET /logos/akpa/…). */
export const channelPublicSelect = {
  id: true,
  externalId: true,
  name: true,
  description: true,
  logoUrl: true,
  category: true,
  countryCode: true,
} satisfies Prisma.ChannelSelect;

export type ChannelPublic = Prisma.ChannelGetPayload<{ select: typeof channelPublicSelect }>;
