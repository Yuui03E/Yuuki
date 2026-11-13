import { copyFile, constants, lstat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contentFiles, ensureContentFolders } from './content-files.mjs';

export async function seedDemo(root) {
  if ((await contentFiles(root)).length) throw new Error('Local content already exists. Demo import stopped; existing records were preserved.');
  const examples = await contentFiles(root, 'examples/content');
  if (!examples.length) throw new Error('Safe examples are missing.');
  const sourceRoot = path.resolve(root, 'examples/content');
  const targetRoot = path.resolve(root, 'src/content');
  await ensureContentFolders(root);
  const targets = examples.map((source) => ({ source, target: path.resolve(targetRoot, path.relative(sourceRoot, source)) }));
  for (const { target } of targets) {
    if (!target.startsWith(targetRoot + path.sep)) throw new Error('Invalid demo destination.');
    try { await lstat(target); throw new Error('A demo destination already exists. Import stopped.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const { source, target } of targets) {
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target, constants.COPYFILE_EXCL);
  }
  return targets.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Imported ${await seedDemo(fileURLToPath(new URL('../', import.meta.url)))} safe demo records into local content.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
