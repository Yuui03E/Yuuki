import { test, expect } from '@playwright/test';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('adult release defers media, remembers consent across visits and resets it across tabs', async ({ page, context }) => {
  const id = `qa-adult-browser-${randomUUID()}`;
  const file = path.resolve('src/content/episodes', `${id}.mdx`);
  if (path.dirname(file) !== path.resolve('src/content/episodes')) throw Error('Unsafe fixture path');
  const origin = 'https://media.test'; const image = `${origin}/media/adult/${'a'.repeat(64)}.png`;
  await writeFile(file, `---\nanime: frieren\nepisodeNumber: 96\nreleaseDate: 2026-11-14\nadult: true\nscreenshots:\n  - src: ${image}\ncomparisons:\n  - title: Safe comparison\n    sourceImage: ${image}\n    encodeImage: ${image}\nvideos:\n  - title: Safe clip\n    src: ${origin}/media/adult/${'b'.repeat(64)}.mp4\n    poster: ${image}\n---\n\n## Safe notes\n\nClassification test only.\n`, { flag: 'wx' });
  const requests: string[] = [];
  await page.route('https://media.test/**', (route) => { requests.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nOIAAAAASUVORK5CYII=', 'base64') }); });
  // The existing general parent uses a safe local SVG cover.
  try {
    await page.goto(`http://127.0.0.1:4321/releases/${id}/`);
    await expect(page.locator('[data-adult-gate]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-adult-content]')).toBeHidden();
    await expect(page.locator('[data-adult-content] img[src], [data-adult-content] video[src]')).toHaveCount(0);
    expect(requests).toHaveLength(0); await expect(page).toHaveTitle('Adult area · Yuuki');
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
    await page.locator('[data-adult-confirm]').check(); await page.locator('[data-adult-continue]').click();
    await expect(page.locator('[data-adult-content]')).toBeVisible();
    await expect(page.locator('video')).toHaveAttribute('preload', 'none'); await expect(page.locator('video')).toHaveAttribute('controls', '');
    await expect(page.locator('[data-source-image]')).toHaveAttribute('src', image);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    const compare = page.locator('[data-frame-compare]'); await compare.locator('[data-compare-mode="toggle"]').click();
    await compare.locator('[data-compare-stage]').click({ position: { x: 5, y: 5 }, force: true }); await expect(compare).toHaveAttribute('data-frame', 'encode');
    await compare.focus(); await page.keyboard.press('Space'); await expect(compare).toHaveAttribute('data-frame', 'source');
    await page.goto('http://127.0.0.1:4321/');
    await page.goto(`http://127.0.0.1:4321/releases/${id}/`);
    await expect(page.locator('[data-adult-choice]')).toBeHidden();
    await expect(page.locator('[data-adult-content]')).toBeVisible();
    await page.reload(); await expect(page.locator('[data-adult-choice]')).toBeHidden();
    const other = await context.newPage();
    await other.route('https://media.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('safe fixture') }));
    await other.goto(`http://127.0.0.1:4321/releases/${id}/`);
    await expect(other.locator('[data-adult-choice]')).toBeHidden();
    await page.locator('[data-adult-leave]').click(); await expect(page.locator('[data-adult-content]')).toBeHidden();
    await expect(other.locator('[data-adult-content]')).toBeHidden(); await other.close();
    await expect(page.locator('[data-adult-content] img[src], [data-adult-content] video[src]')).toHaveCount(0);
    requests.length = 0;
    await page.reload(); await expect(page.locator('[data-adult-choice]')).toBeVisible(); expect(requests).toHaveLength(0);
  } finally {
    // Finish the dev server's reload before the next studio test starts typing.
    await page.goto('http://127.0.0.1:4321/studio/');
    const reloaded = page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame(), timeout: 10_000 });
    await unlink(file); await reloaded;
  }
});

test('studio upload controls fill addresses and inherit adult classification without live uploads', async ({ page, request }) => {
  await page.route('**/__studio/media-status', (route) => route.fulfill({ json: { configured: false, message: 'R2 setup is required.', storedBytes: 0, budgetBytes: 9_000_000_000, assets: 0 } }));
  await page.route('**/__studio/media-upload', async (route) => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    const body = route.request().postDataBuffer()!.toString(); expect(body).toContain('"collection":"episodes"'); expect(body).toContain('"id":"swing-out-sisters-01-v1"');
    await route.fulfill({ status: 201, json: { url: `https://media.test/media/adult/${'a'.repeat(64)}.webp`, contentType: 'image/webp', onlineCatalogBackedUp: true } });
  });
  await page.goto('http://127.0.0.1:4321/studio/');
  await expect(page.locator('[data-media-status]')).toContainText('R2 setup is required');
  await page.getByRole('tab', { name: /Episode \/ Batch/ }).click();
  const form = page.locator('[data-studio-form="episode"]'); await form.locator('[name="anime"]').selectOption('swing-out-sisters');
  await form.locator('[name="episodeNumber"]').fill('01');
  await expect(form.locator('[name="adult"]')).toBeChecked();
  await form.locator('[data-repeater="screenshots"] [data-add-row]').click();
  const row = form.locator('[data-repeater="screenshots"] [data-rows]');
  await expect(row.locator('[data-media-upload]')).toHaveCount(1);
  await row.locator('input[type="file"]').setInputFiles({ name: 'safe.webp', mimeType: 'image/webp', buffer: Buffer.from('safe mocked fixture') });
  await expect(row.locator('[data-key="src"]')).toHaveValue(/\/media\/adult\//);
  await expect(row.locator('[role="status"]')).toContainText('online bytes verified');
  await expect(form.locator('[name="slug"]')).toHaveValue('swing-out-sisters-01-v1'); await expect(form.locator('[name="slug"]')).toHaveAttribute('readonly', '');
  const endpoint = 'http://127.0.0.1:4321/__studio/media-upload';
  expect((await request.post(endpoint, { data: {} })).status()).toBe(403);
  expect((await request.post(endpoint, { headers: { Origin: 'http://127.0.0.1:4321' }, data: {} })).status()).toBe(415);
  expect((await request.post(endpoint, { headers: { Origin: 'http://127.0.0.1:4321' }, multipart: { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') }, audience: 'adult' } })).status()).toBe(422);
  expect((await request.post('http://127.0.0.1:4322/__studio/media-upload', { data: {} })).status()).toBe(404);
});

test('adult consent uses tab storage when persistent storage is blocked and safely handles no storage', async ({ page }) => {
  // Exercise the actual gate on the adult index without requesting any remote media.
  await page.route('https://**/*', (route) => route.abort());
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  await page.goto('http://127.0.0.1:4321/adult/');
  await expect(page.locator('[data-adult-choice]')).toBeVisible();
  await page.locator('[data-adult-confirm]').check(); await page.locator('[data-adult-continue]').click();
  await page.reload(); await expect(page.locator('[data-adult-choice]')).toBeHidden();
  await page.locator('[data-adult-leave]').click(); await page.reload(); await expect(page.locator('[data-adult-choice]')).toBeVisible();
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  await page.reload(); await page.locator('[data-adult-confirm]').check(); await page.locator('[data-adult-continue]').click();
  await expect(page.locator('[data-adult-content]')).toBeVisible();
  await page.reload(); await expect(page.locator('[data-adult-choice]')).toBeVisible();
});
