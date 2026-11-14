import { mkdir, writeFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export async function writeR2Config(root, name, data) {
  const folder = path.join(await realpath(root), '.wrangler');
  let info;
  try { info = await lstat(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!info) { await mkdir(folder); info = await lstat(folder); }
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('R2 configuration must use a real project folder.');
  if (!/^[a-z0-9-]+\.json$/.test(name)) throw new Error('Invalid R2 configuration filename.');
  const file = path.join(folder, name);
  try { const existing = await lstat(file); if (existing.isSymbolicLink() || !existing.isFile()) throw new Error('R2 configuration must not be a link.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}
