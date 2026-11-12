import { mkdir, writeFile, readdir, lstat, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify, parse } from 'yaml';

const collections = { anime: 'anime', episode: 'episodes', guide: 'guides' };
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

async function collectionDirectory(root, folder, create = false) {
  let current = await realpath(root);
  for (const segment of ['src', 'content', folder]) {
    current = path.join(current, segment);
    let info;
    try { info = await lstat(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!info && create) { await mkdir(current); info = await lstat(current); }
    if (!info || info.isSymbolicLink() || !info.isDirectory()) throw Object.assign(new Error('Collection folders must be real directories inside this workspace.'), { status: 422 });
  }
  return current;
}

export function slugify(value) {
  let slug = String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '');
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(slug)) slug = `entry-${slug}`;
  return slug;
}

export function isLocalRequest(request) {
  const host = request.headers.host ?? '';
  const origin = request.headers.origin ?? '';
  return loopback.has(request.socket.remoteAddress) && /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)
    && origin === `http://${host}` && (!request.headers['sec-fetch-site'] || request.headers['sec-fetch-site'] === 'same-origin');
}

function serializeDates(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDates);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, serializeDates(v)]));
  return value;
}

export async function saveContent({ root, kind, payload, schemas, validateMdx }) {
  if (!Object.hasOwn(collections, kind)) throw Object.assign(new Error('Unknown content type.'), { status: 404 });
  const result = schemas[kind].safeParse(payload);
  if (!result.success) throw Object.assign(new Error('Please correct the highlighted content fields.'), {
    status: 422, fields: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
  const { data, body } = result.data;
  const collectionRoot = await collectionDirectory(root, collections[kind], true);
  const fallback = kind === 'episode' ? `${data.anime}-${data.isBatch ? 'batch-' : ''}${data.episodeNumber}-${data.version}` : data.title;
  const id = slugify(result.data.slug || fallback);
  if (!id) throw Object.assign(new Error('Enter a content ID using at least one letter or number.'), { status: 422 });
  const filename = `${id}.mdx`;
  const destination = path.resolve(collectionRoot, filename);
  if (path.dirname(destination) !== collectionRoot) throw Object.assign(new Error('Invalid content path.'), { status: 422 });
  let parentDraft = false;
  if (kind === 'episode') {
    const animeRoot = await collectionDirectory(root, 'anime');
    const files = await readdir(animeRoot, { recursive: true });
    const parentFile = files.find((file) => /\.(md|mdx)$/i.test(file) && file.replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '') === data.anime);
    if (!parentFile) throw Object.assign(new Error('Select an existing anime or manga entry.'), { status: 422 });
    const parentPath = path.join(animeRoot, parentFile);
    const actualParent = await realpath(parentPath);
    if (!actualParent.startsWith(`${animeRoot}${path.sep}`)) throw Object.assign(new Error('Referenced content must stay inside the anime folder.'), { status: 422 });
    const parentContent = await readFile(actualParent, 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(parentContent);
    parentDraft = frontmatter ? parse(frontmatter[1])?.draft === true : false;
  }
  if (validateMdx) {
    try { await validateMdx(body); } catch (error) {
      throw Object.assign(new Error(`The guide or notes contain invalid MDX: ${error.message}`), { status: 422 });
    }
  }
  const existing = await readdir(collectionRoot);
  if (existing.some((file) => [filename.toLowerCase(), `${id}.md`].includes(file.toLowerCase()))) throw Object.assign(new Error(`“${id}” already exists. Choose a different content ID; your existing file was preserved.`), { status: 409 });
  const content = `---\n${stringify(serializeDates(data), { lineWidth: 100, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${body.trim()}\n`;
  try { await writeFile(destination, content, { encoding: 'utf8', flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') throw Object.assign(new Error(`“${id}” already exists. Choose a different content ID; your existing file was preserved.`), { status: 409 });
    throw error;
  }
  return { ok: true, id, file: `src/content/${collections[kind]}/${filename}`, draft: data.draft, hiddenByParent: parentDraft,
    url: data.draft || parentDraft ? null : `/${kind === 'episode' ? 'releases' : kind === 'guide' ? 'guides' : 'anime'}/${id}/` };
}

export function studioPlugin(root) {
  return {
    name: 'yuuki-local-studio',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const match = /^\/__studio\/save-(anime|episode|guide)$/.exec(pathname);
        if (!match) return next();
        const send = (status, data) => {
          response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          response.end(JSON.stringify(data));
        };
        if (!isLocalRequest(request)) return send(403, { error: 'Publishing is available only from this local studio tab.' });
        if (request.method !== 'POST') return send(405, { error: 'Use POST to save local content.' });
        if (!(request.headers['content-type'] ?? '').startsWith('application/json')) return send(415, { error: 'Send a JSON content payload.' });
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of request) {
            size += Buffer.byteLength(chunk);
            if (size > 1_000_000) return send(413, { error: 'Content exceeds the 1 MB studio limit.' });
            chunks.push(chunk);
          }
          let payload;
          try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { return send(400, { error: 'The submitted JSON could not be read.' }); }
          const { studioSchemas } = await server.ssrLoadModule('/src/lib/studio-schema.ts');
          const { compile } = await import('@mdx-js/mdx');
          send(201, await saveContent({ root, kind: match[1], payload, schemas: studioSchemas,
            validateMdx: (body) => compile(body, { jsx: true }) }));
        } catch (error) {
          if (!error.status) server.config.logger.error(`[studio] ${error.message}`);
          send(error.status ?? 500, { error: error.status ? error.message : 'The content could not be saved. Check the local server output.', fields: error.fields });
        }
      });
    },
  };
}
