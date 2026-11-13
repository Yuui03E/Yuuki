import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

export async function runTool(root, name, args, env = process.env) {
  const folder = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
  const binary = path.resolve(folder, typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name]);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { cwd: root, stdio: 'inherit', env: { ...env, ASTRO_TELEMETRY_DISABLED: '1', ...(name === 'wrangler' ? { WRANGLER_LOG_PATH: path.join(root, '.wrangler/logs'), WRANGLER_SEND_METRICS: 'false' } : {}) } });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${name} stopped with exit code ${code}.`)));
  });
}
