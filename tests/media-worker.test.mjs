import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../services/media-worker/index.mjs';

const url = `https://media.example/media/general/${'a'.repeat(64)}.mp4`;
const bytes = new TextEncoder().encode('0123456789');
const env = { BUCKET_NAME: 'yuuki-media', PUBLIC_ORIGINS: 'https://yuuki03e.pages.dev', MEDIA_BUCKET: {
  async head() { return { size: bytes.length, httpEtag: '"abc"', uploaded: new Date('2026-11-14T00:00:00Z') }; },
  async get(key, options) { const meta = await this.head(key); const r = options?.range; return { ...meta, body: new Response(r ? bytes.slice(r.offset, r.offset + r.length) : bytes).body }; },
} };
const call = (headers = {}, method = 'GET', target = url, binding = env) => worker.fetch(new Request(target, { method, headers }), binding);
test('read-only public paths, origins, health and private metadata boundaries', async () => {
  assert.equal((await call({}, 'POST')).status, 405);
  assert.equal((await call({ Origin: 'https://other.example' })).status, 403);
  assert.equal((await call({}, 'GET', 'https://media.example/metadata/catalog.json')).status, 404);
  assert.equal((await call({}, 'GET', `${url}?anything=1`)).status, 404);
  assert.equal((await call({}, 'OPTIONS')).status, 204);
  const health = await call({}, 'GET', 'https://media.example/health');
  assert.deepEqual(await health.json(), { service: 'yuuki-media', version: 1, bucketName: 'yuuki-media' });
  const response = await call({ Origin: 'https://yuuki03e.pages.dev' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://yuuki03e.pages.dev');
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
  assert.equal(await response.text(), '0123456789');
  assert.equal((await call({}, 'HEAD')).headers.get('Content-Length'), '10');
  assert.equal(await (await call({ Range: 'bytes=2-4' }, 'HEAD')).text(), '');
});
test('video byte ranges, suffixes and open ends return exact bytes', async () => {
  for (const [input, output, range] of [['bytes=2-4', '234', 'bytes 2-4/10'], ['bytes=8-', '89', 'bytes 8-9/10'], ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=-99', '0123456789', 'bytes 0-9/10'], ['bytes=8-99', '89', 'bytes 8-9/10']]) {
    const response = await call({ Range: input }); assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), range); assert.equal(response.headers.get('Content-Length'), String(output.length)); assert.equal(await response.text(), output);
  }
  for (const value of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=999999999999999999999-', 'bad']) {
    const response = await call({ Range: value }); assert.equal(response.status, 416); assert.equal(response.headers.get('Content-Range'), 'bytes */10');
  }
});
test('ETag conditions work for GET and HEAD; If-Range falls back to full file', async () => {
  for (const method of ['GET', 'HEAD']) for (const value of ['"abc"', 'W/"abc"', '*', '"other", "abc"']) assert.equal((await call({ 'If-None-Match': value }, method)).status, 304);
  assert.equal((await call({ Range: 'bytes=2-4', 'If-Range': '"abc"' })).status, 206);
  assert.equal((await call({ Range: 'bytes=2-4', 'If-Range': '"wrong"' })).status, 200);
  assert.equal((await call({ Range: 'bytes=2-4', 'If-Range': 'Fri, 13 Nov 2026 00:00:00 GMT' })).status, 200);
  assert.equal((await call({ Range: 'bytes=2-4', 'If-Range': 'Sat, 14 Nov 2026 00:00:00 GMT' })).status, 206);
});
test('missing objects and unavailable R2 are distinct from invalid ranges', async () => {
  const missing = { ...env, MEDIA_BUCKET: { head: async () => null, get: async () => null } };
  assert.equal((await call({}, 'GET', url, missing)).status, 404);
  const broken = { ...env, MEDIA_BUCKET: { head: async () => { throw Error(); }, get: async () => { throw Error(); } } };
  assert.equal((await call({ Range: 'bytes=2-4' }, 'GET', url, broken)).status, 503);
});
test('cached responses receive mutable, per-request CORS headers', async () => {
  const previous = globalThis.caches;
  globalThis.caches = { default: { match: async () => {
    const response = new Response('cached', { headers: { 'Content-Type': 'video/mp4' } });
    Object.defineProperty(response.headers, 'set', { value() { throw Error('immutable'); } });
    return response;
  } } };
  try { const response = await call({ Origin: 'https://yuuki03e.pages.dev' }); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://yuuki03e.pages.dev'); assert.equal(await response.text(), 'cached'); }
  finally { if (previous === undefined) delete globalThis.caches; else globalThis.caches = previous; }
});

test('grouped image and video addresses work while manifests, sources and invalid IDs stay private', async () => {
  const grouped = `https://media.example/media/adult/anime/my-post/${'a'.repeat(64)}.webp`;
  assert.equal((await call({}, 'GET', grouped)).headers.get('Content-Type'), 'image/webp');
  assert.equal((await call({ Range: 'bytes=2-4' }, 'GET', grouped.replace('.webp', '.mp4'))).status, 206);
  for (const target of [grouped.replace('my-post', 'con'), grouped.replace('my-post', 'bad%2Fname'), grouped.replace('my-post', '-invalid'), grouped.replace('.webp', '.json'), 'https://media.example/metadata/posts/anime/my-post/manifest.json']) assert.equal((await call({}, 'GET', target)).status, 404);
});
