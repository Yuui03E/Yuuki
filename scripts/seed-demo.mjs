import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stringify } from 'yaml';

// Original vector demonstrations only. This seed never replaces existing content.
const root = fileURLToPath(new URL('../', import.meta.url));
const created = [];
async function write(relative, content) {
  const destination = path.join(root, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, { encoding: 'utf8', flag: 'wx' });
  created.push(relative);
}
async function entry(collection, id, data, body) {
  await write(`src/content/${collection}/${id}.mdx`, `---\n${stringify(data, { lineWidth: 100 })}---\n\n${body}\n`);
}

const stars = Array.from({ length: 70 }, (_, i) => `<circle cx="${(i * 137 + 39) % 960}" cy="${(i * 53 + 18) % 320}" r="${i % 7 === 0 ? 1.5 : .7}" fill="#c8e9eb" opacity="${.2 + i % 5 * .13}"/>`).join('');
function landscape(encode = false) {
  return `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#08101f"/><stop offset=".6" stop-color="#102c38"/><stop offset="1" stop-color="#337072"/></linearGradient><linearGradient id="glow"><stop stop-color="#8be4d2" stop-opacity=".55"/><stop offset="1" stop-color="#8be4d2" stop-opacity="0"/></linearGradient><linearGradient id="wall" x2="1" y2="0"><stop stop-color="#254a51"/><stop offset="1" stop-color="#122832"/></linearGradient><pattern id="grain" width="9" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".5" fill="#cbeedc" opacity="${encode ? '.05' : '.13'}"/></pattern></defs><rect width="960" height="560" fill="url(#sky)"/>${stars}<circle cx="734" cy="127" r="55" fill="#98d8cc" opacity=".05"/><circle cx="734" cy="127" r="32" fill="#b9dfcd"/><circle cx="722" cy="119" r="31" fill="#112939"/><path d="M0 350 120 244 211 323 329 200 460 333 565 231 719 364 844 257 960 332V560H0Z" fill="#132a38"/><path d="m0 404 182-77 195 61 152-63 197 110 234-75v200H0Z" fill="#1c3d43"/><path d="m0 458 210-34 120 38 222-48 213 78 195-34v102H0Z" fill="#102b32"/><path d="m374 560 132-179h32l99 179Z" fill="#365d59"/><path d="m374 560 132-179h12L438 560Z" fill="#729886" opacity=".35"/><g><path d="M497 384V203h82v181Z" fill="url(#wall)" stroke="#47757a"/><path d="m485 203 53-46 53 46Z" fill="#0b1d2a" stroke="#518081"/><path d="M513 163v-40h50v40" fill="#233c4b" stroke="#63857e"/><path d="m507 123 31-24 31 24Z" fill="#112535"/><path d="M537 99V78" stroke="#8cae99"/><path d="M522 197v-23h31v23" fill="#afcf9b" opacity=".7"/><path d="M520 328v-56a18 18 0 0 1 36 0v56Z" fill="#112b31" stroke="#5d867b"/><path d="M533 241v-21h12v21M533 359v-20h12v20" fill="#b4d8a4"/><path d="M498 364h80M499 249h79M505 288h15M557 310h18" stroke="#6b9487" opacity=".35"/></g><path d="M534 249 782 286V190Z" fill="url(#glow)" opacity=".32"/><g fill="#081c24"><path d="m65 489 25-129 26 129-9-7 14 21H58l15-21Z"/><path d="m845 493 31-178 37 178-12-9 18 29h-91l22-29Z"/><path d="m135 478 19-94 24 94Z"/><path d="m920 490 19-101 24 101Z"/></g><path d="M0 522c108-20 217 12 327 0s211-21 337-3 194-18 296-9v50H0Z" fill="#081820"/><g transform="translate(457 405)"><path d="m0 67 12-47h18l19 48Z" fill="#203c43" stroke="#779992"/><path d="M15 20V7a10 10 0 0 1 20 0v17" fill="#c6d5c8"/><path d="m12 9-7-5 8 14m21-8 8-6-8 14" fill="#bacbbd"/><path d="m24 21 16 8-9 16-22-9" fill="#648d7d"/><path d="M43 70 51 0" stroke="#a9bda1" stroke-width="2"/></g><rect width="960" height="560" fill="url(#grain)"/>`;
}
const svg = (width, height, viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>\n`;
await write('public/images/observatory.svg', svg(960, 560, '0 0 960 560', landscape()));
await write('public/images/frame-source.svg', svg(1920, 1080, '0 10 960 540', landscape()));
await write('public/images/frame-encode.svg', svg(1920, 1080, '0 10 960 540', landscape(true)));
await write('public/images/detail-source.svg', svg(1920, 1080, '350 85 360 202.5', landscape()));
await write('public/images/detail-encode.svg', svg(1920, 1080, '350 85 360 202.5', landscape(true)));
await write('public/images/frieren-cover.svg', svg(600, 840, '0 0 600 840', `<rect width="600" height="840" fill="#10242e"/><g transform="translate(-425 0) scale(1.5)">${landscape()}</g><rect y="642" width="600" height="198" fill="#08151de8"/><path d="M36 685h38m-38 0v38M564 799h-38m38 0v-38" stroke="#71d3be"/><text x="65" y="714" fill="#7ca8a6" font-family="monospace" font-size="13" letter-spacing="4">BEYOND JOURNEY’S END</text><text x="62" y="767" fill="#e0ece1" font-family="Georgia,serif" font-size="63" letter-spacing="5">FRIEREN</text><text x="66" y="801" fill="#89a79f" font-family="monospace" font-size="12" letter-spacing="3">ARCHIVE STUDY / 001</text>`));
await write('public/images/witch-hat-cover.svg', svg(600, 840, '0 0 600 840', `<defs><radialGradient id="paper"><stop stop-color="#48304e"/><stop offset="1" stop-color="#181422"/></radialGradient><pattern id="lines" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 22 22 0" stroke="#dcc18c" opacity=".025"/></pattern></defs><rect width="600" height="840" fill="url(#paper)"/><rect width="600" height="840" fill="url(#lines)"/><g fill="none" stroke="#b49367"><circle cx="300" cy="316" r="205" opacity=".28"/><circle cx="300" cy="316" r="190" opacity=".5"/><circle cx="300" cy="316" r="154" opacity=".3"/><path d="m300 111 177 307H123Z" opacity=".35"/><path d="m300 521 177-307H123Z" opacity=".35"/><path d="M90 316h420M300 106v420" opacity=".2"/></g><g transform="translate(300 300)"><path d="m-111 26 109-164 86 146 68 25c-86 25-195 27-297 4Z" fill="#211b2d" stroke="#bda074" stroke-width="2"/><path d="M-60 23 30 7l16 23-100 23Z" fill="#84664f"/><path d="M-32 48c-36 45-6 66-37 84 32 16 40-5 47-25 22 20 36 17 48-5 24 9 48-8 41-33Z" fill="#d7c2a0"/><path d="m-43 108-53 145h189l-54-143-38 26Z" fill="#31273d" stroke="#967a5c"/><path d="m-30 108 27 28 25-29 10 121h-69Z" fill="#9c866b"/><path d="m-87 207 68-15 20 39 21-40 75 8-26 43-70 9-65-8Z" fill="#d1b78e"/><path d="M-4 230v22" stroke="#5e4a38"/></g><path d="M65 58h470v526H65Z" fill="none" stroke="#a18660" opacity=".25"/><text x="300" y="664" text-anchor="middle" fill="#c7aa78" font-family="monospace" font-size="12" letter-spacing="5">A NOTEBOOK OF SMALL WONDERS</text><text x="300" y="724" text-anchor="middle" fill="#ece0c8" font-family="Georgia,serif" font-size="50">Witch Hat</text><text x="300" y="773" text-anchor="middle" fill="#ece0c8" font-family="Georgia,serif" font-size="46">Atelier</text><text x="300" y="813" text-anchor="middle" fill="#a89174" font-family="monospace" font-size="11" letter-spacing="3">ARCHIVE STUDY / 002</text>`));

await entry('anime', 'frieren', {
  title: 'Frieren: Beyond Journey’s End', romajiTitle: 'Sousou no Frieren', japaneseTitle: '葬送のフリーレン', mediaType: 'ANIME', anilistId: 154587,
  format: 'TV', releaseTag: '[Yuuki]', season: 'FALL', year: 2023, status: 'Ongoing', sourceType: 'BD', coverImage: '/images/frieren-cover.svg', bannerImage: '/images/observatory.svg',
  synopsis: 'An elven mage retraces the road of an old adventure, learning to understand the fleeting lives of the people who walked beside her. A quiet journey through memory, magic, and the things a hero leaves behind.',
  totalEpisodes: 28, completedEpisodes: 2, studios: ['MADHOUSE'], defaultCodec: 'AV1', tags: ['Fantasy', 'Adventure', 'Drama'], featured: true, draft: false,
}, '## Source notebook\n\nA sample BD archive exploring fine lineart and low-light gradients. The two episode studies use different codecs to demonstrate the release notebook.\n\n> All artwork on this sample site is original SVG placeholder illustration. No episode media is included.\n\n## Release plan\n\nPublish small, reproducible studies after filtering, encoding, and visual QC. Store measurements alongside the source notes.');
await entry('anime', 'witch-hat-atelier', {
  title: 'Witch Hat Atelier', romajiTitle: 'Tongari Boushi no Atelier', japaneseTitle: 'とんがり帽子のアトリエ', mediaType: 'MANGA', anilistId: 98263,
  format: 'MANGA', releaseTag: '[Yuuki]', year: 2016, status: 'Planned', sourceType: 'Digital', coverImage: '/images/witch-hat-cover.svg',
  synopsis: 'Coco has always believed magic belongs to those born with it. A chance discovery brings her into an atelier where ink, imagination, and patient practice can reshape the world.',
  studios: [], tags: ['Fantasy', 'Art', 'Adventure'], featured: true, draft: false,
}, '## Collection notes\n\nA manga entry demonstrates that the archive supports more than episodic animation. Digital source notes, chapter labels, and illustration comparisons can use the same content model.\n\nNo chapters are hosted here. This entry is a metadata and layout example.');
const filterScript = 'import vapoursynth as vs\ncore = vs.core\n\n# Example only: tune per scene and inspect against the source.\nclip = core.lsmas.LWLibavSource("source.mkv")\ndebanded = core.f3kdb.Deband(clip, range=12, y=48, cb=32, cr=32, grainy=0, grainc=0, output_depth=10)\n# Restore grain selectively rather than erasing texture globally.\ndebanded.set_output()';
const pair = { title: 'Night gradients & fine texture', sourceLabel: 'BD source', encodeLabel: 'AV1 encode', sourceImage: '/images/frame-source.svg', encodeImage: '/images/frame-encode.svg', frameNumber: 18420, note: 'SVG demonstration: compare the subtle texture in the sky and the edges of the observatory. These are illustrative frames, not measurements of the anime.' };
const specs = { anime: 'frieren', releaseTag: '[Yuuki]', version: 'v1', source: 'JP BD', container: 'MKV', resolution: '1920×1080', frameRate: '23.976 fps', videoProfile: 'Main 10', bitDepth: 10,
  audioTracks: [{ language: 'Japanese', codec: 'Opus', channels: '2.0', bitrate: '192 kb/s', isDefault: true }], subtitleTracks: [{ language: 'English', format: 'ASS', title: 'Sample styled subtitles', isDefault: true }], draft: false };
await entry('episodes', 'frieren-01-av1', { ...specs, episodeNumber: 1, isBatch: false, title: 'The Journey’s End', releaseDate: '2026-11-10', videoCodec: 'AV1', bitrate: '1.72 Mb/s', fileSize: '342 MiB', crc32: 'A3C91F2E', thumbnail: '/images/frame-encode.svg',
  encoderParams: 'SvtAv1EncApp -i filtered.y4m -b episode01.ivf --crf 22 --preset 4 --film-grain 6 --keyint 240', filterScript,
  mediainfo: 'General\nComplete name : [Yuuki] Frieren - 01 [AV1][A3C91F2E].mkv\nFormat        : Matroska\nFile size     : 342 MiB\nDuration      : 24 min\n\nVideo\nFormat        : AV1\nWidth         : 1 920 pixels\nHeight        : 1 080 pixels\nFrame rate    : 23.976 FPS\nBit depth     : 10 bits\n\nAudio\nFormat        : Opus\nChannels      : 2 channels\nLanguage      : Japanese\n\nText\nFormat        : ASS\nLanguage      : English',
  screenshots: [{ src: '/images/frame-encode.svg', caption: 'Observatory at night', frameNumber: 18420, timestamp: '00:12:48' }, { src: '/images/detail-encode.svg', caption: 'Lineart detail', frameNumber: 18420 }], comparisons: [pair], downloads: [{ label: 'Demo mirror', url: 'https://example.com/yuuki/frieren-01', provider: 'Illustrative link' }], changelog: [{ version: 'v1', date: '2026-11-10', notes: 'Initial sample notebook with encoder settings, MediaInfo, and a frame pair.' }],
}, 'This demonstration release uses AV1 to show a complete technical notebook. The listed sizes, CRC, and MediaInfo are sample values.\n\nThe download button points to an example URL. No anime files are distributed with this project.\n\n### QC notes\n\nInspect sky gradients at native size, then toggle the source and encode. Use multiple scenes before settling on a grain setting.');
await entry('episodes', 'frieren-02-hevc', { ...specs, episodeNumber: 2, isBatch: false, title: 'It Didn’t Have to Be Magic…', releaseDate: '2026-11-11', videoCodec: 'HEVC', bitrate: '2.25 Mb/s', fileSize: '428 MiB', crc32: 'B4D82E19',
  encoderParams: 'x265 --input filtered.y4m --y4m --crf 17 --preset slow --profile main10 --output episode02.hevc', filterScript,
  mediainfo: 'General\nFormat : Matroska\nFile size : 428 MiB\n\nVideo\nFormat : HEVC\nProfile : Main 10\nDimensions : 1920 x 1080\nFrame rate : 23.976 FPS\n\nAudio\nFormat : Opus\nLanguage : Japanese',
  screenshots: [{ src: '/images/detail-source.svg', caption: 'Tower detail study', timestamp: '00:08:21' }], comparisons: [{ ...pair, title: 'Architectural edges & lineart', sourceImage: '/images/detail-source.svg', encodeImage: '/images/detail-encode.svg', encodeLabel: 'HEVC encode', frameNumber: 12012, note: 'Illustrative close-up: watch the window edges and fine grain while toggling. Use native pixel view to avoid browser scaling.' }],
  downloads: [{ label: 'Demo mirror', url: 'https://example.com/yuuki/frieren-02', provider: 'Illustrative link' }],
}, 'A HEVC sample for comparison with the AV1 release notebook. Source retention and playback compatibility are part of the decision, alongside file size.\n\nAll specifications and links are demonstration data.');
await entry('episodes', 'frieren-01-02-batch', { anime: 'frieren', episodeNumber: '01–02 Batch', isBatch: true, releaseTag: '[Yuuki]', version: 'v1', releaseDate: '2026-11-12', source: 'BD', container: 'MKV', resolution: '1080p', videoCodec: 'AV1 / HEVC', fileSize: '770 MiB',
  mediainfo: 'Batch manifest (sample)\n01 : AV1 Main 10 / Opus 2.0 / ASS\n02 : HEVC Main 10 / Opus 2.0 / ASS\n\nIndividual file reports are included in the episode notebooks.',
  downloads: [{ label: 'Demo batch index', url: 'https://example.com/yuuki/frieren-batch', provider: 'Illustrative link' }], changelog: [{ version: 'v1', date: '2026-11-12', notes: 'Collects the first two example release notebooks. No media is included.' }], draft: false,
}, 'The first two episode studies, collected as a compact batch entry. Follow the individual releases for the filtering scripts and frame comparisons.\n\n[Episode 01](/releases/frieren-01-av1/) · [Episode 02](/releases/frieren-02-hevc/)\n\nThis entry deliberately omits optional audio and encoding details to demonstrate that missing fields produce no empty technical rows.');

await entry('guides', 'vapoursynth-source-first', { title: 'A source-first VapourSynth pipeline', description: 'Build a small, reproducible filter chain, then inspect what each stage changes before adding the next.', category: 'Filtering', difficulty: 'Intermediate', os: ['Windows', 'Linux'], updatedDate: '2026-11-11', tags: ['VapourSynth', 'Debanding', 'QC'], featured: true, draft: false }, `## Start with a source inspection

Choose several representative scenes: motion, flat gradients, fine lineart, and dark texture. Keep their frame numbers in a notebook. One attractive screenshot cannot represent an entire episode.

> Treat filters as targeted repairs. Keep an unfiltered reference available throughout the workflow.

### Load the source

Install VapourSynth and a compatible source plugin first. Plugin availability varies by operating system.

~~~python
import vapoursynth as vs
core = vs.core
source = core.lsmas.LWLibavSource("source.mkv")
source.set_output()
~~~

## Filter one problem at a time

Test debanding conservatively. Compare gradients at native resolution and check that texture and thin strokes survive. Avoid a global setting that repairs one scene and harms the rest.

### A minimal debanding study

~~~python
# Requires the f3kdb plugin. These are starting values, not universal settings.
filtered = core.f3kdb.Deband(
    source, range=12, y=48, cb=32, cr=32,
    grainy=0, grainc=0, output_depth=10
)
filtered.set_output()
~~~

## Export and encode a short test

Encode a small section before committing to the full run. Record the plugin versions, script, encoder build, and parameters so the result can be reproduced.

~~~bash
vspipe --y4m pipeline.vpy - | SvtAv1EncApp -i stdin -b test.ivf --crf 22 --preset 4
~~~

## Review at native pixels

Use the [comparison bench](/comparisons/) to practice split and instant-toggle inspection. The included SVG pairs demonstrate the interface; replace them with lossless frame exports for actual QC.

- Compare the same frame number and color conversion.
- Inspect lineart, gradients, and texture separately.
- Review motion as well as individual still frames.
- Save notes on any scene-specific overrides.`);
await entry('guides', 'av1-hevc-tuning', { title: 'AV1 or HEVC: tune for the frame', description: 'Use short encode sweeps and perceptual metrics to choose settings without losing sight of the source.', category: 'Encoding', difficulty: 'Beginner', os: ['Windows', 'Linux'], updatedDate: '2026-11-09', tags: ['AV1', 'HEVC', 'SSIMULACRA 2', 'Playback'], featured: true, draft: false }, `## Define the playback target

Start with the devices that need to play the release. Check container, bit depth, subtitle handling, and hardware decoding support using a short sample.

## Build a small CRF sweep

Choose a fixed preset and vary the quality control. Keep source frames, color conversions, and filter settings identical between tests.

### AV1 test command

~~~bash
SvtAv1EncApp -i sample.y4m -b sample.ivf --crf 22 --preset 4
~~~

### HEVC test command

~~~bash
x265 --input sample.y4m --y4m --crf 17 --preset slow --profile main10 --output sample.hevc
~~~

CRF values are encoder-specific. AV1 CRF 22 and x265 CRF 22 do not imply equal fidelity or equal file size.

## Read metrics with their limits

SSIMULACRA 2 and VMAF can help identify promising candidates. PSNR reports pixel error, while Butteraugli measures perceptual difference. **Lower Butteraugli is better.** FPS measures encoding speed rather than image fidelity.

> Metrics are a screening tool. Always inspect fine lineart, intentional grain, and difficult motion directly.

## Choose and document the result

Use the [rate–distortion notebook](/comparisons/#benchmark-av1-vs-x265) to explore how bitrate and CRF change the view. Its sample values are illustrative and cannot establish an encoder ranking.

Record the exact encoder build, CPU, preset, test clip, filter chain, and metric implementation with your own measurements. Include the final command and playback notes in the release notebook.`);
const points = (av1) => [18, 22, 26, 30].map((crf, i) => ({ crf: av1 ? crf : crf - 4, preset: av1 ? '4' : 'slow', bitrateKbps: (av1 ? [2800, 2050, 1440, 980] : [3450, 2640, 1880, 1320])[i], ssimulacra2: (av1 ? [91.2, 86.4, 79.1, 70.5] : [90.5, 85.7, 78.2, 68.7])[i], vmaf: [98.1, 96.4, 93.7, 89.2][i] - (av1 ? 0 : .5), butteraugli: [.62, .89, 1.28, 1.83][i] + (av1 ? 0 : .07), psnr: [44.2, 41.8, 38.9, 36.1][i], fps: (av1 ? [31, 36, 41, 47] : [18, 21, 26, 30])[i] }));
await write('src/content/benchmarks/av1-vs-x265.json', JSON.stringify({ title: 'SVT-AV1-PSY vs x265', subtitle: 'Illustrative data only · a short 1080p animation study. These invented values demonstrate the chart and do not support encoder performance claims.', sourceClip: '1080p / 240-frame study', date: '2026-11-11', metricsAvailable: ['ssimulacra2', 'vmaf', 'butteraugli', 'psnr', 'fps'], series: [{ label: 'SVT-AV1-PSY · preset 4', color: '#00e5ff', points: points(true) }, { label: 'x265 · slow', color: '#a855f7', points: points(false) }], takeaways: ['Compare quality at a shared bitrate; CRF scales differ between encoders.', 'Lower Butteraugli is better. FPS measures speed, not fidelity.', 'Replace this dataset with measured values and include software versions and hardware.'] }, null, 2) + '\n');
await entry('progress', 'frieren-qc-pass', { title: 'Dark-scene QC and grain checks', date: '2026-11-12', category: 'Encoding', relatedAnime: 'frieren', stage: 'QC', draft: false }, 'Reviewing gradients and thin architectural edges in the sample scene. The next notebook pass will compare lossless frame exports and playback behavior.');
await entry('progress', 'archive-foundations', { title: 'Archive foundations in place', date: '2026-11-09', category: 'Site', stage: 'Completed', draft: false }, 'Content collections, transparent release notebooks, and the local authoring workflow now share one small static archive. New entries can grow without adding a client framework.');
console.log(`Created ${created.length} sample files:\n${created.join('\n')}`);
