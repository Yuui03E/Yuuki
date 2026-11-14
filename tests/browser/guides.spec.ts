import { test, expect } from '@playwright/test';
import { readFile, unlink, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const dev = 'http://127.0.0.1:4321';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nOIAAAAASUVORK5CYII=', 'base64');
test.beforeEach(async ({ page }) => {
  await page.route('**/__studio/media-backup-post', (route) => route.fulfill({ json: { ok: true, online: true } }));
  await page.route('https://media.test/**', (route) => route.fulfill({ contentType: 'image/png', body: image }));
});
async function cleanup(page: import('@playwright/test').Page, id: string) {
  const base = resolve('src/content/guides'); const file = resolve(base, `${id}.mdx`);
  const backupBase = resolve('media-library/posts/guides'); const backup = resolve(backupBase, id);
  if (dirname(file) !== base || dirname(backup) !== backupBase || !/^qa-guide-[a-z0-9-]+$/.test(id)) throw Error('Unsafe fixture path.');
  const reload = page.isClosed() ? null : page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame(), timeout: 5000 }).catch(() => null);
  await unlink(file); await rm(backup, { recursive: true, force: true });
  if (!page.isClosed()) await page.goto(`${dev}/studio/`, { timeout: 5000 }).catch(() => null);
  await reload;
}

test('the real preset draft has six choices, correct copyable commands and a responsive local preview', async ({ page, context, request }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const id = 'x264-x265-anime-presets';
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${dev}/studio/preview/guides/${id}/`);
  await expect(page.locator('h1')).toHaveText('x264 and x265 anime presets: choose, encode, inspect');
  await expect(page.locator('[data-guide-preview-note]')).toContainText('Unpublished draft');
  await expect(page.locator('.preset-card')).toHaveCount(6);
  await expect(page.locator('[data-pagefind-body]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  for (const id of ['guide-screenshots', 'guide-comparisons', 'guide-videos', 'guide-downloads']) await expect(page.locator(`#${id}`)).toHaveCount(0);
  const first = page.locator('.preset-card').first(); await first.locator('summary').click(); await first.getByRole('button', { name: 'Copy Balanced HEVC command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('ffmpeg -n -i "input.mkv" -map 0:v:0');
  const avc = page.locator('.preset-card').filter({ has: page.getByRole('heading', { name: 'Faster 10-bit AVC', exact: true }) });
  await avc.locator('summary').click(); await avc.getByRole('button', { name: 'Copy Faster 10-bit AVC command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('psy-rd=0.70,0.0');
  await page.getByRole('link', { name: 'Reported benchmark results', exact: true }).last().click();
  await expect(page.locator('.guide-body details').first()).toHaveAttribute('open', '');
  await expect(page.locator('.guide-table-scroll')).toHaveCount(1);
  await first.locator('summary').click(); await avc.locator('summary').click();
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: 'test-results/preset-guide-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/preset-guide-mobile.png', fullPage: true });
  expect((await request.get(`${dev}/guides/${id}/`)).status()).toBe(404);
  expect((await request.get(`http://127.0.0.1:4322/studio/preview/guides/${id}/`)).status()).toBe(404);
  expect(await request.get(`${dev}/search-index.json`).then((response) => response.text())).not.toContain(id);
  expect(errors).toEqual([]);
});

test('a guide can be loaded, extended with multiple media items and saved with a source revision', async ({ page, request }) => {
  const id = `qa-guide-browser-${randomUUID()}`; const file = resolve('src/content/guides', `${id}.mdx`);
  const data = { title: id, description: 'Temporary guide validation.', category: 'Encoding', difficulty: 'Intermediate', updatedDate: '2026-11-14', draft: true,
    screenshots: [{ src: '/images/frame-source.svg', caption: 'Source' }, { src: '/images/frame-encode.svg', caption: 'Encode' }],
    comparisons: [{ title: 'First pair', sourceImage: '/images/frame-source.svg', encodeImage: '/images/frame-encode.svg' }],
    videos: [{ title: 'Motion check', src: 'https://media.test/clip.mp4' }] };
  const response = await request.post(`${dev}/__studio/save-guide`, { headers: { Origin: dev }, data: { slug: id, data, body: '## Inspect\n\nMatch the source frames.' } });
  expect(response.status()).toBe(201); const original = await readFile(file);
  try {
    await expect.poll(async () => (await request.get(`${dev}/studio/preview/guides/${id}/`)).status()).toBe(200);
    await page.route('**/__studio/media-upload', (route) => {
      const body = route.request().postDataBuffer()!.toString(); expect(body).toContain('"collection":"guides"'); expect(body).toContain(`"sourceHash":"${hash(original)}"`);
      return route.fulfill({ status: 201, json: { url: `https://media.test/media/general/guides/${id}/${'a'.repeat(64)}.png`, contentType: 'image/png', onlineCatalogBackedUp: true } });
    });
    await page.goto(`${dev}/studio/`); await page.getByRole('tab', { name: /Tutorial guide/ }).click();
    await page.locator('[data-guide-select]').selectOption(id); await page.locator('[data-guide-load]').click();
    const form = page.locator('[data-studio-form="guide"]'); await expect(form.locator('[name="title"]')).toHaveValue(id);
    await expect(form.locator('[data-repeater="screenshots"] .repeat-row')).toHaveCount(2);
    await form.locator('[name="summary"]').fill('Compare lineart and gradients before choosing the final command.');
    await form.locator('[data-repeater="takeaways"] [data-add-row]').click(); await form.locator('[data-repeater="takeaways"] [data-key="value"]').fill('Inspect the same frame');
    await form.locator('[data-repeater="presets"] [data-add-row]').click();
    const preset = form.locator('[data-repeater="presets"] .repeat-row'); await preset.locator('[data-key="title"]').fill('My preset'); await preset.locator('[data-key="goal"]').fill('Test gradients'); await preset.locator('[data-key="tradeoff"]').fill('Inspect time and size'); await preset.locator('[data-key="command"]').fill('ffmpeg -n -i input.mkv output.mkv'); await preset.locator('[data-key="language"]').selectOption('PowerShell');
    await form.locator('[data-repeater="screenshots"] input[type="file"]').first().setInputFiles({ name: 'safe.png', mimeType: 'image/png', buffer: image });
    await expect(form.locator('[data-repeater="screenshots"] [role="status"]').first()).toContainText('online bytes verified');
    await form.locator('[data-repeater="comparisons"] [data-add-row]').click();
    const pair = form.locator('[data-repeater="comparisons"] .repeat-row').last(); await pair.locator('[data-key="title"]').fill('Second pair'); await pair.locator('[data-key="sourceImage"]').fill('/images/frame-source.svg'); await pair.locator('[data-key="encodeImage"]').fill('/images/frame-encode.svg');
    const refreshed = page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() });
    await form.getByRole('button', { name: 'Save guide changes' }).click(); await refreshed;
    await expect(form.locator('[data-save-result]')).toContainText('Saved changes');
    await expect(page.getByRole('tab', { name: /Tutorial guide/ })).toHaveAttribute('aria-selected', 'true');
    await expect(form.locator('[name="summary"]')).toHaveValue('Compare lineart and gradients before choosing the final command.');
    await expect(form.locator('[data-repeater="comparisons"] .repeat-row')).toHaveCount(2);
    const current = await readFile(file); expect(current.toString()).toContain('Second pair'); expect(current.toString()).toContain('PowerShell');
    expect(await readFile(resolve(`media-library/posts/guides/${id}/revisions/${hash(original)}.mdx`))).toEqual(original);
    const stale = await request.post(`${dev}/__studio/update-guide`, { headers: { Origin: dev }, data: { id, expectedSha256: hash(original), content: { data, body: 'Stale edit.' } } }); expect(stale.status()).toBe(409); expect(await readFile(file)).toEqual(current);
    await page.goto(`${dev}/studio/preview/guides/${id}/`);
    await expect(page.locator('[data-gallery-open]')).toHaveCount(2); await expect(page.locator('[data-frame-compare]')).toHaveCount(2); await expect(page.locator('video')).toHaveCount(1); await expect(page.locator('video')).toHaveAttribute('preload', 'none');
    await page.getByRole('button', { name: 'View full-size: Source' }).click(); await expect(page.locator('dialog.lightbox')).toBeVisible(); await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-lightbox-caption]')).toContainText('Encode'); await page.keyboard.press('Escape');
    const compare = page.locator('[data-frame-compare]').last(); await compare.locator('[data-compare-mode="toggle"]').click(); await compare.focus(); await page.keyboard.press('2'); await expect(compare).toHaveAttribute('data-frame', 'encode');
    expect((await request.post('http://127.0.0.1:4322/__studio/update-guide', { data: {} })).status()).toBe(404);
    expect((await request.post(`${dev}/__studio/load-guide`, { data: { id } })).status()).toBe(403);
  } finally { await cleanup(page, id); }
});

test('adult guide screenshots and videos stay deferred and resetting consent closes the lightbox', async ({ page, context }) => {
  const id = `qa-guide-adult-${randomUUID()}`; const file = resolve('src/content/guides', `${id}.mdx`);
  await writeFile(file, `---\ntitle: Safe adult guide fixture\ndescription: Classification test.\ncategory: Encoding\ndifficulty: Beginner\nupdatedDate: 2026-11-14\nadult: true\ndraft: true\nscreenshots:\n  - src: https://media.test/media/adult/${'a'.repeat(64)}.png\n    caption: Safe test image\nvideos:\n  - title: Safe clip\n    src: https://media.test/media/adult/${'b'.repeat(64)}.mp4\n---\n\n<details>\n<summary>Measurements</summary>\n\nSafe text.\n</details>\n`, { flag: 'wx' });
  try {
    const url = `${dev}/studio/preview/guides/${id}/`; await page.goto(url);
    await expect(page.locator('[data-adult-content]')).toBeHidden(); await expect(page.locator('[data-adult-content] img[src], [data-adult-content] video[src]')).toHaveCount(0);
    await page.locator('[data-adult-confirm]').check(); await page.locator('[data-adult-continue]').click();
    await page.getByRole('button', { name: 'View full-size: Safe test image' }).click(); await expect(page.locator('dialog.lightbox')).toBeVisible();
    const other = await context.newPage(); await other.route('https://media.test/**', (route) => route.fulfill({ contentType: 'image/png', body: image })); await other.goto(url); await other.locator('[data-adult-leave]').click();
    await expect(page.locator('dialog.lightbox')).toBeHidden(); await expect(page.locator('[data-adult-content]')).toBeHidden(); await other.close();
  } finally { await cleanup(page, id); }
});
