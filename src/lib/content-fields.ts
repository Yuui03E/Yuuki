import { z } from 'astro/zod';

const text = z.string().trim().min(1).max(500);
const optionalText = text.optional();
const longText = z.string().trim().min(1).max(250_000).optional();
const count = z.number().int().nonnegative();
const imagePath = z.string().trim().max(2000).refine((value) => {
  if (value.startsWith('/images/')) return !value.includes('..') && !/[\\\s?#]/.test(value);
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use a local /images/ path or an HTTPS image URL.');
const downloadUrl = z.string().trim().max(4000).refine((value) => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) || (url.protocol === 'magnet:' && url.searchParams.has('xt'));
  } catch { return false; }
}, 'Use an HTTP(S) download URL or a magnet URI with an xt parameter.');
const tags = z.array(text).max(60).default([]);

export const animeFields = {
  title: text,
  romajiTitle: optionalText,
  japaneseTitle: optionalText,
  mediaType: z.enum(['ANIME', 'MANGA']).default('ANIME'),
  anilistId: z.number().int().positive().optional(),
  format: optionalText,
  releaseTag: text.default('[Yuuki]'),
  season: optionalText,
  year: z.number().int().min(1900).max(2200).optional(),
  status: z.enum(['Ongoing', 'Completed', 'Planned', 'Paused']),
  sourceType: z.enum(['BD', 'UHD-BD', 'WEB', 'DVD', 'Digital', 'Hybrid']),
  coverImage: imagePath,
  bannerImage: imagePath.optional(),
  synopsis: z.string().trim().min(1).max(20_000),
  totalEpisodes: count.optional(),
  completedEpisodes: count.optional(),
  studios: z.array(text).max(30).optional(),
  defaultCodec: optionalText,
  tags,
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
};

export const audioTrackSchema = z.object({
  language: optionalText, codec: optionalText, channels: optionalText,
  title: optionalText, bitrate: optionalText, isDefault: z.boolean().optional(),
}).strict();
export const subtitleTrackSchema = z.object({
  language: optionalText, format: optionalText, title: optionalText,
  isDefault: z.boolean().optional(), forced: z.boolean().optional(),
}).strict();
export const screenshotSchema = z.object({
  src: imagePath, caption: optionalText, frameNumber: count.optional(), timestamp: optionalText,
}).strict();
export const comparisonSchema = z.object({
  title: text, sourceLabel: text.default('Source'), encodeLabel: text.default('Encode'),
  sourceImage: imagePath, encodeImage: imagePath, frameNumber: count.optional(), note: optionalText,
}).strict();
export const downloadSchema = z.object({
  label: text, url: downloadUrl, provider: optionalText, isMagnet: z.boolean().default(false),
}).strict().transform((download) => ({ ...download, isMagnet: download.url.startsWith('magnet:') }));

export const episodeFields = {
  episodeNumber: z.union([count, text]),
  isBatch: z.boolean().default(false),
  releaseTag: text.default('[Yuuki]'),
  title: optionalText,
  version: text.default('v1'),
  releaseDate: z.coerce.date(),
  thumbnail: imagePath.optional(),
  source: optionalText,
  container: text.optional().default('MKV'),
  resolution: optionalText,
  frameRate: z.union([z.number().positive(), text]).optional(),
  videoCodec: optionalText,
  videoProfile: optionalText,
  bitDepth: z.number().int().min(8).max(32).optional(),
  bitrate: z.union([z.number().positive(), text]).optional(),
  fileSize: optionalText,
  crc32: z.string().regex(/^[0-9a-fA-F]{8}$/, 'CRC32 must contain eight hexadecimal characters.').transform((v) => v.toUpperCase()).optional(),
  audioTracks: z.array(audioTrackSchema).max(30).optional(),
  subtitleTracks: z.array(subtitleTrackSchema).max(30).optional(),
  encoderParams: longText,
  filterScript: longText,
  mediainfo: longText,
  screenshots: z.array(screenshotSchema).max(40).optional(),
  comparisons: z.array(comparisonSchema).max(30).optional(),
  downloads: z.array(downloadSchema).max(30).optional(),
  changelog: z.array(z.object({ version: text, date: z.coerce.date(), notes: z.string().trim().min(1).max(5000) }).strict()).max(40).optional(),
  draft: z.boolean().default(false),
};

export const guideFields = {
  title: text,
  description: z.string().trim().min(1).max(2000),
  category: z.enum(['Encoding', 'Filtering', 'Playback', 'Tools', 'Workflow']),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  os: z.array(text).max(10).optional(),
  updatedDate: z.coerce.date(),
  tags,
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
};

export const metricNames = ['ssimulacra2', 'vmaf', 'butteraugli', 'psnr', 'fps'] as const;
export const benchmarkFields = {
  title: text,
  subtitle: z.string().trim().min(1).max(2000),
  sourceClip: text,
  date: z.coerce.date(),
  metricsAvailable: z.array(z.enum(metricNames)).min(1),
  series: z.array(z.object({
    label: text, encoder: optionalText, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    points: z.array(z.object({
      crf: z.number().nonnegative(), preset: z.union([text, z.number()]).optional(),
      bitrateKbps: z.number().positive(), ssimulacra2: z.number().optional(),
      vmaf: z.number().min(0).max(100).optional(), butteraugli: z.number().nonnegative().optional(),
      psnr: z.number().optional(), fps: z.number().nonnegative().optional(),
      takeaways: z.union([text, z.array(text)]).optional(),
    }).strict()).min(1),
    takeaways: z.array(text).optional(),
  }).strict()).min(1),
  takeaways: z.array(text).optional(),
};

export const progressFields = {
  title: text,
  date: z.coerce.date(),
  category: z.enum(['Release', 'Encoding', 'Pipeline', 'Site']),
  stage: z.enum(['Filtering', 'Encoding', 'QC', 'Muxing', 'Completed']),
  draft: z.boolean().default(false),
};
