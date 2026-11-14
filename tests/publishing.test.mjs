import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { seedDemo } from '../scripts/seed-demo.mjs';
import { assertLocalBuild } from '../scripts/build-local.mjs';
import { checkRepository } from '../scripts/check-repository.mjs';
import { checkOutput, publishSite, publishSettings } from '../scripts/publish-site.mjs';

async function fixture(t, published = true) {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, 'yuuki-publishing-'));
  t.after(async () => {
    if (path.dirname(path.resolve(root)) !== parent || !path.basename(root).startsWith('yuuki-publishing-')) throw new Error('Unsafe test cleanup path.');
    await rm(root, { recursive: true, force: true });
  });
  assert.equal(spawnSync('git', ['init', '--quiet'], { cwd: root }).status, 0);
  if (published) {
    await mkdir(path.join(root, 'src/content/anime'), { recursive: true });
    await writeFile(path.join(root, 'src/content/anime/series.mdx'), '---\ntitle: Safe fixture\ndraft: false\n---\n');
  }
  return root;
}

test('code-only boundary rejects real records even when forcibly staged', async (t) => {
  const root = await fixture(t);
  assert.equal(checkRepository(root), 0);
  assert.equal(spawnSync('git', ['add', 'src/content/anime/series.mdx'], { cwd: root }).status, 0);
  assert.throws(() => checkRepository(root), /local content/);
});

test('demo import preserves existing records and rejects linked folders', async (t) => {
  const root = await fixture(t);
  const original = await readFile(path.join(root, 'src/content/anime/series.mdx'), 'utf8');
  await assert.rejects(seedDemo(root), /already exists/);
  assert.equal(await readFile(path.join(root, 'src/content/anime/series.mdx'), 'utf8'), original);
  const empty = await fixture(t, false);
  await mkdir(path.join(empty, 'src/content'), { recursive: true });
  await mkdir(path.join(empty, 'outside'));
  await symlink(path.join(empty, 'outside'), path.join(empty, 'src/content/anime'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(seedDemo(empty), /real directories/);
  assert.deepEqual(await readdir(path.join(empty, 'outside')), []);
});

test('a fresh code-only checkout can import safe demos without copying media', async (t) => {
  const root = await fixture(t, false);
  await mkdir(path.join(root, 'examples/content/anime'), { recursive: true });
  await writeFile(path.join(root, 'examples/content/anime/demo.mdx'), '---\ntitle: Safe example\n---\n');
  assert.equal(await seedDemo(root), 1);
  assert.match(await readFile(path.join(root, 'src/content/anime/demo.mdx'), 'utf8'), /Safe example/);
  await assertLocalBuild(root, {});
});

test('build guard rejects hosted builds, empty archives and children of draft series', async (t) => {
  const root = await fixture(t, false);
  await assert.rejects(assertLocalBuild(root, { CF_PAGES: '1' }), /built locally/);
  await assert.rejects(assertLocalBuild(root, { GITHUB_ACTIONS: 'true' }), /built locally/);
  await assert.rejects(assertLocalBuild(root, {}), /No published local records/);
  await mkdir(path.join(root, 'src/content/anime'), { recursive: true });
  await mkdir(path.join(root, 'src/content/episodes'), { recursive: true });
  await writeFile(path.join(root, 'src/content/anime/series.mdx'), '---\ntitle: Draft fixture\ndraft: true\n---\n');
  await writeFile(path.join(root, 'src/content/episodes/episode.mdx'), '---\nanime: series\ntitle: Hidden child\ndraft: false\n---\n');
  await assert.rejects(assertLocalBuild(root, {}), /No published local records/);
});

test('publishing stops before upload on check/build failures and check-only mode never uploads', async (t) => {
  const root = await fixture(t);
  const settings = { projectName: 'test-project', productionBranch: 'main' };
  const calls = [];
  const options = { root, settings, tool: async (_root, name) => { calls.push(name); }, output: async () => 1 };
  await assert.rejects(publishSite({ ...options, tool: async () => { throw new Error('check failure'); }, build: async () => { calls.push('build'); } }), /check failure/);
  assert.deepEqual(calls, []);
  await assert.rejects(publishSite({ ...options, build: async () => { throw new Error('build failure'); } }), /build failure/);
  assert.deepEqual(calls, ['astro']);
  calls.length = 0;
  await publishSite({ ...options, checkOnly: true, build: async () => { calls.push('build'); } });
  assert.deepEqual(calls, ['astro', 'build']);
});

test('publishing target validation protects production from an accidental preview deployment', () => {
  const settings = { projectName: 'test-project', productionBranch: 'main' };
  assert.deepEqual(publishSettings(settings, 'review'), { projectName: 'test-project', branch: 'review' });
  assert.throws(() => publishSettings(settings, 'main'), /different from production/);
  assert.throws(() => publishSettings(settings, 'main;other-command'), /valid/);
  assert.throws(() => publishSettings({ ...settings, projectName: 'YOUR_PROJECT' }), /verified/);
  assert.throws(() => publishSettings({ ...settings, accountId: 'YOUR_ACCOUNT_ID' }), /account ID/);
  assert.throws(() => publishSettings({ ...settings, accountId: 123 }), /account ID/);
});

test('publishing uses the verified account for upload while preserving the caller environment', async (t) => {
  const root = await fixture(t);
  const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  t.after(() => { if (previousAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount; });
  process.env.CLOUDFLARE_ACCOUNT_ID = 'b'.repeat(32);
  const calls = [];
  const accountId = 'a'.repeat(32);
  await publishSite({ root, settings: { accountId, projectName: 'test-project', productionBranch: 'main' },
    tool: async (_root, name, args, env) => { calls.push({ name, args, accountId: env?.CLOUDFLARE_ACCOUNT_ID }); },
    build: async () => {}, output: async () => 1 });
  assert.deepEqual(calls.map(({ name }) => name), ['astro', 'wrangler']);
  assert.equal(calls[0].accountId, undefined);
  assert.equal(calls[1].accountId, accountId);
  assert.deepEqual(calls[1].args, ['pages', 'deploy', 'dist', '--project-name', 'test-project', '--branch', 'main', '--commit-dirty=true']);
  assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID, 'b'.repeat(32));
});

test('publish output rejects accidentally copied private source and directory links', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist/index.html'), '<html><body>Safe fixture</body></html>');
  assert.equal(await checkOutput(root), 1);
  await writeFile(path.join(root, 'dist/private.mdx'), 'Private source');
  await assert.rejects(checkOutput(root), /private source/);
  await rm(path.join(root, 'dist/private.mdx'));
  await mkdir(path.join(root, 'outside'));
  await symlink(path.join(root, 'outside'), path.join(root, 'dist/link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkOutput(root), /links/);
});
