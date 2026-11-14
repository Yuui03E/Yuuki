import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { uploadMedia, mediaStatus, mediaType, validateCatalog } from '../scripts/media-library.mjs';
import { mediaWorkerConfig } from '../scripts/deploy-media.mjs';
import { writeR2Config } from '../scripts/r2-config.mjs';
import { parseMediaUpload } from '../scripts/studio-server.mjs';
import { backupPost } from '../scripts/post-backups.mjs';
import { validatePost } from '../src/lib/media-paths.mjs';

const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nOIAAAAASUVORK5CYII=', 'base64');
const hash = createHash('sha256').update(bytes).digest('hex');
const settings = { accountId: 'a'.repeat(32), bucketName: 'yuuki-media', workerName: 'yuuki-media', mediaOrigin: 'https://yuuki-media.unit-test.workers.dev', publicOrigin: 'https://yuuki03e.pages.dev', storageBudgetBytes: 9_000_000_000 };
async function fixture(t, config = settings) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yuuki-media-')); t.after(() => rm(root, { recursive: true, force: true }));
  if (config) await writeFile(path.join(root, 'r2.local.json'), JSON.stringify(config));
  const objects = new Map(); const calls = [];
  const tool = async (_project, name, args) => { calls.push(args); if (args[2] === 'put') { assert.equal(name, 'wrangler'); assert.ok(args.includes('--remote')); assert.ok(args.includes('Standard')); const config = JSON.parse(await readFile(args[args.indexOf('--config') + 1])); assert.equal(config.account_id, settings.accountId); objects.set(args[3].split('/').slice(1).join('/'), await readFile(args[args.indexOf('--file') + 1])); } };
  const fetcher = async (url) => {
    if (url.endsWith('/health')) return Response.json({ service: 'yuuki-media', version: 1, bucketName: settings.bucketName });
    const key = new URL(url).pathname.slice(1); const file = objects.get(key);
    return new Response(file ?? 'missing', { status: file ? 200 : 404, headers: { 'X-Yuuki-Media': '1' } });
  };
  return { root, objects, calls, tool, fetcher, post: { collection: 'anime', id: 'my-post', title: 'My post', uploadId: randomUUID() } };
}
const upload = (f, extra = {}) => uploadMedia({ ...f, bytes, filename: 'original.png', audience: 'general', ...extra });
test('upload preserves originals, selects account, verifies bytes, and reuses identical objects', async (t) => {
  const f = await fixture(t); const result = await upload(f);
  assert.equal(result.url, `${settings.mediaOrigin}/media/general/anime/my-post/${hash}.png`);
  assert.deepEqual(await readFile(path.join(f.root, result.backup)), bytes);
  assert.equal(result.onlineCatalogBackedUp, true);
  const catalog = JSON.parse(await readFile(path.join(f.root, 'media-library/catalog.json'))); assert.equal(catalog.assets[0].verified, true);
  const online = f.objects.get('metadata/catalog.json').toString(); assert.ok(!online.includes('original.png'));
  await upload(f); assert.equal(f.calls.filter((args) => args[3].includes('media/general/')).length, 1);
  const status = await mediaStatus(f.root); assert.equal(status.storedBytes, bytes.length);
});
test('missing configuration, media types, size and local budget stop unsafe uploads', async (t) => {
  const missing = await fixture(t, null); assert.equal((await mediaStatus(missing.root)).configured, false); await assert.rejects(upload(missing), { status: 503 });
  assert.throws(() => mediaType(Buffer.from('<svg/>')), { status: 422 });
  const f = await fixture(t, { ...settings, storageBudgetBytes: 1 }); await assert.rejects(upload(f), { status: 413 }); assert.equal(f.calls.length, 0);
  await assert.rejects(upload(f, { audience: 'anything' }), { status: 422 });
  const large = Buffer.alloc(10_000_001); bytes.copy(large); await assert.rejects(upload(f, { bytes: large }), { status: 413 });
});
test('existing remote mismatch is never intentionally overwritten; original survives verification failure', async (t) => {
  const f = await fixture(t); f.objects.set(`media/general/anime/my-post/${hash}.png`, Buffer.from('different'));
  await assert.rejects(upload(f), { status: 409 }); assert.equal(f.calls.length, 0);
  assert.deepEqual(await readFile(path.join(f.root, `media-library/posts/anime/my-post/media/general/${hash}.png`)), bytes);
  assert.equal(JSON.parse(await readFile(path.join(f.root, 'media-library/catalog.json'))).assets[0].verified, false);
});
test('failed cloud upload keeps pending budget reservation, supports retry, and reports metadata-only failure', async (t) => {
  const f = await fixture(t); await assert.rejects(upload(f, { tool: async () => { throw Error('failed'); } }), { status: 502 });
  assert.equal((await mediaStatus(f.root)).storedBytes, bytes.length);
  const result = await upload(f, { tool: async (...args) => { if (args[2][3].includes('metadata/')) throw Error(); return f.tool(...args); } });
  assert.equal(result.onlineCatalogBackedUp, false); assert.equal((await mediaStatus(f.root)).storedBytes, bytes.length);
});
test('backup/config/catalog links and concurrent locks cannot redirect writes', async (t) => {
  const f = await fixture(t); await mkdir(path.join(f.root, 'outside'));
  await symlink(path.join(f.root, 'outside'), path.join(f.root, '.wrangler'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(writeR2Config(f.root, 'r2-upload.json', {}));
  const g = await fixture(t); await mkdir(path.join(g.root, 'media-library/objects'), { recursive: true });
  await writeFile(path.join(g.root, 'media-library/.upload.lock'), 'held'); await assert.rejects(upload(g), { status: 409 });
  const h = await fixture(t); await mkdir(path.join(h.root, 'media-library/objects'), { recursive: true }); await writeFile(path.join(h.root, 'media-library/catalog.json'), '{bad'); await assert.rejects(upload(h), { status: 422 });
});
test('catalog consistency and multipart fields are validated', async () => {
  assert.throws(() => validateCatalog({ version: 1, assets: [{ key: `media/general/${hash}.png`, sha256: hash, size: bytes.length, audience: 'adult', contentType: 'image/png', verified: true }] }), { status: 422 });
  const form = new FormData(); form.set('file', new File([bytes], 'test.png')); form.set('audience', 'adult');
  form.set('post', JSON.stringify({ collection: 'anime', id: 'my-post', title: 'My post', uploadId: randomUUID() }));
  const request = new Request('http://localhost', { method: 'POST', body: form });
  const parsed = await parseMediaUpload(Buffer.from(await request.arrayBuffer()), request.headers.get('content-type')); assert.equal(parsed.audience, 'adult'); assert.deepEqual(parsed.bytes, bytes);
  form.append('extra', 'bad'); const invalid = new Request('http://localhost', { method: 'POST', body: form });
  await assert.rejects(parseMediaUpload(Buffer.from(await invalid.arrayBuffer()), invalid.headers.get('content-type')), { status: 422 });
  const config = mediaWorkerConfig('/project', settings); assert.equal(config.r2_buckets[0].bucket_name, settings.bucketName); assert.equal(config.workers_dev, true);
});

test('post identity survives title changes, separates shared files and refuses folder collisions', async (t) => {
  const f = await fixture(t); const first = await upload(f);
  const renamed = await upload(f, { post: { ...f.post, title: 'Renamed post' } });
  assert.equal(first.url, renamed.url);
  const manifest = JSON.parse(await readFile(path.join(f.root, 'media-library/posts/anime/my-post/manifest.json')));
  assert.equal(manifest.post.title, 'Renamed post'); assert.equal(manifest.assets[0].filename, 'original.png');
  await assert.rejects(upload(f, { post: { ...f.post, uploadId: randomUUID() } }), { status: 409 });
  const second = await upload(f, { post: { ...f.post, id: 'another-post', uploadId: randomUUID() } });
  assert.notEqual(first.url, second.url); assert.equal((await mediaStatus(f.root)).storedBytes, bytes.length * 2);
  for (const id of ['../escape', 'CON', 'bad/path', 'x'.repeat(101)]) assert.throws(() => validatePost({ ...f.post, id }), { status: 422 });
});

test('grouped media and source backups reject directory links and preserve all revisions privately', async (t) => {
  const f = await fixture(t); await upload(f);
  const folder = path.join(f.root, 'src/content/anime'); await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'my-post.mdx'); const original = '---\ntitle: My post\ndraft: true\n---\nPrivate source.\n';
  await writeFile(file, original);
  const first = await backupPost({ ...f, online: true });
  await writeFile(file, original + 'Updated.\n'); const second = await backupPost({ ...f, online: true });
  assert.notEqual(first.sha256, second.sha256);
  assert.equal(await readFile(path.join(f.root, first.backup, 'revisions', `${first.sha256}.mdx`), 'utf8'), original);
  assert.ok(f.objects.has(`metadata/posts/anime/my-post/revisions/${first.sha256}.mdx`));
  assert.ok(![...f.objects.keys()].some((key) => key.startsWith('media/') && key.endsWith('.mdx')));
  await assert.rejects(upload(f), { status: 409 }); // Studio creates new posts; saved IDs stay protected.
  const g = await fixture(t); await mkdir(path.join(g.root, 'media-library/posts/anime'), { recursive: true });
  await mkdir(path.join(g.root, 'outside'));
  await symlink(path.join(g.root, 'outside'), path.join(g.root, 'media-library/posts/anime/my-post'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(upload(g), { status: 422 }); assert.equal(g.calls.length, 0);
});

test('a legacy catalog remains valid and old copies count toward the budget during migration', async (t) => {
  const f = await fixture(t); await mkdir(path.join(f.root, 'media-library/objects'), { recursive: true });
  const legacy = { key: `media/general/${hash}.png`, sha256: hash, audience: 'general', size: bytes.length, contentType: 'image/png', verified: true };
  await writeFile(path.join(f.root, 'media-library/catalog.json'), JSON.stringify({ version: 1, assets: [legacy] }));
  await writeFile(path.join(f.root, `media-library/objects/${hash}.png`), bytes);
  await upload(f);
  const catalog = validateCatalog(JSON.parse(await readFile(path.join(f.root, 'media-library/catalog.json'))));
  assert.equal(catalog.version, 2); assert.equal(catalog.assets.length, 2);
  assert.equal((await mediaStatus(f.root)).storedBytes, bytes.length * 2);
  assert.deepEqual(await readFile(path.join(f.root, `media-library/objects/${hash}.png`)), bytes);
});

test('loaded guides attach media to their existing post folder only with the current source hash', async (t) => {
  const f = await fixture(t); await mkdir(path.join(f.root, 'src/content/guides'), { recursive: true });
  const file = path.join(f.root, 'src/content/guides/my-post.mdx'); const source = '---\ntitle: My guide\n---\n\nOriginal.'; await writeFile(file, source);
  const post = { ...f.post, collection: 'guides', sourceHash: createHash('sha256').update(source).digest('hex') };
  const result = await upload(f, { post }); assert.ok(result.url.includes('/media/general/guides/my-post/'));
  await assert.rejects(upload(f, { post: { ...post, sourceHash: undefined } }), { status: 409 });
  await writeFile(file, source + ' External change.'); await assert.rejects(upload(f, { post }), { status: 409 });
  assert.equal((await mediaStatus(f.root)).assets, 1);
});
