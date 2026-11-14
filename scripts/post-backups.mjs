import path from 'node:path';
import { stringify } from 'yaml';
import { validatePost, parseMediaKey } from '../src/lib/media-paths.mjs';
import { safeDirectory, safeRead, atomicWrite, preserveBytes, digest, fail, withMediaLock } from './media-files.mjs';
import { runTool } from './run-tool.mjs';
import { writeR2Config } from './r2-config.mjs';

export async function readPostManifest(root, context) {
  const post = validatePost(context);
  const folder = await safeDirectory(root, ['media-library', 'posts', post.collection, post.id]);
  if (!folder) return null;
  try {
    const manifest = JSON.parse(await safeRead(path.join(folder, 'manifest.json')));
    if (manifest.version !== 1 || manifest.post?.collection !== post.collection || manifest.post?.id !== post.id || !Array.isArray(manifest.assets)) throw fail('The post backup manifest is invalid. Preserve it before continuing.');
    validatePost(manifest.post);
    return manifest;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function writePostManifest({ root, post: context, catalog }) {
  const post = validatePost(context);
  const previous = await readPostManifest(root, post);
  const folder = await safeDirectory(root, ['media-library', 'posts', post.collection, post.id], true);
  const manifest = { ...previous, version: 1, post: { ...previous?.post, ...post }, updatedAt: new Date().toISOString(),
    assets: catalog.assets.filter((asset) => asset.post?.collection === post.collection && asset.post?.id === post.id).map((asset) => {
      const parsed = parseMediaKey(asset.key);
      if (!parsed) throw fail('Invalid post media key.');
      return { key: asset.key, filename: asset.filename, sha256: asset.sha256, size: asset.size, contentType: asset.contentType,
        audience: asset.audience, verified: asset.verified, url: asset.url, localFile: `media/${asset.audience}/${asset.sha256}.${parsed.extension}` };
    }) };
  const file = path.join(folder, 'manifest.json');
  await atomicWrite(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return { folder, file, manifest };
}

export async function uploadPostBackup({ root, post: context, settings, backup, tool = runTool }) {
  const post = validatePost(context);
  const config = await writeR2Config(root, 'r2-upload.json', { account_id: settings.accountId });
  const put = async (key, file, contentType) => {
    await safeRead(file);
    await tool(root, 'wrangler', ['r2', 'object', 'put', `${settings.bucketName}/metadata/posts/${post.collection}/${post.id}/${key}`, '--file', file, '--content-type', contentType, '--cache-control', 'no-store', '--storage-class', 'Standard', '--remote', '--config', config]);
  };
  // Sources are versioned. Their hash is part of the immutable recovery address.
  if (backup.manifest.source) {
    const source = backup.manifest.source;
    if (!/^[a-f0-9]{64}$/.test(source.sha256) || !['md', 'mdx', 'json'].includes(source.extension)) throw fail('Invalid source backup revision.');
    await put(`revisions/${source.sha256}.${source.extension}`, path.join(backup.folder, 'revisions', `${source.sha256}.${source.extension}`), source.extension === 'json' ? 'application/json' : 'text/plain; charset=utf-8');
  }
  await put('manifest.json', backup.file, 'application/json');
}

export async function backupPost({ root, post: context, extension = 'mdx', online = false, tool = runTool }) {
  return withMediaLock(root, async () => {
  const post = validatePost(context);
  if (post.collection === 'unassigned' || !['md', 'mdx', 'json'].includes(extension)) throw fail('Choose an approved content file to back up.');
  const contentFolder = await safeDirectory(root, ['src', 'content', post.collection]);
  if (!contentFolder) throw fail('The post content folder does not exist.');
  const source = await safeRead(path.join(contentFolder, `${post.id}.${extension}`), 1_000_000);
  // Import lazily to keep media upload and source backup initialization independent.
  const { validateCatalog, readMediaSettings } = await import('./media-library.mjs');
  let catalog = { version: 2, assets: [] };
  const library = await safeDirectory(root, ['media-library']);
  if (library) {
    try { catalog = validateCatalog(JSON.parse(await safeRead(path.join(library, 'catalog.json')))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const backup = await writePostManifest({ root, post, catalog });
  const sha256 = digest(source);
  const revisions = await safeDirectory(root, ['media-library', 'posts', post.collection, post.id, 'revisions'], true);
  await preserveBytes(path.join(revisions, `${sha256}.${extension}`), source);
  await atomicWrite(path.join(backup.folder, `post.${extension}`), source);
  backup.manifest.source = { originalFile: `src/content/${post.collection}/${post.id}.${extension}`, localFile: `post.${extension}`, revision: `revisions/${sha256}.${extension}`, sha256, extension };
  await atomicWrite(backup.file, `${JSON.stringify(backup.manifest, null, 2)}\n`);
  // Readable metadata sits beside the source and media on the PC, never under a public R2 path.
  await atomicWrite(path.join(backup.folder, 'README.txt'), `${post.title}\n\nKeep the Content ID (${post.id}) stable when changing the display title.\npost.${extension}: latest source; revisions/: earlier source snapshots.\nmanifest.json: original filenames, local media paths, hashes and online addresses.\nR2 private backup: metadata/posts/${post.collection}/${post.id}/\n${stringify(backup.manifest.source)}`);
  if (online) {
    const settings = await readMediaSettings(root);
    await uploadPostBackup({ root, post, settings, backup, tool });
  }
  return { ok: true, backup: path.relative(root, backup.folder).replace(/\\/g, '/'), sha256, online };
  });
}
