import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compile } from '@mdx-js/mdx';
import { studioSchemas } from '../src/lib/studio-schema.ts';
import { episodeFields } from '../src/lib/content-fields.ts';
import { z } from 'astro/zod';
import { slugify, isLocalRequest, saveContent, invalidateContentImports } from '../scripts/studio-server.mjs';

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
test('content imports clear both server and evaluated module caches after a studio save', () => {
  const cleared = [];
  const id = '\0astro:content-module-imports';
  const module = {}; const evaluated = {};
  const environment = {
    moduleGraph: { getModulesByFile: (_file) => new Set(), getModuleById: (key) => key === id ? module : undefined, invalidateModule: (entry) => { assert.equal(entry, module); cleared.push('graph'); } },
    runner: { evaluatedModules: { getModulesByFile: (_file) => new Set(), getModuleById: (key) => key === id ? evaluated : undefined, invalidateModule: (entry) => { assert.equal(entry, evaluated); cleared.push('runner'); } } },
    hot: { send: (event) => { assert.equal(event, 'astro:content-changed'); cleared.push('routes'); } },
  };
  invalidateContentImports({ environments: { ssr: environment } }, '/project');
  assert.deepEqual(cleared, ['graph', 'runner', 'routes']);
  cleared.length = 0;
  environment.moduleGraph.getModuleById = () => undefined;
  environment.moduleGraph.getModulesByFile = (file) => { assert.ok(file.endsWith('/.astro/content-modules.mjs')); return new Set([module]); };
  environment.runner.evaluatedModules.getModuleById = () => undefined;
  environment.runner.evaluatedModules.getModulesByFile = (file) => { assert.ok(file.endsWith('/.astro/content-modules.mjs')); return new Set([evaluated]); };
  invalidateContentImports({ environments: { ssr: environment } }, '/project');
  assert.deepEqual(cleared, ['graph', 'runner', 'routes']);
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
test('adult parent and media infer classification; unsafe adult body cannot be saved', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'src/content/anime/adult-series.mdx'), '---\ntitle: Adult\ntags: [Hentai]\n---\n');
  const episode = { anime: 'adult-series', episodeNumber: 1, releaseDate: '2026-11-14' };
  const saved = await save(root, 'episode', { data: episode }); assert.equal(saved.adult, true);
  assert.match(await readFile(path.join(root, saved.file), 'utf8'), /adult: true/);
  await assert.rejects(save(root, 'episode', { data: { ...episode, episodeNumber: 2 }, body: '![image](https://example.com/x)' }), { status: 422 });
  await assert.rejects(save(root, 'guide', { data: guide, body: `![image](https://media.test/media/adult/${'a'.repeat(64)}.webp)` }), { status: 422 });
  const inferred = await save(root, 'anime', { data: { ...data, coverImage: `https://media.test/media/adult/${'a'.repeat(64)}.webp` } }); assert.equal(inferred.adult, true);
});
