import { test, expect, type Page } from '@playwright/test';

async function openAppearance(page: Page) {
  const panel = page.locator('[data-appearance]');
  await expect(panel).toHaveAttribute('data-ready', 'true');
  if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
  return panel;
}

test('footer choices update real pages and survive reloads, navigation, and theme changes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand-word')).toContainText('Yuuki');
  await expect(page.locator('.footer-brand')).toHaveText('Yuuki /');
  const panel = await openAppearance(page);
  await panel.getByText('Modern', { exact: true }).click();
  await panel.getByText('Warm', { exact: true }).click();
  await panel.getByText('Orbit', { exact: true }).click();
  await panel.locator('#appearance-background').press('End');
  await panel.locator('#appearance-grain').press('End');
  await panel.locator('#appearance-clock').selectOption('12h');
  await panel.locator('#appearance-slideshow').selectOption('manual');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'modern');
  await expect(page.locator('html')).toHaveAttribute('data-grain', '100');
  await expect(page.locator('[data-site-backdrop] .orbit')).toBeVisible();
  await expect(panel.locator('[data-grain-output]')).toHaveText('100%');
  await expect(panel.locator('[data-appearance-status]')).toHaveText('Saved in this browser.');
  expect(await page.locator('h1').evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Segoe UI');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-background', 'orbit');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'modern');
  await expect(page.locator('html')).toHaveAttribute('data-text-color', '#eacba2');
  await page.goto('/guides/vapoursynth-source-first/');
  await expect(page.locator('html')).toHaveAttribute('data-grain', '100');
  await expect(page.locator('html')).toHaveAttribute('data-clock', '12h');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-text-color', '#eacba2');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yuuki.appearance.v1')!))).toMatchObject({ font: 'modern', background: 'orbit', grain: 100, backgroundStrength: 100, clock: '12h', slideshow: 'manual' });
  await openAppearance(page);
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-grain', '0');
  await expect(page.locator('html')).toHaveAttribute('data-text-color', 'default');
});

test('custom colors show the effective shade and keep theme switching readable', async ({ page }) => {
  await page.goto('/'); const panel = await openAppearance(page);
  await panel.getByLabel('Custom color').fill('#000000');
  await expect(panel.locator('[data-color-note]')).toBeVisible();
  await expect(panel.locator('[data-effective-color]')).not.toHaveText('#000000');
  await expect(page.locator('html')).toHaveAttribute('data-text-color', '#000000');
  await panel.getByText('Light', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(panel.locator('[data-effective-color]')).toHaveText('#000000');
  await expect(panel.locator('[data-color-note]')).toBeHidden();
  await panel.getByLabel('Custom color').fill('#ffffff');
  await expect(panel.locator('[data-color-note]')).toBeVisible();
  await expect(panel.locator('[data-effective-color]')).not.toHaveText('#ffffff');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-text-color', '#ffffff');
});

test('malformed saved settings fall back safely before controls initialize', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await context.addInitScript(() => {
    localStorage.setItem('yuuki.appearance.v1', JSON.stringify({ font: 'bad', textColor: 'url(https://invalid.test)', background: 'unknown', grain: 999, clock: 'tomorrow', slideshow: 'fast' }));
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'editorial');
  await expect(page.locator('html')).toHaveAttribute('data-background', 'contour');
  await expect(page.locator('html')).toHaveAttribute('data-text-color', 'default');
  await expect(page.locator('html')).toHaveAttribute('data-grain', '100');
  await openAppearance(page);
  expect(errors).toEqual([]);
});

test('blocked browser storage retains choices for the tab and explains the limit', async ({ page, context }) => {
  await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.goto('/'); const panel = await openAppearance(page);
  await panel.getByText('Bookish', { exact: true }).click();
  await panel.getByText('Light', { exact: true }).click();
  await expect(panel.locator('[data-appearance-status]')).toContainText('Saved for this tab');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-font', 'bookish');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('fully blocked storage still allows current-page appearance changes', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await context.addInitScript(() => {
    for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/'); const panel = await openAppearance(page);
  await panel.getByText('Mono', { exact: true }).click();
  await panel.locator('#appearance-grain').press('End');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'mono');
  await expect(page.locator('html')).toHaveAttribute('data-grain', '100');
  await expect(panel.locator('[data-appearance-status]')).toContainText('Applied to this page');
  expect(errors).toEqual([]);
});

test('full persistent storage restores the newer tab choice and keeps its save message accurate', async ({ page, context }) => {
  await context.addInitScript(() => {
    const set = Storage.prototype.setItem;
    if (!sessionStorage.getItem('qa-quota-seeded')) {
      set.call(localStorage, 'yuuki.appearance.v1', JSON.stringify({ font: 'modern', background: 'plain' }));
      set.call(sessionStorage, 'qa-quota-seeded', '1');
    }
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage && key === 'yuuki.appearance.v1') throw new DOMException('Full', 'QuotaExceededError');
      set.call(this, key, value);
    };
  });
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-font', 'modern');
  const panel = await openAppearance(page);
  await panel.getByText('Mono', { exact: true }).click();
  await panel.getByText('Light', { exact: true }).click();
  await expect(panel.locator('[data-appearance-status]')).toContainText('Saved for this tab');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-font', 'mono');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('appearance and theme changes synchronize between open tabs', async ({ page, context }) => {
  await page.goto('/'); const other = await context.newPage();
  try {
    await other.goto('/about/');
    await expect(other.locator('[data-appearance]')).toHaveAttribute('data-ready', 'true');
    const panel = await openAppearance(page);
    await panel.getByText('Mint', { exact: true }).click();
    await panel.getByText('Bookish', { exact: true }).click();
    await panel.getByText('Light', { exact: true }).click();
    await expect(other.locator('html')).toHaveAttribute('data-font', 'bookish');
    await expect(other.locator('html')).toHaveAttribute('data-text-color', '#bce2d3');
    await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.evaluate(() => localStorage.clear());
    await expect(other.locator('html')).toHaveAttribute('data-font', 'editorial');
    await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  } finally { await other.close(); }
});

test('all font profiles and expanded mobile controls fit narrow viewports', async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [320, 360, 760, 810]) {
    await page.setViewportSize({ width, height: 900 });
    for (const font of ['Editorial', 'Modern', 'Bookish', 'Mono']) {
      await page.goto('/'); const panel = await openAppearance(page);
      await panel.getByText(font, { exact: true }).click();
      await panel.getByText('Grid', { exact: true }).click();
      await panel.locator('#appearance-grain').press('End');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px / ${font} / controls`).toBe(true);
      await page.goto('/guides/vapoursynth-source-first/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px / ${font} / guide`).toBe(true);
    }
  }
});

test('grain and background personalization leave comparison pixels unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.goto('/comparisons/');
  const frame = page.locator('[data-frame-compare]').first();
  await frame.focus(); await page.keyboard.press('1');
  await frame.locator('[data-source-image]').evaluate((image) => (image as HTMLImageElement).decode());
  const capture = async () => {
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.locator('[data-source-image]').boundingBox();
    return page.screenshot({ clip: { x: box!.x + box!.width * .2, y: box!.y + box!.height * .35, width: 96, height: 96 }, animations: 'disabled' });
  };
  const before = await capture(); const panel = await openAppearance(page);
  await panel.getByText('Light', { exact: true }).click();
  await panel.getByText('Orbit', { exact: true }).click();
  await panel.locator('#appearance-background').press('End');
  await panel.locator('#appearance-grain').press('End');
  await panel.getByLabel('Custom color').fill('#cc5522');
  const after = await capture();
  expect(after.equals(before)).toBe(true);
  expect(await frame.locator('[data-source-image]').evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const styles = getComputedStyle(node);
      if (styles.filter !== 'none' || Number(styles.opacity) !== 1 || styles.mixBlendMode !== 'normal') return false;
    }
    return true;
  })).toBe(true);
});

test.describe('device clock without a location label', () => {
  test.use({ timezoneId: 'Asia/Tokyo', locale: 'en-US' });
  test('clock formats midnight correctly and updates only when the footer is visible', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-14T15:07:00Z') });
    await page.goto('/'); const panel = await openAppearance(page);
    const clock = page.locator('[data-local-clock]');
    await clock.scrollIntoViewIfNeeded();
    await expect(clock.locator('time')).toHaveText('00:07');
    await expect(clock).toHaveText('00:07');
    await expect(clock).toHaveAttribute('aria-label', 'Current time: 00:07');
    await expect(clock.locator('[title], [data-clock-zone]')).toHaveCount(0);
    expect(await clock.evaluate((element) => element.outerHTML)).not.toMatch(/Tokyo|Asia\/|timeZone/);
    await panel.locator('#appearance-clock').selectOption('12h');
    await clock.scrollIntoViewIfNeeded();
    await expect(clock.locator('time')).toHaveText(/12:07\s*AM/i);
    await page.clock.runFor(60_020);
    await expect(clock.locator('time')).toHaveText(/12:08\s*AM/i);
    await page.locator('h1').scrollIntoViewIfNeeded();
    await expect.poll(() => clock.evaluate((element) => element.getBoundingClientRect().top > innerHeight)).toBe(true);
    await page.clock.runFor(120_020);
    await expect(clock.locator('time')).toHaveText(/12:08\s*AM/i);
    await clock.scrollIntoViewIfNeeded();
    await expect(clock.locator('time')).toHaveText(/12:10\s*AM/i);
    await panel.locator('#appearance-clock').selectOption('off');
    await expect(clock).toBeHidden();
    await page.reload(); await expect(clock).toBeHidden();
  });
});

test('background shuffle changes after five minutes and keeps its timing between pages', async ({ page }) => {
  const start = new Date('2026-11-14T00:00:00Z');
  await page.clock.install({ time: start }); await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.goto('/anime/');
  await expect(page.locator('[data-appearance]')).toHaveAttribute('data-ready', 'true');
  const initial = await page.locator('html').getAttribute('data-background');
  const readSaved = () => page.evaluate(() => JSON.parse(localStorage.getItem('yuuki.appearance.v1')!));
  const changedAt = (await readSaved()).backgroundChangedAt;
  await page.clock.runFor(180_000); await page.goto('/guides/');
  await expect(page.locator('[data-appearance]')).toHaveAttribute('data-ready', 'true');
  expect((await readSaved()).backgroundChangedAt).toBe(changedAt);
  await page.clock.runFor(119_000); await expect(page.locator('html')).toHaveAttribute('data-background', initial!);
  await page.clock.runFor(1_100); await expect(page.locator('html')).not.toHaveAttribute('data-background', initial!);
  const current = await page.locator('html').getAttribute('data-background');
  expect(['contour', 'orbit', 'grid']).toContain(current);
  expect((await readSaved()).backgroundChangedAt).toBeGreaterThan(changedAt);
  expect((await readSaved()).background).toBe(current);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-background', current!);
});

test('turning shuffle off keeps the displayed design, remembers it, and Plain stops shuffle', async ({ page }) => {
  await page.clock.install();
  await page.goto('/anime/'); const panel = await openAppearance(page);
  await panel.getByText('Orbit', { exact: true }).click();
  await panel.getByLabel('Background shuffle').selectOption('off');
  await page.clock.runFor(600_000); await expect(page.locator('html')).toHaveAttribute('data-background', 'orbit');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-background-shuffle', 'off');
  await openAppearance(page); await panel.getByLabel('Background shuffle').selectOption('on');
  await panel.getByText('Plain', { exact: true }).click();
  await expect(panel.getByLabel('Background shuffle')).toHaveValue('off');
  await expect(page.locator('html')).toHaveAttribute('data-background', 'plain');
  await page.clock.runFor(300_100); await expect(page.locator('html')).toHaveAttribute('data-background', 'plain');
});

test('maximum grain shows distinct texture in both themes and its strength follows the slider', async ({ page }) => {
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.goto('/anime/'); const panel = await openAppearance(page);
  await panel.getByText('Plain', { exact: true }).click();
  const texture = async () => {
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
    // This empty margin contains only the canvas, not page content or artwork.
    const png = await page.screenshot({ clip: { x: 16, y: 170, width: 64, height: 180 }, animations: 'disabled' });
    return page.evaluate(async (encoded) => {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, image.width, image.height).data;
      let sum = 0; let squares = 0; const count = data.length / 4;
      for (let index = 0; index < data.length; index += 4) { const gray = (data[index]! + data[index + 1]! + data[index + 2]!) / 3; sum += gray; squares += gray * gray; }
      const mean = sum / count; return { mean, deviation: Math.sqrt(squares / count - mean * mean) };
    }, png.toString('base64'));
  };
  const off = await texture(); expect(off.mean).toBeLessThan(1);
  await panel.locator('#appearance-grain').fill('50');
  await expect.poll(async () => (await texture()).deviation).toBeGreaterThan(5);
  const middle = await texture();
  await panel.locator('#appearance-grain').press('End');
  await expect.poll(async () => (await texture()).deviation).toBeGreaterThan(12);
  const maximum = await texture(); expect(maximum.mean).toBeGreaterThan(middle.mean * 1.7);
  await panel.getByText('Light', { exact: true }).click();
  await expect.poll(async () => (await texture()).deviation).toBeGreaterThan(8);
});
