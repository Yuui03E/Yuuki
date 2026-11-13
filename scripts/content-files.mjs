import { lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

export const collectionNames = ['anime', 'episodes', 'guides', 'benchmarks', 'progress'];

async function directory(folder, create = false) {
  let info;
  try { info = await lstat(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!info && create) { await mkdir(folder); info = await lstat(folder); }
  if (!info) return false;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Content folders must be real directories, not links.');
  return true;
}

export async function ensureContentFolders(root) {
  let parent = path.resolve(root);
  for (const segment of ['src', 'content']) { parent = path.join(parent, segment); await directory(parent, true); }
  for (const collection of collectionNames) await directory(path.join(parent, collection), true);
}

export async function contentFiles(root, base = 'src/content') {
  const files = [];
  const taskRoot = path.resolve(root);
  const contentRoot = path.resolve(taskRoot, base);
  if (!contentRoot.startsWith(taskRoot + path.sep)) throw new Error('Content location must stay inside the workspace.');
  let parent = taskRoot;
  for (const segment of path.relative(taskRoot, contentRoot).split(path.sep)) {
    parent = path.join(parent, segment);
    if (!(await directory(parent))) return files;
  }
  async function walk(folder, collection) {
    if (!(await directory(folder))) return;
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Content files must not be links.');
      if (entry.isDirectory()) await walk(file, collection);
      else if (entry.isFile() && (collection === 'benchmarks' ? /\.json$/i : /\.(md|mdx)$/i).test(entry.name)) files.push(file);
    }
  }
  for (const collection of collectionNames) await walk(path.join(contentRoot, collection), collection);
  return files.sort();
}

export async function hasPublishedContent(root) {
  const records = [];
  for (const file of await contentFiles(root)) {
    const text = await readFile(file, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    const data = file.toLowerCase().endsWith('.json') ? JSON.parse(text) : match ? parse(match[1]) : null;
    const relative = path.relative(path.resolve(root, 'src/content'), file).replaceAll('\\', '/');
    const [collection, ...segments] = relative.split('/');
    records.push({ collection, id: segments.join('/').replace(/\.(md|mdx|json)$/i, ''), data });
  }
  const series = new Set(records.filter(({ collection, data }) => collection === 'anime' && data?.draft !== true && data?.title).map(({ id }) => id));
  return records.some(({ collection, data }) => {
    if (!data || data.draft === true) return false;
    if (collection === 'episodes') return series.has(data.anime);
    if (collection === 'progress' && data.relatedAnime && !series.has(data.relatedAnime)) return false;
    return typeof data.title === 'string' && Boolean(data.title.trim());
  });
}
