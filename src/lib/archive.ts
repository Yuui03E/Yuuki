import { getCollection, type CollectionEntry } from 'astro:content';
import { isAdult, hasAdultMedia, assertAdultBody } from './audience.mjs';

export type AnimeEntry = CollectionEntry<'anime'>;
export type EpisodeEntry = CollectionEntry<'episodes'>;
export type GuideEntry = CollectionEntry<'guides'>;

export async function getArchive({ audience = 'general' }: { audience?: 'general' | 'adult' | 'all' } = {}) {
  const [allAnime, allEpisodes, allGuides, allBenchmarks, allProgress] = await Promise.all([
    getCollection('anime'), getCollection('episodes'), getCollection('guides'), getCollection('benchmarks'), getCollection('progress'),
  ]);
  const classify = <T extends { data: { adult: boolean }; body?: string }>(entry: T, parent?: unknown): T => ({ ...entry, data: { ...entry.data, adult: isAdult(entry.data, parent) || hasAdultMedia(entry.body) } });
  const publishedAnime = allAnime.filter((entry) => !entry.data.draft).map((entry) => classify(entry));
  const parents = new Map(publishedAnime.map((entry) => [entry.id, entry]));
  const accepts = (adult: boolean) => audience === 'all' || adult === (audience === 'adult');
  const validate = (entry: { id: string; body?: string; data: unknown }, adult: boolean) => {
    if (adult) { try { assertAdultBody(entry.body); } catch (error) { throw new Error(`Adult record ${entry.id}: ${error instanceof Error ? error.message : 'Unsafe notes'}`); } }
    return accepts(adult);
  };
  const anime = publishedAnime.filter((entry) => validate(entry, isAdult(entry.data))).sort((a, b) => a.data.title.localeCompare(b.data.title));
  const episodes = allEpisodes.map((entry) => classify(entry, parents.get(entry.data.anime.id)?.data)).filter((entry) => !entry.data.draft && parents.has(entry.data.anime.id) && validate(entry, isAdult(entry.data))).sort((a, b) => b.data.releaseDate.getTime() - a.data.releaseDate.getTime());
  const guides = allGuides.map((entry) => classify(entry)).filter((entry) => !entry.data.draft && validate(entry, isAdult(entry.data))).sort((a, b) => b.data.updatedDate.getTime() - a.data.updatedDate.getTime());
  const benchmarks = allBenchmarks.map((entry) => classify(entry)).filter((entry) => !entry.data.draft && validate(entry, isAdult(entry.data)));
  const progress = allProgress.map((entry) => classify(entry, entry.data.relatedAnime ? parents.get(entry.data.relatedAnime.id)?.data : undefined)).filter((entry) => !entry.data.draft && (!entry.data.relatedAnime || parents.has(entry.data.relatedAnime.id)) && validate(entry, isAdult(entry.data))).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return { anime, episodes, guides, benchmarks, progress, seriesLookup: parents };
}

export function formatDate(date: Date, compact = false) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', ...(compact ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(date);
}
export function episodeLabel(entry: EpisodeEntry) {
  return typeof entry.data.episodeNumber === 'number' ? String(entry.data.episodeNumber).padStart(2, '0') : entry.data.episodeNumber;
}
export function episodeCaption(entry: EpisodeEntry) {
  const label = episodeLabel(entry);
  const kind = entry.data.isBatch ? 'Batch' : 'Episode';
  return new RegExp(`\\b${kind}\\b`, 'i').test(label) ? label : `${kind} ${label}`;
}
export function releaseTitle(entry: EpisodeEntry, series?: AnimeEntry) {
  return `${entry.data.releaseTag} ${series?.data.title ?? entry.data.title ?? 'Release'} — ${episodeLabel(entry)}`;
}
export function audioSummary(entry: EpisodeEntry) {
  return entry.data.audioTracks?.map((track) => [track.codec, track.channels].filter(Boolean).join(' ')).filter(Boolean).join(' / ');
}
export function pathFor(section: string, id: string) {
  return `/${section}/${id.split('/').map(encodeURIComponent).join('/')}/`;
}
export function safeJson(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }

export function searchItems(archive: Awaited<ReturnType<typeof getArchive>>) {
  const seriesMap = archive.seriesLookup;
  return [
    ...archive.anime.map((entry) => ({ title: entry.data.title, description: entry.data.synopsis.slice(0, 180), type: entry.data.mediaType === 'MANGA' ? 'Manga' : 'Anime', url: pathFor('anime', entry.id), keywords: [entry.data.romajiTitle, entry.data.japaneseTitle, ...entry.data.tags].filter(Boolean).join(' ') })),
    ...archive.episodes.map((entry) => ({ title: releaseTitle(entry, seriesMap.get(entry.data.anime.id)), description: [entry.data.source, entry.data.resolution, entry.data.videoCodec, entry.data.fileSize].filter(Boolean).join(' · '), type: 'Release', url: pathFor('releases', entry.id), keywords: [entry.data.title, entry.data.isBatch ? 'batch' : '', entry.data.mediainfo].filter(Boolean).join(' ') })),
    ...archive.guides.map((entry) => ({ title: entry.data.title, description: entry.data.description, type: 'Guide', url: pathFor('guides', entry.id), keywords: [entry.data.category, entry.data.summary, ...entry.data.tags, ...(entry.data.takeaways ?? []), ...(entry.data.presets ?? []).flatMap((preset) => [preset.title, preset.label, preset.codec, preset.goal]), entry.body].filter(Boolean).join(' ') })),
    ...archive.guides.flatMap((entry) => (entry.data.comparisons ?? []).map((comparison, index) => ({ title: comparison.title, description: comparison.note ?? `${comparison.sourceLabel} vs ${comparison.encodeLabel}`, type: 'Comparison', url: `${pathFor('guides', entry.id)}#guide-${entry.id.replace(/[^a-zA-Z0-9-]/g, '-')}-comparison-${index}`, keywords: `${entry.data.title} ${entry.data.tags.join(' ')}` }))),
    ...archive.episodes.flatMap((entry) => (entry.data.comparisons ?? []).map((comparison, index) => ({ title: comparison.title, description: comparison.note ?? `${comparison.sourceLabel} vs ${comparison.encodeLabel}`, type: 'Comparison', url: `${isAdult(entry.data, seriesMap.get(entry.data.anime.id)?.data) ? '/adult/' : '/comparisons/'}#${entry.id.replace(/\//g, '-')}-${index}`, keywords: `${seriesMap.get(entry.data.anime.id)?.data.title ?? ''} ${entry.data.videoCodec ?? ''}` }))),
    ...archive.benchmarks.map((entry) => ({ title: entry.data.title, description: entry.data.subtitle, type: 'Comparison', url: `${isAdult(entry.data) ? '/adult/' : '/comparisons/'}#benchmark-${entry.id.replace(/\//g, '-')}`, keywords: 'benchmark rate distortion SSIMULACRA VMAF Butteraugli PSNR FPS AV1 x265' })),
  ];
}
