import { readFile, readdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildLocal, assertLocalBuild } from './build-local.mjs';
import { runTool } from './run-tool.mjs';

export function publishSettings(settings, previewBranch) {
  if (!settings || !/^[a-z0-9][a-z0-9-]{0,57}$/.test(settings.projectName ?? '')) throw new Error('Set your verified existing Pages project name in publishing.local.json.');
  const validBranch = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(value) && !value.includes('..');
  if (!validBranch(settings.productionBranch)) throw new Error('Set the production branch from your Pages dashboard.');
  if (previewBranch !== undefined && (!validBranch(previewBranch) || previewBranch === settings.productionBranch)) throw new Error('A preview branch must be valid and different from production.');
  return { projectName: settings.projectName, branch: previewBranch ?? settings.productionBranch };
}

export async function checkOutput(root) {
  const output = path.resolve(root, 'dist');
  let count = 0;
  async function walk(folder) {
    const info = await lstat(folder);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Publish output must contain real directories only.');
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isSymbolicLink()) throw new Error('Publish output must not contain links.');
      if (/^(\.env.*|\.git|\.astro|publishing\.local\.json|data-store\.json)$/.test(item.name) || /\.(md|mdx)$/i.test(item.name)) throw new Error('A private source/configuration file was found in publish output.');
      if (item.isDirectory()) await walk(file);
      else if (item.isFile()) {
        if ((await lstat(file)).size > 25 * 1024 * 1024) throw new Error('A generated asset exceeds the Free Pages 25 MiB limit.');
        count++;
      }
    }
  }
  await walk(output);
  if (count > 20_000) throw new Error('Build exceeds the Free Pages 20,000-file limit.');
  if (!(await readFile(path.join(output, 'index.html'), 'utf8')).includes('<html')) throw new Error('The finished homepage is missing.');
  return count;
}

export async function publishSite({ root, settings, previewBranch, checkOnly = false, tool = runTool, build = buildLocal, output = checkOutput }) {
  const target = checkOnly ? null : publishSettings(settings, previewBranch);
  await assertLocalBuild(root);
  await tool(root, 'astro', ['check']);
  await build(root);
  const count = await output(root);
  if (checkOnly) { console.log(`Local publishing checks passed (${count} output files). No upload requested.`); return; }
  await tool(root, 'wrangler', ['pages', 'deploy', 'dist', '--project-name', target.projectName, '--branch', target.branch, '--commit-dirty=true']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const checkOnly = args[0] === '--check' && args.length === 1;
    const previewBranch = args[0] === '--preview' && args.length === 2 ? args[1] : undefined;
    if (args.length && !checkOnly && !previewBranch) throw new Error('Use npm run publish:site, -- --check, or -- --preview BRANCH.');
    const root = fileURLToPath(new URL('../', import.meta.url));
    let settings;
    if (!checkOnly) {
      try { settings = JSON.parse(await readFile(path.join(root, 'publishing.local.json'), 'utf8')); }
      catch { throw new Error('Copy publishing.example.json to publishing.local.json and enter your verified Pages project name and production branch.'); }
    }
    await publishSite({ root, settings, previewBranch, checkOnly });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
