import { getCollection, type CollectionEntry } from 'astro:content';

export type AnimeEntry = CollectionEntry<'anime'>;
export type EpisodeEntry = CollectionEntry<'episodes'>;
export type GuideEntry = CollectionEntry<'guides'>;

export async function getArchive() {
  const [allAnime, allEpisodes, allGuides, benchmarks, allProgress] = await Promise.all([
    getCollection('anime'), getCollection('episodes'), getCollection('guides'), getCollection('benchmarks'), getCollection('progress'),
  ]);
  const anime = allAnime.filter((entry) => !entry.data.draft).sort((a, b) => a.data.title.localeCompare(b.data.title));
  const animeIds = new Set(anime.map((entry) => entry.id));
  const episodes = allEpisodes.filter((entry) => !entry.data.draft && animeIds.has(entry.data.anime.id)).sort((a, b) => b.data.releaseDate.getTime() - a.data.releaseDate.getTime());
  const guides = allGuides.filter((entry) => !entry.data.draft).sort((a, b) => b.data.updatedDate.getTime() - a.data.updatedDate.getTime());
  const progress = allProgress.filter((entry) => !entry.data.draft && (!entry.data.relatedAnime || animeIds.has(entry.data.relatedAnime.id))).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return { anime, episodes, guides, benchmarks, progress };
}

export function formatDate(date: Date, compact = false) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', ...(compact ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(date);
}
export function episodeLabel(entry: EpisodeEntry) {
  return typeof entry.data.episodeNumber === 'number' ? String(entry.data.episodeNumber).padStart(2, '0') : entry.data.episodeNumber;
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
  const seriesMap = new Map(archive.anime.map((entry) => [entry.id, entry]));
  return [
    ...archive.anime.map((entry) => ({ title: entry.data.title, description: entry.data.synopsis.slice(0, 180), type: entry.data.mediaType === 'MANGA' ? 'Manga' : 'Anime', url: pathFor('anime', entry.id), keywords: [entry.data.romajiTitle, entry.data.japaneseTitle, ...entry.data.tags].filter(Boolean).join(' ') })),
    ...archive.episodes.map((entry) => ({ title: releaseTitle(entry, seriesMap.get(entry.data.anime.id)), description: [entry.data.source, entry.data.resolution, entry.data.videoCodec, entry.data.fileSize].filter(Boolean).join(' · '), type: 'Release', url: pathFor('releases', entry.id), keywords: [entry.data.title, entry.data.isBatch ? 'batch' : '', entry.data.mediainfo].filter(Boolean).join(' ') })),
    ...archive.guides.map((entry) => ({ title: entry.data.title, description: entry.data.description, type: 'Guide', url: pathFor('guides', entry.id), keywords: [entry.data.category, ...entry.data.tags, entry.body].join(' ') })),
    ...archive.episodes.flatMap((entry) => (entry.data.comparisons ?? []).map((comparison, index) => ({ title: comparison.title, description: comparison.note ?? `${comparison.sourceLabel} vs ${comparison.encodeLabel}`, type: 'Comparison', url: `/comparisons/#${entry.id.replace(/\//g, '-')}-${index}`, keywords: `${seriesMap.get(entry.data.anime.id)?.data.title ?? ''} ${entry.data.videoCodec ?? ''}` }))),
    ...archive.benchmarks.map((entry) => ({ title: entry.data.title, description: entry.data.subtitle, type: 'Comparison', url: `/comparisons/#benchmark-${entry.id.replace(/\//g, '-')}`, keywords: 'benchmark rate distortion SSIMULACRA VMAF Butteraugli PSNR FPS AV1 x265' })),
  ];
}
