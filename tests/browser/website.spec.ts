import { test, expect } from '@playwright/test';

test('all public pages load with no browser errors or broken local images', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  for (const route of ['/', '/anime/', '/anime/frieren/', '/anime/witch-hat-atelier/', '/anime/encoding-demo/', '/releases/', '/releases/frieren-01-av1/', '/releases/frieren-02-hevc/', '/releases/frieren-01-02-batch/', '/releases/encoding-demo-01/', '/guides/', '/guides/av1-hevc-tuning/', '/guides/vapoursynth-source-first/', '/comparisons/', '/about/']) {
    const response = await page.goto(route); expect(response?.status(), route).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.locator('img[src^="/images/"]').evaluateAll(async (images) => {
      await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
      return images.every((image) => (image as HTMLImageElement).naturalWidth > 0);
    }), route).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('release pills, archive media types, and guide categories combine with search', async ({ page }) => {
  await page.goto('/releases/'); await page.getByRole('button', { name: 'Batch', exact: true }).click();
  await expect(page.locator('[data-release-row]:visible')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search releases' }).fill('missing'); await expect(page.locator('[data-release-empty]')).toBeVisible();
  await page.goto('/anime/'); await page.getByRole('button', { name: 'Manga', exact: true }).click(); await expect(page.locator('[data-archive-card]:visible')).toHaveCount(1); await expect(page.locator('[data-archive-card]:visible')).toContainText('Witch Hat');
  await page.goto('/guides/'); await page.getByRole('button', { name: 'Filtering', exact: true }).click(); await expect(page.locator('[data-guide-card]:visible')).toHaveCount(1);
});
test('Pagefind search works, keyboard navigation opens a guide, and focus restores', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Search the archive (Ctrl+K)' }).focus();
  await page.keyboard.press('Control+k'); await expect(page.locator('#command-palette')).toBeVisible();
  await page.locator('#global-search').fill('VapourSynth'); await expect(page.locator('#search-results a')).not.toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Search the archive (Ctrl+K)' })).toBeFocused();
  await page.keyboard.press('/'); await page.locator('#global-search').fill('source-first');
  await expect(page.locator('#search-results a')).toHaveCount(1);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/guides\/vapoursynth-source-first/);
});
test('frame inspection supports keyboard, pointer split, and native pixel dimensions', async ({ page }) => {
  await page.goto('/comparisons/');
  const frame = page.locator('[data-frame-compare]').first(); await frame.focus(); await page.keyboard.press('2'); await expect(frame).toHaveAttribute('data-frame', 'encode'); await expect(frame).toHaveAttribute('data-mode', 'toggle');
  await page.keyboard.press('ArrowLeft'); await expect(frame).toHaveAttribute('data-frame', 'source');
  await frame.getByRole('button', { name: '1:1 Native Pixel', exact: true }).click();
  await expect(frame.locator('[data-source-image]')).toHaveJSProperty('naturalWidth', 1920);
  expect(await frame.locator('[data-compare-stage]').evaluate((element) => element.getBoundingClientRect().width)).toBe(1920);
  await frame.getByRole('button', { name: '1:1 Native Pixel', exact: true }).click();
  await frame.getByRole('button', { name: 'Split', exact: true }).click();
  const box = await frame.locator('[data-compare-stage]').boundingBox(); const handle = await frame.locator('[data-split-handle]').boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2); await page.mouse.down(); await page.mouse.move(box!.x + box!.width * .7, handle!.y + handle!.height / 2); await page.mouse.up();
  await expect(frame.locator('[data-split-range]')).toHaveValue('70');
  await frame.locator('[data-split-range]').focus(); await page.keyboard.press('ArrowRight'); await expect(frame.locator('[data-split-range]')).toHaveValue('71');
});
test('lightbox, copy controls, guide TOC, and metric switches work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/releases/frieren-01-av1/'); await page.getByRole('button', { name: 'Copy Encoder parameters' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('SvtAv1EncApp');
  await page.getByRole('button', { name: 'View full-size: Observatory at night' }).click(); await expect(page.locator('.lightbox')).toBeVisible(); await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-lightbox-caption]')).toContainText('Lineart detail'); await page.keyboard.press('Escape');
  await page.goto('/guides/vapoursynth-source-first/'); await page.getByRole('link', { name: 'Review at native pixels', exact: true }).last().click(); await expect(page).toHaveURL(/#review-at-native-pixels$/);
  await expect(page.getByRole('button', { name: 'Copy code block 1' })).toBeAttached();
  await page.screenshot({ path: 'test-results/guide-reader.png', fullPage: true });
  await page.goto('/comparisons/'); await page.locator('[data-metric-select]').selectOption('butteraugli'); await expect(page.locator('[data-metric-help]')).toContainText('Lower Butteraugli'); await page.locator('[data-axis-select]').selectOption('crf'); await expect(page.locator('canvas')).toHaveAttribute('aria-label', /against CRF/);
  await page.screenshot({ path: 'test-results/comparisons.png', fullPage: true });
});
test('theme persists and mobile pages stay within their viewport', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Switch color theme' }).click(); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/anime/', '/anime/frieren/', '/anime/encoding-demo/', '/releases/', '/releases/frieren-01-av1/', '/releases/encoding-demo-01/', '/guides/', '/guides/vapoursynth-source-first/', '/comparisons/', '/about/', 'http://127.0.0.1:4321/studio/']) {
    await page.goto(route); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
  }
  await page.goto('/'); await page.getByLabel('Open navigation').click(); await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.getByLabel('Open navigation').click();
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1480, height: 1000 }); await page.goto('/'); await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
});
