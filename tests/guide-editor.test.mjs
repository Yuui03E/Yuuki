import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import { studioSchemas } from '../src/lib/studio-schema.ts';
import { loadGuide, updateGuide } from '../scripts/guide-editor.mjs';
import { digest } from '../scripts/media-files.mjs';
import { assertAdultBody } from '../src/lib/audience.mjs';

const basic = { title: 'Test guide', description: 'Choose and inspect a sample.', category: 'Encoding', difficulty: 'Intermediate', updatedDate: '2026-11-14', draft: true };
const preset = { title: 'My preset', goal: 'Smaller files', tradeoff: 'More time', command: 'ffmpeg -n -i input.mkv output.mkv' };
async function fixture(t, extension = 'mdx') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yuuki-guide-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/content/guides'), { recursive: true });
  const file = path.join(root, `src/content/guides/my-guide.${extension}`);
  const original = '---\ntitle: Test guide\ndescription: Original guide.\ncategory: Encoding\ndifficulty: Intermediate\nupdatedDate: 2026-11-14\ndraft: true\n---\n\n## Original\n\nKeep this revision.\n';
  await writeFile(file, original); return { root, file, original };
}
const update = (f, payload) => updateGuide({ root: f.root, payload, schema: studioSchemas.guide, validateMdx: (body) => compile(body, { jsx: true }) });
test('guide fields keep media optional and validate arrays, commands and complete comparison pairs', () => {
  assert.equal(studioSchemas.guide.safeParse({ data: basic, body: 'Plain guide.' }).success, true);
  const data = { ...basic, presets: [preset], screenshots: [{ src: '/images/frame-source.svg' }], comparisons: [{ title: 'Inspect', sourceImage: '/images/frame-source.svg', encodeImage: '/images/frame-encode.svg' }], videos: [{ title: 'Motion', src: 'https://media.test/test.mp4' }], takeaways: ['Pick a preset'], prerequisites: ['FFmpeg'] };
  assert.equal(studioSchemas.guide.safeParse({ data, body: 'A complete guide.' }).success, true);
  for (const extra of [{ comparisons: [{ title: 'Incomplete', sourceImage: '/images/frame-source.svg' }] }, { videos: [{ title: 'Bad', src: 'javascript:alert(1)' }] }, { presets: [{ ...preset, command: '' }] }, { screenshots: Array.from({ length: 41 }, () => ({ src: '/images/frame-source.svg' })) }]) assert.equal(studioSchemas.guide.safeParse({ data: { ...basic, ...extra }, body: 'Body' }).success, false);
});
test('editing preserves the previous source, stable ID, .md extension, and complete media metadata', async (t) => {
  const f = await fixture(t, 'md'); const loaded = await loadGuide({ root: f.root, id: 'my-guide' });
  const result = await update(f, { id: loaded.id, expectedSha256: loaded.sha256, content: { slug: 'my-guide', data: { ...basic, title: 'Renamed guide', presets: [preset], screenshots: [{ src: '/images/frame-source.svg', caption: 'Inspect lineart' }] }, body: '## Updated\n\nNew explanation.' } });
  assert.equal(result.updated, true); assert.equal(result.id, loaded.id); assert.equal(result.file, 'src/content/guides/my-guide.md'); assert.equal(result.localBackup, true);
  assert.equal(await readFile(path.join(f.root, `media-library/posts/guides/my-guide/revisions/${loaded.sha256}.md`), 'utf8'), f.original);
  const current = await loadGuide({ root: f.root, id: 'my-guide' }); assert.equal(current.data.title, 'Renamed guide'); assert.equal(current.data.screenshots[0].caption, 'Inspect lineart'); assert.equal(current.data.presets[0].language, 'Command Prompt');
  assert.equal(digest(await readFile(f.file)), result.sha256);
  await assert.rejects(update(f, { id: loaded.id, expectedSha256: loaded.sha256, content: { data: basic, body: 'Stale edit' } }), { status: 409 });
  assert.equal(digest(await readFile(f.file)), result.sha256);
});
test('guide editing rejects traversal, linked sources, unknown fields and a changed Content ID', async (t) => {
  const f = await fixture(t); const loaded = await loadGuide({ root: f.root, id: 'my-guide' });
  await assert.rejects(loadGuide({ root: f.root, id: '../my-guide' }), { status: 422 });
  for (const content of [{ slug: 'different-id', data: basic, body: 'Text' }, { data: { ...basic, unknown: true }, body: 'Text' }]) await assert.rejects(update(f, { id: loaded.id, expectedSha256: loaded.sha256, content }), { status: 422 });
  await mkdir(path.join(f.root, 'outside')); await writeFile(path.join(f.root, 'outside/linked.mdx'), f.original);
  await symlink(path.join(f.root, 'outside'), path.join(f.root, 'src/content/guides/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(loadGuide({ root: f.root, id: 'linked/linked' }), { status: 422 });
  assert.equal(await readFile(f.file, 'utf8'), f.original);
});
test('adult guide disclosure sections remain safe and media still belongs in dedicated fields', () => {
  assert.doesNotThrow(() => assertAdultBody('<details>\n<summary>Measurements</summary>\n\nPlain text.\n</details>'));
  for (const body of ['<details open><summary>Title</summary></details>', '<summary onclick="alert(1)">Title</summary>', '<details><summary>Image</summary><img src="https://example.com/x.png"/></details>']) assert.throws(() => assertAdultBody(body));
});
