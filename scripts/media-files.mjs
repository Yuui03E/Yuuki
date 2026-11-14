import { lstat, mkdir, realpath, readFile, writeFile, rename, unlink, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

export const fail = (message, status = 422) => Object.assign(new Error(message), { status });
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function safeDirectory(root, segments, create = false) {
  let folder = await realpath(root);
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || /[\\/:]/.test(segment)) throw fail('Invalid backup folder.');
    folder = path.join(folder, segment);
    let info;
    try { info = await lstat(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!info && create) { await mkdir(folder); info = await lstat(folder); }
    if (!info) return null;
    if (!info.isDirectory() || info.isSymbolicLink()) throw fail('Backups must use real folders inside the project.');
  }
  return folder;
}

export async function safeRead(file, limit = 20_000_000) {
  const info = await lstat(file);
  if (info.isSymbolicLink() || !info.isFile() || info.size > limit) throw fail('Backup files must be regular, unlinked files.');
  return readFile(file);
}

export async function atomicWrite(file, bytes) {
  try { await safeRead(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(path.dirname(file), `.write-${randomUUID()}`);
  await writeFile(temporary, bytes, { flag: 'wx' });
  try { await rename(temporary, file); }
  finally { await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
}

export async function preserveBytes(file, bytes) {
  try { await writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = await safeRead(file, bytes.length);
    if (existing.length !== bytes.length || digest(existing) !== digest(bytes)) throw fail('A backup path contains different data. It was preserved.', 409);
  }
}

export async function withMediaLock(root, action) {
  const folder = await safeDirectory(root, ['media-library'], true);
  const lock = path.join(folder, '.upload.lock');
  let handle;
  try { handle = await open(lock, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw fail('Another media upload or backup is running. Try again when it finishes.', 409); throw error; }
  try { return await action(); }
  finally { await handle.close(); await unlink(lock); }
}
