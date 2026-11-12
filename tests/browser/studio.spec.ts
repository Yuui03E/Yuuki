import { test, expect } from '@playwright/test';
import { readFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

test('local studio has working tabs, AniList autofill, safe preview, and visible save results', async ({ page }) => {
  await page.route('https://graphql.anilist.co/', (route) => route.fulfill({ json: { data: { Media: { id: 154587, type: 'ANIME', title: { english: 'Frieren test import', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' }, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, status: 'FINISHED', studios: { nodes: [{ name: 'MADHOUSE' }] }, genres: ['Fantasy'], tags: [{ name: 'Magic' }], coverImage: { extraLarge: 'https://example.com/cover.jpg' }, description: '<b>A mage</b><br>on a journey.' } } } }));
  await page.goto('http://127.0.0.1:4321/studio/'); await expect(page.locator('[data-studio]')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-anilist-query]').fill('https://anilist.co/anime/154587/'); await page.locator('[data-anilist-search]').click(); await page.getByRole('button', { name: /Frieren test import/ }).click();
  const anime = page.locator('[data-studio-form="anime"]'); await expect(anime.locator('[name="title"]')).toHaveValue('Frieren test import'); await expect(anime.locator('[name="studios"]')).toHaveValue('MADHOUSE'); await expect(anime.locator('[name="synopsis"]')).toHaveValue('A mage\non a journey.');
  await page.getByRole('tab', { name: /Tutorial guide/ }).click();
  await page.locator('[data-guide-editor]').fill('## Preview heading\n\n<img src="x" onerror="alert(1)">'); await expect(page.locator('[data-guide-preview] h2')).toHaveText('Preview heading'); await expect(page.locator('[data-guide-preview] img')).not.toHaveAttribute('onerror');
  await page.getByRole('tab', { name: /Episode \/ Batch/ }).click();
  const form = page.locator('[data-studio-form="episode"]'); await form.locator('[name="anime"]').selectOption('frieren'); await form.locator('[name="episodeNumber"]').fill('01'); await form.locator('[name="slug"]').fill('frieren-01-av1');
  await form.locator('[data-repeater="downloads"] [data-add-row]').click(); await expect(form.locator('[data-rows] .repeat-row')).toHaveCount(1); await form.locator('[data-remove-row]').click(); await expect(form.locator('[data-rows] .repeat-row')).toHaveCount(0);
  const before = await readFile(resolve('src/content/episodes/frieren-01-av1.mdx'), 'utf8');
  await form.getByRole('button', { name: 'Save to Local Content' }).click(); await expect(form.locator('[data-save-result]')).toContainText('already exists');
  expect(await readFile(resolve('src/content/episodes/frieren-01-av1.mdx'), 'utf8')).toBe(before);
  await page.getByRole('tab', { name: /Tutorial guide/ }).click();
  await page.screenshot({ path: 'test-results/studio-guide.png', fullPage: true });
});
test('live publishing middleware rejects unsafe requests and invalid input', async ({ request }) => {
  const url = 'http://127.0.0.1:4321/__studio/save-anime';
  const data = { data: { title: 'Invalid' } };
  expect((await request.post(url, { data })).status()).toBe(403);
  expect((await request.post(url, { data, headers: { Origin: 'https://evil.example' } })).status()).toBe(403);
  expect((await request.post(url, { data, headers: { Origin: 'http://127.0.0.1:4321' } })).status()).toBe(422);
  expect((await request.get(url, { headers: { Origin: 'http://127.0.0.1:4321' } })).status()).toBe(405);
  expect((await request.post(url, { data: 'text', headers: { Origin: 'http://127.0.0.1:4321', 'Content-Type': 'text/plain' } })).status()).toBe(415);
  expect((await request.post(url, { data: Buffer.from('{'), headers: { Origin: 'http://127.0.0.1:4321', 'Content-Type': 'application/json' } })).status()).toBe(400);
  expect((await request.post(url, { data: Buffer.from('x'.repeat(1_000_001)), headers: { Origin: 'http://127.0.0.1:4321', 'Content-Type': 'application/json' } })).status()).toBe(413);
});
test('production has a redirect and no publishing endpoint', async ({ page, request }) => {
  await page.goto('/studio/'); await expect(page).toHaveURL('http://127.0.0.1:4322/'); await expect(page.locator('[data-studio]')).toHaveCount(0);
  expect((await request.post('http://127.0.0.1:4322/__studio/save-anime', { data: {} })).status()).toBe(404);
});

test('saving a draft through the studio writes validated MDX and hides it from search', async ({ page }) => {
  const id = `qa-studio-${randomUUID()}`;
  const destination = resolve('src/content/guides', `${id}.mdx`);
  if (dirname(destination) !== resolve('src/content/guides')) throw new Error('Invalid test fixture path.');
  try {
    await page.goto('http://127.0.0.1:4321/studio/');
    await page.getByRole('tab', { name: /Tutorial guide/ }).click();
    const form = page.locator('[data-studio-form="guide"]');
    await form.locator('[name="title"]').fill(id); await form.locator('[name="slug"]').fill(id);
    await form.locator('[name="description"]').fill('Temporary studio validation fixture.');
    await form.locator('[name="body"]').fill('## Saved heading\n\nA complete local publishing check.');
    await form.locator('[name="draft"]').check();
    await form.getByRole('button', { name: 'Save to Local Content' }).click();
    await expect(form.locator('[data-save-result]')).toContainText('as a draft.');
    expect(await readFile(destination, 'utf8')).toContain('## Saved heading');
    const items = await page.request.get('http://127.0.0.1:4321/search-index.json').then((response) => response.text());
    expect(items).not.toContain(id);
  } finally { await unlink(destination).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; }); }
});
