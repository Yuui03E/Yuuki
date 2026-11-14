import { test, expect } from '@playwright/test';

test('spotlight navigates published releases, loads selected artwork, and keeps a stable size', async ({ page }) => {
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.goto('/');
  const root = page.locator('[data-release-spotlight]');
  const slides = root.locator('[data-spotlight-slide]');
  await expect(root).toHaveAttribute('data-ready', 'true');
  await expect(slides).toHaveCount(4);
  expect(await slides.evaluateAll((items) => items.map((item) => item.getAttribute('data-release-id')))).toEqual(expect.arrayContaining(['frieren-01-av1', 'frieren-02-hevc', 'frieren-01-02-batch', 'encoding-demo-01']));
  await expect(root.locator('[data-spotlight-slide]:not([hidden])')).toHaveCount(1);
  await expect(slides.nth(1).locator('img')).not.toHaveAttribute('src');
  const height = (await root.boundingBox())!.height;
  await root.getByRole('button', { name: 'Next release' }).click();
  await expect(root.locator('[data-spotlight-position]')).toHaveText('02 / 04');
  await expect(slides.nth(1).locator('img')).toHaveAttribute('src', /.+/);
  await expect(slides.nth(0).locator('a')).toBeHidden();
  expect((await root.boundingBox())!.height).toBe(height);
  await page.keyboard.press('End'); await expect(root.locator('[data-spotlight-position]')).toHaveText('04 / 04');
  await page.keyboard.press('ArrowRight'); await expect(root.locator('[data-spotlight-position]')).toHaveText('01 / 04');
  await root.getByRole('button', { name: 'Previous release' }).click(); await expect(root.locator('[data-spotlight-position]')).toHaveText('04 / 04');
  const href = await root.locator('[data-spotlight-slide]:not([hidden]) a').getAttribute('href');
  await root.locator('[data-spotlight-slide]:not([hidden]) a').click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole('heading', { name: 'Download links' })).toBeVisible();
});

test('automatic playback pauses for hover, keyboard focus, and an offscreen spotlight', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.goto('/'); await page.mouse.move(0, 0);
  const root = page.locator('[data-release-spotlight]');
  const position = root.locator('[data-spotlight-position]');
  await expect(root).toHaveAttribute('data-playback', 'playing');
  await page.clock.runFor(7_900); await expect(position).toHaveText('01 / 04');
  await page.clock.runFor(200); await expect(position).toHaveText('02 / 04');
  await expect(root.locator('[data-spotlight-announcement]')).toHaveText('');
  await root.hover(); await expect(root).toHaveAttribute('data-playback', 'paused');
  await page.clock.runFor(20_000); await expect(position).toHaveText('02 / 04');
  await page.mouse.move(0, 0); await expect(root).toHaveAttribute('data-playback', 'playing');
  await root.getByRole('button', { name: 'Next release' }).focus();
  await expect(root).toHaveAttribute('data-playback', 'paused');
  await page.clock.runFor(16_000); await expect(position).toHaveText('02 / 04');
  await page.getByRole('button', { name: 'Switch color theme' }).focus();
  await expect(root).toHaveAttribute('data-playback', 'playing');
  await page.locator('[data-appearance] summary').scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-playback', 'paused');
  await page.clock.runFor(20_000); await expect(position).toHaveText('02 / 04');
  await root.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
  await expect(root).toHaveAttribute('data-playback', 'playing');
  await page.clock.runFor(8_100); await expect(position).toHaveText('03 / 04');
});

test('pause and footer playback choices persist together', async ({ page }) => {
  await page.goto('/'); const root = page.locator('[data-release-spotlight]');
  await root.getByRole('button', { name: 'Pause release slideshow' }).click();
  await expect(root).toHaveAttribute('data-playback', 'manual');
  await page.reload(); await expect(root).toHaveAttribute('data-playback', 'manual');
  await page.locator('[data-appearance] summary').click();
  await expect(page.locator('#appearance-slideshow')).toHaveValue('manual');
  await page.locator('#appearance-slideshow').selectOption('auto');
  await expect(root.getByRole('button', { name: 'Pause release slideshow' })).toBeAttached();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-slideshow', 'auto');
});

test('reduced motion keeps releases manual while preserving navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.install();
  await page.goto('/'); const root = page.locator('[data-release-spotlight]');
  await expect(root).toHaveAttribute('data-playback', 'reduced');
  await expect(root.locator('[data-spotlight-play]')).toBeDisabled();
  await page.clock.runFor(32_000);
  await expect(root.locator('[data-spotlight-position]')).toHaveText('01 / 04');
  await root.getByRole('button', { name: 'Next release' }).click();
  await expect(root.locator('[data-spotlight-position]')).toHaveText('02 / 04');
});

test('without JavaScript the first release stays usable and inactive controls stay hidden', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4322/');
    const root = page.locator('[data-release-spotlight]');
    await expect(root.locator('[data-spotlight-slide]:not([hidden]) a')).toBeVisible();
    await expect(root.locator('[data-spotlight-controls]')).toBeHidden();
    await page.locator('[data-appearance] summary').click();
    await expect(page.locator('[data-appearance-fields]')).toHaveAttribute('disabled');
    await expect(page.locator('#appearance-clock')).toBeDisabled();
    await expect(page.locator('[data-local-clock]')).toBeHidden();
    await root.locator('[data-spotlight-slide]:not([hidden]) a').click();
    await expect(page).toHaveURL(/\/releases\//);
    await expect(page.locator('h1')).toBeVisible();
  } finally { await context.close(); }
});
