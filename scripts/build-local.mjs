import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hasPublishedContent } from './content-files.mjs';
import { checkRepository } from './check-repository.mjs';
import { runTool } from './run-tool.mjs';

export async function assertLocalBuild(root, env = process.env) {
  if (env.CF_PAGES === '1' || env.GITHUB_ACTIONS === 'true') throw new Error('This archive is built locally. GitHub contains code and safe examples only. Publish the finished local site directly to Pages; the existing live deployment is preserved.');
  checkRepository(root);
  if (!(await hasPublishedContent(root))) throw new Error('No published local records found. Restore your content backup, or run npm run seed:demo in a new empty checkout. An empty archive will not be published.');
}

export async function buildLocal(root, env = process.env) {
  await assertLocalBuild(root, env);
  await runTool(root, 'astro', ['build'], env);
  await runTool(root, 'pagefind', ['--site', 'dist'], env);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildLocal(fileURLToPath(new URL('../', import.meta.url))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
