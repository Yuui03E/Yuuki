import { open, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { slugify } from '../src/lib/media-paths.mjs';
import { isAdult, hasAdultMedia, assertAdultBody } from '../src/lib/audience.mjs';
import { safeDirectory, safeRead, atomicWrite, digest, fail } from './media-files.mjs';
import { backupPost } from './post-backups.mjs';

function guideId(value) {
  if (typeof value !== 'string' || !value || slugify(value) !== value) throw fail('Choose a saved guide with a safe Content ID.');
  return value;
}
export async function loadGuide({ root, id: value }) {
  const id = guideId(value);
  const folder = await safeDirectory(root, ['src', 'content', 'guides']);
  if (!folder) throw fail('The guide folder does not exist.', 404);
  const files = (await readdir(folder)).filter((name) => name === `${id}.mdx` || name === `${id}.md`);
  if (files.length !== 1) throw fail('The saved guide was not found, or its ID is ambiguous.', 404);
  const bytes = await safeRead(path.join(folder, files[0]), 1_000_000);
  const text = bytes.toString('utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw fail('The guide needs valid frontmatter before it can be edited.');
  const data = parse(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail('The guide metadata is invalid.');
  return { ok: true, id, file: `src/content/guides/${files[0]}`, extension: path.extname(files[0]).slice(1), data, body: text.slice(match[0].length), sha256: digest(bytes), previewUrl: `/studio/preview/guides/${id}/` };
}
const serialize = (value) => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(serialize) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, serialize(item)])) : value;

export async function updateGuide({ root, payload, schema, validateMdx }) {
  if (!payload || Object.keys(payload).some((key) => !['id', 'expectedSha256', 'content'].includes(key)) || !/^[a-f0-9]{64}$/.test(payload.expectedSha256 ?? '')) throw fail('Load the saved guide before editing it.');
  const id = guideId(payload.id);
  const result = schema.safeParse(payload.content);
  if (!result.success) throw Object.assign(fail('Please correct the highlighted guide fields.'), { fields: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) });
  if (result.data.slug && result.data.slug !== id) throw fail('An existing guide keeps its Content ID so its media links stay valid.');
  const { data, body } = result.data;
  data.adult = isAdult(data) || hasAdultMedia(body);
  if (data.adult) { try { assertAdultBody(body); } catch (error) { throw fail(error.message); } }
  if (validateMdx) { try { await validateMdx(body); } catch (error) { throw fail(`The guide contains invalid MDX: ${error.message}`); } }
  const library = await safeDirectory(root, ['media-library'], true);
  const lock = path.join(library, `.guide-edit-${id}.lock`);
  let handle;
  try { handle = await open(lock, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw fail('This guide is already being saved. Try again when it finishes.', 409); throw error; }
  try {
    const current = await loadGuide({ root, id });
    if (current.sha256 !== payload.expectedSha256) throw fail('The guide changed since you loaded it. Reload it before saving; the current file was preserved.', 409);
    await backupPost({ root, post: { collection: 'guides', id, title: current.data.title || id }, extension: current.extension });
    const destination = path.join(root, current.file);
    if (digest(await safeRead(destination)) !== payload.expectedSha256) throw fail('The guide changed during saving. Reload it; the current file was preserved.', 409);
    const text = `---\n${stringify(serialize(data), { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${body.trim()}\n`;
    await atomicWrite(destination, text);
    const post = { collection: 'guides', id, title: data.title };
    let localBackup = false;
    try { await backupPost({ root, post, extension: current.extension }); localBackup = true; }
    catch (error) { console.warn(`Guide saved; its latest backup needs repair: ${error.message}`); }
    return { ok: true, updated: true, id, file: current.file, sha256: digest(Buffer.from(text)), post, localBackup, draft: data.draft, adult: data.adult, previewUrl: current.previewUrl, url: data.draft ? null : `/guides/${id}/` };
  } finally { await handle.close(); await unlink(lock); }
}
