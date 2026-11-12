import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: { channel: 'msedge', baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:4321', reuseExistingServer: true, env: { ASTRO_TELEMETRY_DISABLED: '1' } },
    { command: 'npm run preview -- --port 4322', url: 'http://127.0.0.1:4322', reuseExistingServer: true, env: { ASTRO_TELEMETRY_DISABLED: '1' } },
  ],
});
