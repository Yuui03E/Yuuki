import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { uploadMedia, validateCatalog } from './media-library.mjs';
import { backupPost } from './post-backups.mjs';
import { safeDirectory, safeRead, atomicWrite, digest, fail, withMediaLock } from './media-files.mjs';
import { parseMediaKey, validatePost } from '../src/lib/media-paths.mjs';

export async function readPosts(root) {
  const posts = [];
  for (const collection of ['anime', 'episodes', 'guides', 'progress', 'benchmarks']) {
    const folder = await safeDirectory(root, ['src', 'content', collection]);
    if (!folder) continue;
    for (const name of await readdir(folder)) {
      const match = /^(.*)\.(mdx?|json)$/.exec(name); if (!match) continue;
      const file = path.join(folder, name); const bytes = await safeRead(file, 1_000_000);
      const text = bytes.toString('utf8');
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
      const data = match[2] === 'json' ? JSON.parse(text) : frontmatter ? parse(frontmatter[1]) : {};
      const post = validatePost({ collection, id: match[1], title: data.title || match[1] });
      posts.push({ post, extension: match[2], file, bytes, data, body: frontmatter ? text.slice(frontmatter[0].length) : text });
    }
  }
  return posts;
}

const strings = (value) => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const replaceUrls = (value, replacements) => {
  if (typeof value === 'string') {
    for (const [oldUrl, newUrl] of replacements) value = value.split(oldUrl).join(newUrl);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceUrls(entry, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceUrls(entry, replacements)]));
  return value;
};

async function markGrouped(root, oldKey, newKey) {
  await withMediaLock(root, async () => {
    const folder = await safeDirectory(root, ['media-library']);
    const file = path.join(folder, 'catalog.json');
    const catalog = validateCatalog(JSON.parse(await safeRead(file)));
    const asset = catalog.assets.find((entry) => entry.key === oldKey);
    if (!asset) throw fail('Migration source disappeared from the catalog.');
    asset.groupedKeys = [...new Set([...(asset.groupedKeys || []), newKey])];
    await atomicWrite(file, `${JSON.stringify(catalog, null, 2)}\n`);
  });
}

export async function organizeMedia({ root, apply = false, tool, fetcher }) {
  const library = await safeDirectory(root, ['media-library']);
  const catalog = library ? validateCatalog(JSON.parse(await safeRead(path.join(library, 'catalog.json')))) : { assets: [] };
  const posts = await readPosts(root);
  const legacy = catalog.assets.filter((asset) => !parseMediaKey(asset.key).collection);
  const plan = [];
  for (const record of posts) {
    const values = [...strings(record.data), record.body];
    const assets = legacy.filter((asset) => asset.url && values.some((value) => value.includes(asset.url)));
    if (assets.length) plan.push({ record, assets });
  }
  const referenced = new Set(plan.flatMap(({ assets }) => assets.map((asset) => asset.key)));
  const unassigned = legacy.filter((asset) => !referenced.has(asset.key) && !asset.groupedKeys?.length);
  const result = { posts: posts.length, mediaGroups: plan.map(({ record, assets }) => ({ collection: record.post.collection, id: record.post.id, assets: assets.length })), unassigned: unassigned.length };
  if (!apply) return result;
  const upload = async (asset, post) => {
    const parsed = parseMediaKey(asset.key);
    const objects = await safeDirectory(root, ['media-library', 'objects']);
    if (!objects) throw fail('Legacy originals are missing. Nothing was deleted.');
    const bytes = await safeRead(path.join(objects, `${asset.sha256}.${parsed.extension}`), asset.size);
    if (bytes.length !== asset.size || digest(bytes) !== asset.sha256) throw fail('Legacy original failed its hash check. It was preserved.', 409);
    const uploaded = await uploadMedia({ root, bytes, filename: asset.filename, audience: asset.audience, post, allowExistingPost: true, tool, fetcher });
    if (!uploaded.onlineCatalogBackedUp) throw fail('Media copied and verified, but its private online manifest needs repair. Retry migration.', 502);
    await markGrouped(root, asset.key, new URL(uploaded.url).pathname.slice(1));
    return uploaded.url;
  };
  for (const { record, assets } of plan) {
    await backupPost({ root, post: record.post, extension: record.extension });
    const replacements = new Map();
    for (const asset of assets) replacements.set(asset.url, await upload(asset, record.post));
    if (digest(await safeRead(record.file)) !== digest(record.bytes)) throw fail('A post changed during migration. Its edits were preserved; retry migration.', 409);
    const data = replaceUrls(record.data, replacements); const body = replaceUrls(record.body, replacements);
    const updated = record.extension === 'json' ? `${JSON.stringify(data, null, 2)}\n` : `---\n${stringify(data, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n${body}`;
    await atomicWrite(record.file, updated);
    await backupPost({ root, post: record.post, extension: record.extension, online: true, tool });
  }
  for (const asset of unassigned) {
    const id = asset.filename === 'yuuki-connection-test.png' ? 'connection-test' : `upload-${asset.sha256.slice(0, 12)}`;
    await upload(asset, { collection: 'unassigned', id, title: asset.filename || 'Unassigned upload' });
  }
  // Include every existing source and its metadata, even posts with external media.
  for (const record of await readPosts(root)) await backupPost({ root, post: record.post, extension: record.extension, online: true, tool });
  return { ...result, applied: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => !['--check', '--apply', '--backup-only'].includes(arg))) throw fail('Use --check, --apply, or --backup-only.');
    const root = fileURLToPath(new URL('../', import.meta.url));
    if (process.argv.includes('--backup-only')) {
      const posts = await readPosts(root);
      for (const record of posts) await backupPost({ root, post: record.post, extension: record.extension, online: true });
      console.log(`Backed up ${posts.length} post sources and manifests privately to R2. External media is referenced, not downloaded.`);
    } else console.log(JSON.stringify(await organizeMedia({ root, apply: process.argv.includes('--apply') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
