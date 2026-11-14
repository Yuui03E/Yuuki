import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readMediaSettings } from './media-library.mjs';
import { runTool } from './run-tool.mjs';
import { writeR2Config } from './r2-config.mjs';

export function mediaWorkerConfig(root, settings) {
  return { name: settings.workerName, account_id: settings.accountId, main: path.join(root, 'services/media-worker/index.mjs'),
    compatibility_date: '2026-11-13', workers_dev: true,
    vars: { BUCKET_NAME: settings.bucketName, PUBLIC_ORIGINS: `${settings.publicOrigin},http://127.0.0.1:4321,http://127.0.0.1:4322` },
    r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: settings.bucketName }] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use npm run media:deploy, or -- --check.');
  const settings = await readMediaSettings(root);
  if (process.argv.includes('--check')) console.log('Media deployment settings are valid. No upload or deployment requested.');
  else {
    const config = await writeR2Config(root, 'media-worker.json', mediaWorkerConfig(root, settings));
    await runTool(root, 'wrangler', ['deploy', '--config', config]);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
}
