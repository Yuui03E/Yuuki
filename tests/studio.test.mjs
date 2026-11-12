import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compile } from '@mdx-js/mdx';
import { studioSchemas } from '../src/lib/studio-schema.ts';
import { episodeFields } from '../src/lib/content-fields.ts';
import { z } from 'astro/zod';
import { slugify, isLocalRequest, saveContent } from '../scripts/studio-server.mjs';

const data = { title: 'Studio test series', status: 'Planned', sourceType: 'BD', coverImage: '/images/frieren-cover.svg', synopsis: 'Local validation fixture.' };
const guide = { title: 'Studio test guide', description: 'A test guide.', category: 'Encoding', difficulty: 'Beginner', updatedDate: '2026-11-13' };
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yuuki-studio-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/content/anime'), { recursive: true });
  await writeFile(path.join(root, 'src/content/anime/series.mdx'), '---\ntitle: Series\ndraft: false\n---\n');
  return root;
}
const save = (root, kind, payload) => saveContent({ root, kind, payload, schemas: studioSchemas, validateMdx: (body) => compile(body, { jsx: true }) });
test('local origin, host, and remote address must agree', () => {
  const request = { headers: { host: '127.0.0.1:4321', origin: 'http://127.0.0.1:4321', 'sec-fetch-site': 'same-origin' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(isLocalRequest(request), true);
  assert.equal(isLocalRequest({ ...request, headers: { ...request.headers, origin: 'https://evil.example' } }), false);
  assert.equal(isLocalRequest({ ...request, headers: { ...request.headers, host: 'evil.example:4321' } }), false);
  assert.equal(isLocalRequest({ ...request, headers: { ...request.headers, origin: undefined } }), false);
  assert.equal(isLocalRequest({ ...request, socket: { remoteAddress: '192.168.1.5' } }), false);
  assert.equal(isLocalRequest({ ...request, headers: { ...request.headers, 'sec-fetch-site': 'cross-site' } }), false);
});
test('safe names remove traversal and handle Windows device names', () => {
  assert.equal(slugify('../../My New Series!'), 'my-new-series');
  assert.equal(slugify('CON'), 'entry-con');
  assert.equal(slugify('Crème brûlée'), 'creme-brulee');
});
test('all episode technical inputs can be omitted', () => {
  const required = { episodeNumber: 1, releaseDate: '2026-11-13' };
  assert.equal(z.object(episodeFields).safeParse(required).success, true);
  for (const key of ['thumbnail', 'source', 'container', 'resolution', 'frameRate', 'videoCodec', 'videoProfile', 'bitDepth', 'bitrate', 'fileSize', 'crc32', 'audioTracks', 'subtitleTracks', 'encoderParams', 'filterScript', 'mediainfo', 'screenshots', 'comparisons', 'downloads']) assert.equal(episodeFields[key].safeParse(undefined).success, true, key);
});
test('valid content saves clean frontmatter and preserves multiline MDX', async (t) => {
  const root = await fixture(t);
  const result = await save(root, 'guide', { data: guide, body: '## Test heading\n\n~~~bash\necho hello\n~~~' });
  assert.equal(result.id, 'studio-test-guide');
  const file = await readFile(path.join(root, result.file), 'utf8');
  assert.match(file, /updatedDate: "?2026-11-13T00:00:00.000Z/);
  assert.match(file, /## Test heading/);
});
test('duplicate MDX and Markdown content IDs never overwrite files', async (t) => {
  const root = await fixture(t);
  const first = await save(root, 'anime', { data });
  const before = await readFile(path.join(root, first.file), 'utf8');
  await assert.rejects(save(root, 'anime', { data }), { status: 409 });
  assert.equal(await readFile(path.join(root, first.file), 'utf8'), before);
  await writeFile(path.join(root, 'src/content/anime/existing.md'), 'existing user content');
  await assert.rejects(save(root, 'anime', { slug: 'Existing', data }), { status: 409 });
});
test('invalid schemas, executable links, CRC, unknown fields, and MDX are rejected', async (t) => {
  const root = await fixture(t);
  await assert.rejects(save(root, 'anime', { data: { ...data, unknown: true } }), { status: 422 });
  await assert.rejects(save(root, 'episode', { data: { anime: 'series', episodeNumber: 1, releaseDate: 'bad date' } }), { status: 422 });
  for (const extra of [{ crc32: 'not-a-crc' }, { downloads: [{ label: 'Bad', url: 'javascript:alert(1)' }] }, { screenshots: [{ src: '/images/../../secret' }] }]) await assert.rejects(save(root, 'episode', { data: { anime: 'series', episodeNumber: 1, releaseDate: '2026-11-13', ...extra } }), { status: 422 });
  await assert.rejects(save(root, 'guide', { data: guide, body: '<Unclosed>' }), { status: 422 });
  await assert.rejects(save(root, 'constructor', { data }), { status: 404 });
});
test('missing references are rejected; draft parents hide public links', async (t) => {
  const root = await fixture(t);
  const episode = { episodeNumber: '01–12 Batch', isBatch: true, releaseDate: '2026-11-13' };
  await assert.rejects(save(root, 'episode', { data: { ...episode, anime: 'missing' } }), { status: 422 });
  await writeFile(path.join(root, 'src/content/anime/draft-series.mdx'), '---\ntitle: Draft\ndraft: true\n---\n');
  const result = await save(root, 'episode', { data: { ...episode, anime: 'draft-series' } });
  assert.equal(result.hiddenByParent, true);
  assert.equal(result.url, null);
});
test('collection directory links cannot redirect publishing writes', async (t) => {
  const root = await fixture(t);
  const outside = path.join(root, 'outside'); await mkdir(outside);
  await symlink(outside, path.join(root, 'src/content/guides'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(save(root, 'guide', { data: guide, body: 'Safe body' }), { status: 422 });
  assert.deepEqual(await readdir(outside), []);
});
