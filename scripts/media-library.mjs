import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile, open, rename, unlink, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runTool } from './run-tool.mjs';
import { writeR2Config } from './r2-config.mjs';
import { parseMediaKey, validatePost } from '../src/lib/media-paths.mjs';
import { safeDirectory, safeRead, preserveBytes } from './media-files.mjs';
import { readPostManifest, writePostManifest, uploadPostBackup } from './post-backups.mjs';

const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const maxBudget = 9_000_000_000;

export async function readMediaSettings(root) {
  let settings;
  const file = path.join(root, 'r2.local.json');
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 16_000) throw fail('R2 settings must be a small, unlinked JSON file.');
    settings = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.status) throw error;
    throw fail('R2 setup is required. Follow docs/R2_SETUP.md and create r2.local.json.', 503);
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw fail('R2 settings must contain an object.');
  if (!/^[a-f0-9]{32}$/.test(settings.accountId ?? '') || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(settings.bucketName ?? '') || !/^[a-z][a-z0-9-]{0,62}$/.test(settings.workerName ?? '')) throw fail('Enter the verified Cloudflare account, bucket, and Worker names in r2.local.json.');
  for (const name of ['mediaOrigin', 'publicOrigin']) {
    let url;
    try { url = new URL(settings[name]); } catch { throw fail(`Set a valid ${name} in r2.local.json.`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== settings[name] || /YOUR_|EXAMPLE/i.test(url.hostname)) throw fail(`Set a verified HTTPS ${name} without a path or credentials.`);
  }
  if (!Number.isSafeInteger(settings.storageBudgetBytes) || settings.storageBudgetBytes < 1 || settings.storageBudgetBytes > maxBudget) throw fail('The local media budget must be between 1 byte and 9 GB.');
  return settings;
}

export function mediaType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', contentType: 'image/png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', contentType: 'image/jpeg' };
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return { extension: 'gif', contentType: 'image/gif' };
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return { extension: 'webp', contentType: 'image/webp' };
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString() === 'ftyp') return { extension: 'mp4', contentType: 'video/mp4' };
  if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) && bytes.subarray(0, 4096).includes(Buffer.from('webm'))) return { extension: 'webm', contentType: 'video/webm' };
  throw fail('Choose a PNG, JPG, WebP, GIF, MP4, or WebM file. SVG and executable uploads are not accepted.');
}

async function libraryDirectory(root, create = false) {
  let folder = await realpath(root);
  for (const segment of ['media-library', 'objects']) {
    folder = path.join(folder, segment);
    let info;
    try { info = await lstat(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!info && create) { await mkdir(folder); info = await lstat(folder); }
    if (!info) return null;
    if (!info.isDirectory() || info.isSymbolicLink()) throw fail('Media backups must use real folders inside the project.');
  }
  return folder;
}

export function validateCatalog(data) {
  if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.assets) || data.assets.length > 20_000) throw fail('Media catalog is invalid. Restore its backup before uploading.');
  const keys = new Set();
  let size = 0;
  for (const asset of data.assets) {
    const match = parseMediaKey(asset.key);
    if (!match || asset.sha256 !== match.sha256 || asset.audience !== match.audience || asset.contentType !== match.contentType || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > (asset.contentType.startsWith('image/') ? 10_000_000 : 25_000_000) || typeof asset.verified !== 'boolean' || keys.has(asset.key)) throw fail('Media catalog is invalid. Restore its backup before uploading.');
    if (match.collection) {
      const post = validatePost(asset.post);
      if (data.version !== 2 || post.collection !== match.collection || post.id !== match.id) throw fail('Media catalog post identity is invalid.');
    } else if (asset.post) throw fail('Legacy media cannot contain a grouped post identity.');
    keys.add(asset.key); size += asset.size;
  }
  if (!Number.isSafeInteger(size)) throw fail('Media catalog size is invalid.');
  return data;
}

async function readCatalog(folder) {
  const file = path.join(path.dirname(folder), 'catalog.json');
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 20_000_000) throw fail('Media catalog must be a small, unlinked file.');
    const data = JSON.parse(await readFile(file, 'utf8'));
    return validateCatalog(data);
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, assets: [] };
    if (error.status) throw error;
    throw fail('Media catalog is invalid. Restore its backup before uploading.');
  }
}

async function saveCatalog(folder, catalog) {
  const parent = path.dirname(folder);
  const destination = path.join(parent, 'catalog.json');
  try { if ((await lstat(destination)).isSymbolicLink()) throw fail('Media catalog must not be a link.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(parent, `.catalog-${randomUUID()}.json`);
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
  try { await rename(temporary, destination); }
  finally { await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
}

async function verifyResponse(response, sha256, size) {
  if (response.status !== 200 || response.headers.get('X-Yuuki-Media') !== '1' || !response.body) {
    await response.body?.cancel();
    throw fail('The media service did not return the expected uploaded file.', 502);
  }
  const hash = createHash('sha256');
  let count = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      count += value.byteLength;
      if (count > size) throw fail('Remote media differs from the local original. Existing objects were not overwritten.', 409);
      hash.update(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (count !== size || hash.digest('hex') !== sha256) throw fail('Remote media differs from the local original. Existing objects were not overwritten.', 409);
}

export async function mediaStatus(root) {
  const folder = await libraryDirectory(root);
  const catalog = folder ? await readCatalog(folder) : { version: 1, assets: [] };
  let settings;
  try { settings = await readMediaSettings(root); } catch (error) { return { configured: false, message: error.message, storedBytes: catalog.assets.reduce((sum, asset) => sum + asset.size, 0), budgetBytes: maxBudget, assets: catalog.assets.length }; }
  return { configured: true, message: 'R2 settings loaded. Uploads require the deployed media Worker and Cloudflare sign-in.', storedBytes: catalog.assets.reduce((sum, asset) => sum + asset.size, 0), budgetBytes: settings.storageBudgetBytes, assets: catalog.assets.length };
}

export async function uploadMedia({ root, bytes, filename, audience, post: context, allowExistingPost = false, tool = runTool, fetcher = fetch }) {
  const post = validatePost(context);
  if (!allowExistingPost && !post.uploadId) throw fail('Open the local studio to reserve a post folder before uploading.');
  if (!['general', 'adult'].includes(audience)) throw fail('Choose General or Adult for this upload.');
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw fail('Choose a non-empty media file.');
  const type = mediaType(bytes);
  const limit = type.contentType.startsWith('image/') ? 10_000_000 : 25_000_000;
  if (bytes.length > limit) throw fail(type.contentType.startsWith('image/') ? 'Images must be at most 10 MB.' : 'Videos must be at most 25 MB.', 413);
  const settings = await readMediaSettings(root);
  const folder = await libraryDirectory(root, true);
  const lock = path.join(path.dirname(folder), '.upload.lock');
  let handle;
  try { handle = await open(lock, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw fail('Another media upload is running. Try again when it finishes.', 409); throw error; }
  try {
    const catalog = await readCatalog(folder);
    catalog.version = 2;
    if ((catalog.bucketName && catalog.bucketName !== settings.bucketName) || (catalog.accountId && catalog.accountId !== settings.accountId) || (catalog.mediaOrigin && catalog.mediaOrigin !== settings.mediaOrigin)) throw fail('This media catalog belongs to a different R2 setup. Preserve it before changing accounts, buckets, or addresses.');
    const sha256 = digest(bytes);
    const key = `media/${audience}/${post.collection}/${post.id}/${sha256}.${type.extension}`;
    const manifest = await readPostManifest(root, post);
    let editingGuide = false;
    if (!allowExistingPost && post.sourceHash) {
      if (post.collection !== 'guides') throw fail('Load a saved guide before attaching media.');
      const { loadGuide } = await import('./guide-editor.mjs');
      const savedGuide = await loadGuide({ root, id: post.id });
      if (savedGuide.sha256 !== post.sourceHash) throw fail('The guide changed since you loaded it. Reload it before uploading media.', 409);
      editingGuide = true;
    }
    if (!allowExistingPost && !editingGuide && manifest && manifest.post.uploadId !== post.uploadId) throw fail('This post folder is already reserved. Choose a different Content ID; existing media was preserved.', 409);
    if (!allowExistingPost && !editingGuide && post.collection !== 'unassigned') {
      const contentFolder = await safeDirectory(root, ['src', 'content', post.collection]);
      if (contentFolder) for (const extension of ['md', 'mdx', 'json']) {
        try { await safeRead(path.join(contentFolder, `${post.id}.${extension}`)); throw fail('This Content ID already belongs to a saved post. Choose a new ID before uploading.', 409); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    let asset = catalog.assets.find((entry) => entry.key === key);
    const used = catalog.assets.reduce((sum, entry) => sum + entry.size, 0);
    if (used + (asset ? 0 : bytes.length) > settings.storageBudgetBytes) throw fail('This upload would exceed the local R2 media budget. Nothing was uploaded.', 413);
    const groupedFolder = await safeDirectory(root, ['media-library', 'posts', post.collection, post.id, 'media', audience], true);
    const backup = path.join(groupedFolder, `${sha256}.${type.extension}`);
    await preserveBytes(backup, bytes);
    if (!asset) {
      asset = { key, sha256, size: bytes.length, contentType: type.contentType, audience, post,
        filename: path.basename(String(filename)).replace(/[\x00-\x1f]/g, '').slice(0, 200), createdAt: new Date().toISOString(), verified: false };
      catalog.assets.push(asset);
    }
    asset.post = post;
    catalog.bucketName = settings.bucketName;
    catalog.accountId = settings.accountId;
    catalog.mediaOrigin = settings.mediaOrigin;
    await saveCatalog(folder, catalog);
    await writePostManifest({ root, post, catalog });
    const config = await writeR2Config(root, 'r2-upload.json', { account_id: settings.accountId });
    const health = await fetcher(`${settings.mediaOrigin}/health`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    const identity = health.ok ? await health.json() : {};
    if (identity.service !== 'yuuki-media' || identity.version !== 1 || identity.bucketName !== settings.bucketName) throw fail('Deploy the matching media Worker before uploading. Your local backup was preserved.', 503);
    const url = `${settings.mediaOrigin}/${key}`;
    const previous = await fetcher(url, { signal: AbortSignal.timeout(60_000), cache: 'no-store' });
    if (previous.status === 404 && previous.headers.get('X-Yuuki-Media') === '1') {
      await previous.body?.cancel();
      await tool(root, 'wrangler', ['r2', 'object', 'put', `${settings.bucketName}/${key}`, '--file', backup, '--content-type', type.contentType, '--cache-control', 'public, max-age=31536000, immutable', '--storage-class', 'Standard', '--remote', '--config', config]);
      await verifyResponse(await fetcher(url, { signal: AbortSignal.timeout(60_000), cache: 'no-store' }), sha256, bytes.length);
    } else await verifyResponse(previous, sha256, bytes.length);
    asset.verified = true;
    asset.url = url;
    asset.verifiedAt = new Date().toISOString();
    await saveCatalog(folder, catalog);
    const postBackup = await writePostManifest({ root, post, catalog });
    // The online backup catalog is private: the read-only Worker does not serve metadata/ or JSON files.
    const publicCatalog = { version: 2, assets: catalog.assets.map(({ key, sha256, size, contentType, audience, verified, url, post }) => ({ key, sha256, size, contentType, audience, verified, url, post })) };
    const metadata = path.join(path.dirname(folder), 'r2-catalog.json');
    try { if ((await lstat(metadata)).isSymbolicLink()) throw fail('Remote catalog backup must not be a link.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(metadata, `${JSON.stringify(publicCatalog, null, 2)}\n`);
    let onlineCatalogBackedUp = true;
    try { await tool(root, 'wrangler', ['r2', 'object', 'put', `${settings.bucketName}/metadata/catalog.json`, '--file', metadata, '--content-type', 'application/json', '--cache-control', 'no-store', '--storage-class', 'Standard', '--remote', '--config', config]); }
    catch { onlineCatalogBackedUp = false; }
    try { await uploadPostBackup({ root, post, settings, tool, backup: postBackup }); }
    catch { onlineCatalogBackedUp = false; }
    return { ok: true, url, audience, post, contentType: type.contentType, size: bytes.length, sha256, backup: path.relative(root, backup).replace(/\\/g, '/'), storedBytes: catalog.assets.reduce((sum, entry) => sum + entry.size, 0), onlineCatalogBackedUp };
  } catch (error) {
    if (error.status) throw error;
    throw fail('R2 upload could not complete. Your local backup was preserved. Check Cloudflare sign-in and the local server output.', 502);
  } finally { await handle.close(); await unlink(lock); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await mediaStatus(fileURLToPath(new URL('../', import.meta.url))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
