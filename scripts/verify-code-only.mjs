import { copyFile, mkdir, mkdtemp, symlink, unlink, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkRepository } from './check-repository.mjs';
import { runTool } from './run-tool.mjs';
import { parse, stringify } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkoutRoot = path.resolve(root);
// Include new reusable source before staging, so missing new modules cannot go unnoticed.
checkRepository(root, { includeUntracked: true });
const tracked = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
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
  const buildExamples = () => {
    const build = spawnSync(process.execPath, ['scripts/build-local.mjs'], { cwd: scratch, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
    if (build.status !== 0) throw new Error('The code-only checkout could not build its safe examples.');
  };
  buildExamples();
  checkRepository(scratch);
  // Exercise the slideshow boundaries only in this disposable, seeded checkout.
  // Real local records are never copied here or changed for these scenarios.
  const markDraft = async (collection, filename) => {
    const file = path.resolve(scratch, 'src/content', collection, filename);
    if (path.dirname(file) !== path.resolve(scratch, 'src/content', collection)) throw new Error('Unsafe fixture edit path.');
    const source = await readFile(file, 'utf8');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert.ok(frontmatter, 'Seeded content needs frontmatter.');
    const data = parse(frontmatter[1]); data.draft = true;
    await writeFile(file, `---\n${stringify(data)}---\n${source.slice(frontmatter[0].length)}`);
  };
  const homeSpotlight = async () => {
    const html = await readFile(path.join(scratch, 'dist/index.html'), 'utf8');
    assert.doesNotMatch(html, /data-spotlight-controls|<script[^>]+src="[^"]*SpotlightControls/, 'Single and empty spotlights must not load slideshow controls.');
    return html.split('data-release-spotlight')[1].split('</section>')[0];
  };
  const episodes = (await readdir(path.join(scratch, 'src/content/episodes'))).filter((name) => /\.mdx?$/.test(name)).sort();
  assert.ok(episodes.length > 1);
  for (const filename of episodes.slice(1)) await markDraft('episodes', filename);
  buildExamples();
  const single = await homeSpotlight();
  assert.equal([...single.matchAll(/data-spotlight-slide(?=[\s=>])/g)].length, 1);
  assert.match(single, /href="\/releases\//);
  await markDraft('episodes', episodes[0]);
  buildExamples();
  const seriesFallback = await homeSpotlight();
  assert.match(seriesFallback, /href="\/anime\//);
  assert.doesNotMatch(seriesFallback, /href="\/releases\//);
  for (const filename of (await readdir(path.join(scratch, 'src/content/anime'))).filter((name) => /\.mdx?$/.test(name))) await markDraft('anime', filename);
  buildExamples();
  const empty = await homeSpotlight();
  assert.doesNotMatch(empty, /data-spotlight-slide/);
  assert.match(empty, /The next story starts here/);
  console.log('Code-only checkout passed: safe demos build; single-release, series-fallback and empty spotlights work without slideshow JavaScript.');
} finally {
  if (path.dirname(path.resolve(scratch)) !== checkoutRoot || !path.basename(scratch).startsWith('.code-only-check-')) throw new Error('Unsafe verification cleanup path.');
  if (linked) await unlink(dependencies);
  await rm(scratch, { recursive: true, force: true });
}
