import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { stringify } from 'yaml';

// Temporary QA entries are created exclusively and removed individually.
const root = fileURLToPath(new URL('../', import.meta.url));
const nonce = randomUUID();
const privateMarker = `qa-private-${nonce}`;
const sparseId = `qa-sparse-${nonce}`;
const adultMarker = `qa-adult-${nonce}`;
const adultImage = `https://media.test/media/adult/${'a'.repeat(64)}.png`;
const files = [];
async function fixture(collection, id, data, body = privateMarker) {
  const folder = path.resolve(root, 'src/content', collection);
  const destination = path.resolve(folder, `${id}.mdx`);
  assert.equal(path.dirname(destination), folder);
  await writeFile(destination, `---\n${stringify(data)}---\n\n${body}\n`, { flag: 'wx' });
  files.push(destination);
}
async function build() {
  for (const [name, args] of [['astro', ['build']], ['pagefind', ['--site', 'dist']]]) {
    const pkg = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
    const bin = path.join(root, 'node_modules', name, typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name]);
    const result = spawnSync(process.execPath, [bin, ...args], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, encoding: 'utf8' });
    assert.equal(result.status, 0, `${name} failed:\n${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stderr, /\b(error|warn)\b/i);
  }
}
async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(folder, entry.name)) : path.join(folder, entry.name)))).flat();
}
try {
  await fixture('anime', privateMarker, { title: privateMarker, status: 'Planned', sourceType: 'BD', coverImage: '/images/frieren-cover.svg', synopsis: privateMarker, draft: true });
  await fixture('episodes', `${privateMarker}-child`, { anime: privateMarker, episodeNumber: 1, releaseDate: '2026-11-13', draft: false });
  await fixture('episodes', `${privateMarker}-episode`, { anime: 'frieren', episodeNumber: 99, releaseDate: '2026-11-13', draft: true });
  await fixture('guides', `${privateMarker}-guide`, { title: privateMarker, description: privateMarker, category: 'Workflow', difficulty: 'Beginner', updatedDate: '2026-11-13', draft: true });
  await fixture('progress', `${privateMarker}-child-log`, { title: privateMarker, date: '2026-11-13', category: 'Encoding', stage: 'QC', relatedAnime: privateMarker, draft: false });
  await fixture('progress', `${privateMarker}-log`, { title: privateMarker, date: '2026-11-13', category: 'Site', stage: 'Completed', draft: true });
  await fixture('episodes', sparseId, { anime: 'frieren', episodeNumber: 98, releaseDate: '2026-11-13', draft: false }, 'Temporary published fixture with no technical inputs.');
  await fixture('anime', adultMarker, { title: adultMarker, status: 'Planned', sourceType: 'BD', coverImage: adultImage, synopsis: adultMarker, adult: true }, 'Safe adult classification fixture.');
  await fixture('episodes', `${adultMarker}-child`, { anime: adultMarker, episodeNumber: 1, releaseDate: '2026-11-14', videos: [{ title: adultMarker, src: `https://media.test/media/adult/${'b'.repeat(64)}.mp4`, poster: adultImage }], comparisons: [{ title: adultMarker, sourceImage: adultImage, encodeImage: adultImage }] }, 'Safe inherited classification fixture.');
  await fixture('episodes', `${adultMarker}-mixed`, { anime: 'frieren', adult: true, title: adultMarker, episodeNumber: 97, releaseDate: '2026-11-14' }, 'Safe adult release with a general parent.');
  await fixture('guides', `${adultMarker}-guide`, { title: adultMarker, description: adultMarker, adult: true, category: 'Workflow', difficulty: 'Beginner', updatedDate: '2026-11-14', screenshots: [{ src: adultImage }], comparisons: [{ title: 'Safe guide pair', sourceImage: adultImage, encodeImage: adultImage }], videos: [{ title: 'Safe guide clip', src: `https://media.test/media/adult/${'b'.repeat(64)}.mp4` }] }, '## Safe heading\n\nText only.');
  await build();
  const built = await walk(path.join(root, 'dist'));
  for (const file of built) {
    const buffer = await readFile(file);
    const text = (buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer).toString('utf8');
    assert.ok(!text.includes(privateMarker), `Draft leaked into ${file}`);
    if (!file.includes(`${path.sep}adult${path.sep}`) && !file.includes(adultMarker)) assert.ok(!text.includes(adultMarker), `Adult content leaked into general page or search asset ${file}`);
    if (/\.(html|js|css|json)$/.test(file)) assert.doesNotMatch(text, /data-studio-form|data-guide-editor|data-guide-preview-note|graphql\.anilist|initStudio|initGuideEditor|\/__studio\/(save-|media-|load-guide|update-guide)|Publishing studio|DOMPurify|r2\.local\.json/, `Studio asset leaked into ${file}`);
    assert.ok(!file.includes(privateMarker), `Draft route generated: ${file}`);
  }
  const sparse = await readFile(path.join(root, 'dist/releases', sparseId, 'index.html'), 'utf8');
  for (const heading of ['Audio tracks', 'Subtitle tracks', 'The technical notebook', 'Screenshots', 'Source / encode inspection']) assert.ok(!sparse.includes(heading), `Empty section rendered: ${heading}`);
  for (const field of ['Source', 'Resolution', 'Frame rate', 'Video codec', 'Profile', 'Bit depth', 'Bitrate', 'File size', 'CRC32']) assert.ok(!sparse.includes(`<dt>${field}</dt>`), `Absent field rendered: ${field}`);
  assert.ok(!sparse.includes('N/A'));
  for (const route of [`anime/${adultMarker}`, `releases/${adultMarker}-child`, `releases/${adultMarker}-mixed`, `guides/${adultMarker}-guide`]) {
    const html = await readFile(path.join(root, 'dist', route, 'index.html'), 'utf8');
    assert.match(html, /data-adult-gate/); assert.match(html, /noindex, nofollow/);
    assert.doesNotMatch(html.split('</head>')[0], new RegExp(adultMarker));
    assert.doesNotMatch(html, /\ssrc="https:\/\/media\.test/); assert.doesNotMatch(html, /\sposter="https:\/\/media\.test/);
    assert.doesNotMatch(html, /data-pagefind-body/);
  }
  const generalIndex = await readFile(path.join(root, 'dist/search-index.json'), 'utf8'); assert.ok(!generalIndex.includes('Swing Out Sisters'));
  const adultIndex = await readFile(path.join(root, 'dist/adult/search-index.json'), 'utf8'); assert.ok(adultIndex.includes(adultMarker)); assert.ok(adultIndex.includes('/adult/#'));
  console.log('Production audit passed: drafts excluded; adult records absent from general pages and Pagefind; adult readers gated with neutral metadata; studio assets absent; optional sections omitted.');
} finally {
  for (const file of files) await unlink(file);
  await build();
  console.log('Temporary fixtures removed; clean sample archive rebuilt.');
}
