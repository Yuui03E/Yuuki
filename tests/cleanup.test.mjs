import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, access, writeFile, symlink, unlink, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

async function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, 'yuuki-cleanup-'));
  const links = [];
  t.after(async () => {
    if (path.dirname(path.resolve(root)) !== parent || !path.basename(root).startsWith('yuuki-cleanup-')) throw new Error('Unsafe test cleanup path.');
    for (const link of links) {
      if (!path.resolve(link).startsWith(root + path.sep)) throw new Error('Unsafe test link path.');
      await unlink(link);
    }
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'scripts'));
  await copyFile(fileURLToPath(new URL('../scripts/clean.mjs', import.meta.url)), path.join(root, 'scripts/clean.mjs'));
  const put = async (relative) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, relative);
  };
  const link = async (relative, destination) => {
    const file = path.join(root, relative);
    await symlink(path.join(root, destination), file, process.platform === 'win32' ? 'junction' : 'dir');
    links.push(file);
  };
  const run = () => spawnSync(process.execPath, ['scripts/clean.mjs'], { cwd: root, encoding: 'utf8' });
  return { root, put, link, run };
}

test('cleanup removes generated output and preserves local masters, tools, and configuration', async (t) => {
  const { root, put, run } = await fixture(t);
  const protectedFiles = ['src/content/anime/post.mdx', 'public/images/local.png', 'media-library/frame.png', 'raw-sources/clip.mkv', 'local-backups/post.mdx', 'publishing.local.json', '.env', '.git/config', 'node_modules/tool/package.json', '.wrangler/config.json'];
  for (const file of protectedFiles) await put(file);
  const generated = ['dist', '.astro', '.npm-cache', 'test-results', 'playwright-report', '.wrangler/logs'];
  for (const folder of generated) await put(`${folder}/generated.txt`);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  for (const folder of generated) await assert.rejects(access(path.join(root, folder)), { code: 'ENOENT' });
  for (const file of protectedFiles) assert.equal(await readFile(path.join(root, file), 'utf8'), file);
  assert.equal(run().status, 0, 'Cleanup can run again when generated folders are absent.');
});

test('a link inside generated output prevents all deletion and cannot reach local posts', async (t) => {
  const { root, put, link, run } = await fixture(t);
  await put('src/content/anime/post.mdx');
  await put('dist/generated.txt');
  await put('.astro/generated.txt');
  await link('dist/content-link', 'src/content');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /linked/);
  for (const file of ['dist/generated.txt', '.astro/generated.txt', 'src/content/anime/post.mdx']) assert.equal(await readFile(path.join(root, file), 'utf8'), file);
});

test('a redirected Wrangler parent is rejected before any generated files are removed', async (t) => {
  const { root, put, link, run } = await fixture(t);
  await put('dist/generated.txt');
  await put('local-backups/logs/private.txt');
  await link('.wrangler', 'local-backups');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /linked/);
  for (const file of ['dist/generated.txt', 'local-backups/logs/private.txt']) assert.equal(await readFile(path.join(root, file), 'utf8'), file);
});
