import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function checkRepository(root) {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Repository check requires this project’s Git checkout.');
  const files = result.stdout.split('\0').filter(Boolean);
  const unsafe = files.filter((file) =>
    (file.startsWith('src/content/') && !file.endsWith('/.gitkeep')) ||
    /^(dist|\.astro|node_modules|local-backups|media-library|raw-sources|test-results|playwright-report|\.wrangler)\//.test(file) ||
    /(^|\/)\.env[^/]*$/.test(file) || file === 'publishing.local.json' ||
    (file.startsWith('public/images/') && !/^public\/images\/[^/]+\.svg$/.test(file)) ||
    /\.(mkv|mp4|m2ts|webm|flac|wav|opus|aac|7z|zip|rar|iso)$/i.test(file)
  );
  if (unsafe.length) throw new Error(`${unsafe.length} local content, media, secret or generated files are tracked. Remove them from Git tracking without deleting your local originals before pushing.`);
  return files.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Repository boundary passed (${checkRepository(fileURLToPath(new URL('../', import.meta.url)))} tracked code/example files).`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
