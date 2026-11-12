import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { animeFields, episodeFields, guideFields, benchmarkFields, progressFields } from './lib/content-fields';

const anime = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/anime' }),
  schema: z.object(animeFields),
});
const episodes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/episodes' }),
  schema: z.object({ anime: reference('anime'), ...episodeFields }),
});
const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object(guideFields),
});
const benchmarks = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/benchmarks' }),
  schema: z.object(benchmarkFields),
});
const progress = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/progress' }),
  schema: z.object({ ...progressFields, relatedAnime: reference('anime').optional() }),
});

export const collections = { anime, episodes, guides, benchmarks, progress };
