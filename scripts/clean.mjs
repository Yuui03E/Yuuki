import { lstat, readdir, realpath, rm, rmdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const generatedFolders = ['dist', '.astro', '.npm-cache', 'test-results', 'playwright-report', '.wrangler/logs'];

async function inspectTree(folder) {
  const info = await lstat(folder);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Cleanup refuses a linked or non-directory path: ${folder}`);
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error(`Cleanup refuses a linked path: ${file}`);
    if (info.isDirectory()) await inspectTree(file);
    else if (!info.isFile()) throw new Error(`Cleanup refuses a special file: ${file}`);
  }
}

try {
  const targets = [];
  // Validate every target before removing anything; no content folder is eligible.
  for (const relative of generatedFolders) {
    const target = path.resolve(projectRoot, relative);
    if (!target.startsWith(projectRoot + path.sep)) throw new Error('Cleanup target is outside the project.');
    let parent = projectRoot;
    let missing = false;
    for (const segment of relative.split('/')) {
      parent = path.join(parent, segment);
      try {
        const info = await lstat(parent);
        if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Cleanup refuses a linked or non-directory path: ${parent}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        missing = true;
        break;
      }
    }
    if (missing) continue;
    if (await realpath(target) !== target) throw new Error(`Cleanup refuses a redirected path: ${target}`);
    await inspectTree(target);
    targets.push({ relative, target });
  }
  for (const { relative, target } of targets) {
    await rm(target, { recursive: true });
    console.log(`Removed generated files: ${relative}/`);
  }
  const wrangler = path.join(projectRoot, '.wrangler');
  try {
    const info = await lstat(wrangler);
    if (!info.isSymbolicLink() && info.isDirectory() && !(await readdir(wrangler)).length) await rmdir(wrangler);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log('Cleanup complete. Local posts, media, settings, dependencies, and Git were preserved.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
