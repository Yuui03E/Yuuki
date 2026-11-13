import { copyFile, mkdir, mkdtemp, symlink, unlink, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkRepository } from './check-repository.mjs';
import { runTool } from './run-tool.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkoutRoot = path.resolve(root);
checkRepository(root);
const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
if (tracked.status !== 0) throw new Error('Cannot inspect the code-only checkout.');
const scratch = await mkdtemp(path.join(root, '.code-only-check-'));
const dependencies = path.join(scratch, 'node_modules');
let linked = false;
try {
  for (const relative of tracked.stdout.split('\0').filter(Boolean)) {
    const target = path.resolve(scratch, relative);
    if (!target.startsWith(path.resolve(scratch) + path.sep)) throw new Error('Invalid verification path.');
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, relative), target);
  }
  if (spawnSync('git', ['init', '--quiet'], { cwd: scratch }).status !== 0) throw new Error('Cannot initialize the isolated code-only check.');
  if (spawnSync('git', ['add', '.'], { cwd: scratch }).status !== 0) throw new Error('Cannot index the isolated code-only check.');
  await symlink(path.join(root, 'node_modules'), dependencies, process.platform === 'win32' ? 'junction' : 'dir');
  linked = true;
  const seed = spawnSync(process.execPath, ['scripts/seed-demo.mjs'], { cwd: scratch, stdio: 'inherit' });
  if (seed.status !== 0) throw new Error('Safe fixture import failed in the code-only checkout.');
  await runTool(scratch, 'astro', ['check']);
  const build = spawnSync(process.execPath, ['scripts/build-local.mjs'], { cwd: scratch, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  if (build.status !== 0) throw new Error('The code-only checkout could not build its safe examples.');
  checkRepository(scratch);
  console.log('Code-only checkout passed: safe demos build without your real content.');
} finally {
  if (path.dirname(path.resolve(scratch)) !== checkoutRoot || !path.basename(scratch).startsWith('.code-only-check-')) throw new Error('Unsafe verification cleanup path.');
  if (linked) await unlink(dependencies);
  await rm(scratch, { recursive: true, force: true });
}
