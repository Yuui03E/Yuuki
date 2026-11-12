import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { fileURLToPath } from 'node:url';
import { studioPlugin } from './scripts/studio-server.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  integrations: [mdx()],
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false, wrap: false } },
  vite: { plugins: [studioPlugin(fileURLToPath(new URL('.', import.meta.url)))], server: { strictPort: true } },
});
