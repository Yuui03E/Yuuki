import { mkdir, writeFile, readdir, lstat, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify, parse } from 'yaml';
import { isAdult, hasAdultMedia, assertAdultBody } from '../src/lib/audience.mjs';
import { uploadMedia, mediaStatus } from './media-library.mjs';
import { slugify, validatePost } from '../src/lib/media-paths.mjs';
import { backupPost } from './post-backups.mjs';
import { loadGuide, updateGuide } from './guide-editor.mjs';
import { digest } from './media-files.mjs';
export { slugify } from '../src/lib/media-paths.mjs';

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
  let parentData;
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
    parentData = frontmatter ? parse(frontmatter[1]) : undefined;
    parentDraft = parentData?.draft === true;
  }
  data.adult = isAdult(data, parentData) || hasAdultMedia(body);
  if (data.adult) {
    try { assertAdultBody(body); }
    catch (error) { throw Object.assign(new Error(error.message), { status: 422 }); }
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
  const post = { collection: collections[kind], id, title: data.title || `${parentData?.title || data.anime} · ${data.episodeNumber} · ${data.version}` };
  let localBackup = false;
  try { await backupPost({ root, post }); localBackup = true; }
  catch (error) { console.warn(`Post saved, but local backup needs repair: ${error.message}`); }
  return { ok: true, id, post, localBackup, file: `src/content/${collections[kind]}/${filename}`, draft: data.draft, adult: data.adult, hiddenByParent: parentDraft,
    sha256: digest(Buffer.from(content)),
    previewUrl: kind === 'guide' ? `/studio/preview/guides/${id}/` : null,
    url: data.draft || parentDraft ? null : `/${kind === 'episode' ? 'releases' : kind === 'guide' ? 'guides' : 'anime'}/${id}/` };
}

export async function parseMediaUpload(bytes, contentType) {
  if (bytes.length > 26_000_000) throw Object.assign(new Error('Media upload exceeds 26 MB including form data.'), { status: 413 });
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw Object.assign(new Error('Choose a file through the upload control.'), { status: 415 });
  let form;
  try { form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes }).formData(); }
  catch { throw Object.assign(new Error('The uploaded form could not be read.'), { status: 400 }); }
  const keys = [...form.keys()];
  const file = form.get('file'); const audience = form.get('audience');
  if (keys.length !== 3 || ['file', 'audience', 'post'].some((key) => keys.filter((item) => item === key).length !== 1) || !(file instanceof File) || !['general', 'adult'].includes(audience) || typeof form.get('post') !== 'string') throw Object.assign(new Error('Choose one media file, its post, and a General or Adult audience.'), { status: 422 });
  let post;
  try { post = validatePost(JSON.parse(form.get('post'))); } catch { throw Object.assign(new Error('Enter a title and Content ID before uploading.'), { status: 422 }); }
  if (!post.uploadId || !['anime', 'episodes', 'guides'].includes(post.collection)) throw Object.assign(new Error('Open a post in the local studio before uploading.'), { status: 422 });
  return { bytes: Buffer.from(await file.arrayBuffer()), filename: file.name, audience, post };
}

export function invalidateContentImports(server, root) {
  const id = '\0astro:content-module-imports';
  const generated = path.resolve(root, '.astro', 'content-modules.mjs').replace(/\\/g, '/');
  for (const [name, environment] of Object.entries(server.environments)) {
    // Astro resolves the virtual import to its generated file when it exists.
    // Handle both identities, including cold starts without a generated map.
    const modules = new Set(environment.moduleGraph.getModulesByFile?.(generated) ?? []);
    const virtual = environment.moduleGraph.getModuleById(id);
    if (virtual) modules.add(virtual);
    for (const module of modules) environment.moduleGraph.invalidateModule(module, undefined, Date.now(), true);
    // Astro 7 evaluates content in a separate Vite runner. Clear both caches.
    const cache = environment.runner?.evaluatedModules;
    const evaluated = new Set(cache?.getModulesByFile?.(generated) ?? []);
    const virtualResult = cache?.getModuleById(id);
    if (virtualResult) evaluated.add(virtualResult);
    for (const module of evaluated) cache.invalidateModule(module);
    if (name !== 'client') environment.hot?.send('astro:content-changed', {});
  }
}

async function refreshSavedContent(server, root, file) {
  const imports = path.join(root, '.astro', 'content-modules.mjs');
  const deadline = Date.now() + 5_000;
  // New entries reach the data store before Astro writes their render imports.
  // Refresh after it is written without delaying the studio's save result.
  for (;;) {
    try { if ((await readFile(imports, 'utf8')).includes(JSON.stringify(file))) break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  invalidateContentImports(server, root);
}

export function studioPlugin(root) {
  return {
    name: 'yuuki-local-studio',
    apply: 'serve',
    configureServer(server) {
      const imports = path.join(root, '.astro', 'content-modules.mjs');
      server.watcher.add(imports);
      const onImportsChanged = (file) => { if (path.resolve(file) === path.resolve(imports)) invalidateContentImports(server, root); };
      server.watcher.on('add', onImportsChanged);
      server.watcher.on('change', onImportsChanged);
      server.httpServer?.once('close', () => { server.watcher.off('add', onImportsChanged); server.watcher.off('change', onImportsChanged); });
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const match = /^\/__studio\/save-(anime|episode|guide)$/.exec(pathname);
        const mediaRoute = /^\/__studio\/media-(status|upload|backup-post)$/.exec(pathname);
        const guideRoute = /^\/__studio\/(load|update)-guide$/.exec(pathname);
        if (!match && !mediaRoute && !guideRoute) return next();
        const send = (status, data) => {
          response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          response.end(JSON.stringify(data));
        };
        if (!isLocalRequest(request)) return send(403, { error: 'Publishing is available only from this local studio tab.' });
        if (request.method !== 'POST') return send(405, { error: 'Use POST to save local content.' });
        if (!mediaRoute && !(request.headers['content-type'] ?? '').startsWith('application/json')) return send(415, { error: 'Send a JSON content payload.' });
        try {
          if (mediaRoute?.[1] === 'status') return send(200, await mediaStatus(root));
          const chunks = [];
          let size = 0;
          const limit = mediaRoute ? 26_000_000 : 1_000_000;
          if (Number(request.headers['content-length']) > limit) return send(413, { error: 'The submitted content is too large.' });
          for await (const chunk of request) {
            size += Buffer.byteLength(chunk);
            if (size > limit) return send(413, { error: mediaRoute ? 'Media exceeds the upload limit.' : 'Content exceeds the 1 MB studio limit.' });
            chunks.push(chunk);
          }
          if (mediaRoute?.[1] === 'upload') return send(201, await uploadMedia({ root, ...await parseMediaUpload(Buffer.concat(chunks), request.headers['content-type'] ?? '') }));
          let payload;
          try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { return send(400, { error: 'The submitted JSON could not be read.' }); }
          if (guideRoute?.[1] === 'load') {
            if (!payload || Object.keys(payload).length !== 1 || !Object.hasOwn(payload, 'id')) return send(422, { error: 'Choose a saved guide to load.' });
            return send(200, await loadGuide({ root, id: payload.id }));
          }
          if (mediaRoute?.[1] === 'backup-post') {
            if (!payload || Object.keys(payload).length !== 1 || !payload.post) return send(422, { error: 'Choose the saved post to back up.' });
            const post = validatePost(payload.post);
            if (!['anime', 'episodes', 'guides'].includes(post.collection)) return send(422, { error: 'Choose a studio content collection.' });
            const extension = post.collection === 'guides' ? (await loadGuide({ root, id: post.id })).extension : 'mdx';
            return send(200, await backupPost({ root, post, extension, online: true }));
          }
          const { studioSchemas } = await server.ssrLoadModule('/src/lib/studio-schema.ts');
          const { compile } = await import('@mdx-js/mdx');
          const validateMdx = (body) => compile(body, { jsx: true });
          const saved = guideRoute?.[1] === 'update' ? await updateGuide({ root, payload, schema: studioSchemas.guide, validateMdx }) : await saveContent({ root, kind: match[1], payload, schemas: studioSchemas, validateMdx });
          send(saved.updated ? 200 : 201, saved);
          void refreshSavedContent(server, root, saved.file).catch((error) => server.config.logger.error(`[studio preview] ${error.message}`));
        } catch (error) {
          if (!error.status) server.config.logger.error(`[studio] ${error.message}`);
          send(error.status ?? 500, { error: error.status ? error.message : 'The content could not be saved. Check the local server output.', fields: error.fields });
        }
      });
    },
  };
}
