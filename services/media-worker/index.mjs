import { parseMediaKey } from '../../src/lib/media-paths.mjs';

export function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || !size || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (![start, end, Number(match[2] || 0)].every(Number.isSafeInteger) || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) return null;
  return { offset: start, length: end - start + 1 };
}
const matchesEtag = (value, etag) => value?.split(',').some((item) => item.trim() === '*' || item.trim().replace(/^W\//, '') === etag);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = (env.PUBLIC_ORIGINS ?? '').split(',').map((value) => value.trim());
    const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'X-Yuuki-Media': '1', Vary: 'Origin' });
    if (origin && !allowed.includes(origin)) return new Response('Origin not allowed.', { status: 403, headers });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      headers.set('Allow', 'GET, HEAD, OPTIONS');
      return new Response('This service only reads media.', { status: 405, headers });
    }
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Range, If-None-Match, If-Range');
      headers.set('Access-Control-Max-Age', '86400');
      return new Response(null, { status: 204, headers });
    }
    if (url.pathname === '/health' && !url.search) {
      headers.set('Content-Type', 'application/json'); headers.set('Cache-Control', 'no-store');
      return new Response(request.method === 'HEAD' ? null : JSON.stringify({ service: 'yuuki-media', version: 1, bucketName: env.BUCKET_NAME }), { headers });
    }
    const match = parseMediaKey(url.pathname.slice(1));
    if (!match || url.search) return new Response('Media not found.', { status: 404, headers });
    const key = url.pathname.slice(1);
    const cached = request.method === 'GET' && !request.headers.has('Range') && !request.headers.has('If-None-Match') ? globalThis.caches?.default : null;
    const cacheKey = new Request(url.toString());
    if (cached) {
      const hit = await cached.match(cacheKey).catch(() => null);
      if (hit) {
        const response = new Response(hit.body, hit);
        for (const [name, value] of headers) response.headers.set(name, value);
        if (!origin) response.headers.delete('Access-Control-Allow-Origin');
        return response;
      }
    }
    try {
      const rangeValue = request.method === 'GET' ? request.headers.get('Range') : null;
      const needsHead = request.method === 'HEAD' || rangeValue || request.headers.has('If-None-Match');
      let object = needsHead ? await env.MEDIA_BUCKET.head(key) : await env.MEDIA_BUCKET.get(key);
      if (!object) return new Response(request.method === 'HEAD' ? null : 'Media not found.', { status: 404, headers });
      headers.set('Content-Type', match.contentType);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Accept-Ranges', 'bytes'); headers.set('ETag', object.httpEtag);
      if (object.uploaded) headers.set('Last-Modified', object.uploaded.toUTCString());
      if (matchesEtag(request.headers.get('If-None-Match'), object.httpEtag)) return new Response(null, { status: 304, headers });
      let range;
      const ifRange = request.headers.get('If-Range');
      const rangeAllowed = !ifRange || ifRange === object.httpEtag || (object.uploaded && Number.isFinite(Date.parse(ifRange)) && Math.floor(object.uploaded.getTime() / 1000) <= Date.parse(ifRange) / 1000);
      if (rangeValue && rangeAllowed) {
        range = byteRange(rangeValue, object.size);
        if (!range) {
          headers.set('Content-Range', `bytes */${object.size}`); headers.set('Cache-Control', 'no-store');
          return new Response('Requested byte range is unavailable.', { status: 416, headers });
        }
      }
      const size = object.size;
      if (request.method === 'GET' && needsHead) object = await env.MEDIA_BUCKET.get(key, range ? { range } : undefined);
      if (!object || (request.method === 'GET' && !object.body)) throw new Error('R2 object unavailable');
      headers.set('Content-Length', String(range?.length ?? size));
      if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`);
      const response = new Response(request.method === 'HEAD' ? null : object.body, { status: range ? 206 : 200, headers });
      if (cached && ctx?.waitUntil) {
        const copy = response.clone(); copy.headers.delete('Access-Control-Allow-Origin'); copy.headers.delete('Vary');
        ctx.waitUntil(cached.put(cacheKey, copy).catch(() => {}));
      }
      return response;
    } catch {
      headers.set('Cache-Control', 'no-store'); headers.delete('Content-Length'); headers.delete('Content-Range');
      return new Response(request.method === 'HEAD' ? null : 'Media temporarily unavailable.', { status: 503, headers });
    }
  },
};
