# Yuuki

An Astro 7 static encoding journal with strict TypeScript, MDX, vanilla CSS, an OLED-black theme, screenshot comparisons and a local publishing studio.

**GitHub holds the reusable application and safe examples. Real posts, metadata, image addresses and drafts stay in local files.** Build the complete site on your PC and upload the finished website directly to Cloudflare Pages. Public images are hosted separately on imgbox.

## Run locally

Use Node.js 22.23.4 or newer. The checked runtime is selected by `.node-version`.

~~~sh
npm ci
~~~

In a **new code-only checkout with no real content**, import the safe examples once:

~~~sh
npm run seed:demo
~~~

The importer refuses to run if any local records already exist. It copies safe examples from `examples/content/` and never replaces your records or images. Existing authoring checkouts should use their local records instead.

~~~sh
npm run dev
~~~

Open http://127.0.0.1:4321/ for the site and http://127.0.0.1:4321/studio/ for the studio. The development server and publishing endpoints stay on loopback.

## Local content

| Collection | Local folder | Format |
| --- | --- | --- |
| Anime and manga | `src/content/anime/` | MD / MDX |
| Releases | `src/content/episodes/` | MD / MDX |
| Guides | `src/content/guides/` | MD / MDX |
| Benchmarks | `src/content/benchmarks/` | JSON |
| Activity logs | `src/content/progress/` | MD / MDX |

These folders are ignored by Git; only their empty `.gitkeep` placeholders are tracked. The application schema `src/content.config.ts` remains tracked.

The studio validates fields and creates a new local MDX file. It never silently replaces an existing file. Edit existing records locally when revising them. Every episode technical input is optional; absent details do not render empty rows. Drafts and children of draft series stay out of public pages and search.

GitHub no longer backs up your real records. Keep a separate backup of all five folders, your original media, and your image-address mapping. The migration snapshot in ignored `local-backups/` is on the same PC and is not protection against drive failure. Previous Git commits can still contain records that were pushed before this separation; this update does not erase Git history.

## Images

Use [imgbox](https://imgbox.com/) for public screenshots. Its help page supports JPG, GIF and PNG up to **10 MB per file** and permits original full-size embedding. Use the supplied full-size image URL, rather than a viewer-page link or thumbnail. Mark explicit uploads as Adult Content and follow the service's terms.

For comparison frames, keep source and encode dimensions equal and use lossless PNG originals. ImgLink was rejected after the user observed automatic compression. Keep local originals and verified image addresses; service retention is not a backup guarantee.

Originals belong outside the repository or in ignored `media-library/`. Raster images and subfolders under `public/images/` are ignored; root-level small SVG illustrations are the tracked examples. An ignored local image is absent from a Git-triggered build.

## Build and check

~~~sh
npx astro check && npm run build
npm test
npm run test:e2e
npm run test:production
npm run test:code-only
~~~

`npm run check:repo` rejects tracked editorial files, media, secrets and generated output. `npm run build` requires published local records and intentionally stops under Cloudflare's Git-build environment or GitHub Actions. This prevents a code-only checkout from replacing the live archive with missing content.

`npm run verify` runs the full suite. The code-only verification imports safe examples into an isolated temporary checkout and builds them without using real local records. It reuses the installed dependencies.

Astro produces `dist/` and Pagefind search data. The studio UI, authoring JavaScript and write endpoints are absent from production. Deploy only reviewed `dist/`. Published text and metadata are readable in public HTML and search data; keeping the editable source local does not make the published values private.

## Publish directly to Cloudflare

Keep the existing Pages project. In its dashboard, open **Build → Branch control**, disable automatic production deployments, and set automatic preview branch deployments to **None**. Existing Git-connected projects support Wrangler uploads; dashboard drag-and-drop is not available for that project type.

The installed Wrangler tool handles uploads. Authenticate once:

~~~sh
npx wrangler login
npx wrangler pages project list
~~~

Copy `publishing.example.json` to ignored `publishing.local.json`. Set the actual existing project name and production branch from Cloudflare. No credentials belong in that file or GitHub.

Check the finished local build without uploading:

~~~sh
npm run publish:site -- --check
~~~

Upload a reviewed preview using a branch different from production:

~~~sh
npm run publish:site -- --preview review
~~~

Publish production explicitly:

~~~sh
npm run publish:site
~~~

The publisher checks the repository boundary, runs Astro checks, builds, inspects output for private source/config files and Pages limits, and then uploads only `dist/`. Failed checks stop before upload. Wrangler logs stay in ignored `.wrangler/`.

Each publication replaces the current asset set, so publish the complete fresh build. Source code pushes and website publication are separate actions. Use the documented `[CF-Pages-Skip]` commit-message prefix when a code update must skip a connected Pages Git deployment; the local-build guard also prevents code-only cloud builds from replacing production.

After upload succeeds, the site works while the PC is off. This workflow does not require R2 billing, a paid domain, hosted CMS, database, SSR or a server adapter.

See [PUBLISHING_ROADMAP.md](PUBLISHING_ROADMAP.md) for implementation status and remaining host setup, and [IMAGE_STORAGE.md](IMAGE_STORAGE.md) for image details. Adult classification, separate adult browsing/search and deliberate image loading are planned before explicit publication; they are not implemented by the code/content migration.
