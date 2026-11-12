import { z } from 'astro/zod';
import { animeFields, episodeFields, guideFields } from './content-fields.ts';

const envelope = { slug: z.string().trim().max(150).optional(), body: z.string().max(250_000).default('') };
export const studioSchemas = {
  anime: z.object({ ...envelope, data: z.object(animeFields).strict() }).strict(),
  episode: z.object({ ...envelope, data: z.object({ anime: z.string().trim().min(1).max(150), ...episodeFields }).strict() }).strict(),
  guide: z.object({ ...envelope, body: z.string().trim().min(1).max(250_000), data: z.object(guideFields).strict() }).strict(),
};
