# Yuuki

A compact, OLED-black anime and manga archive, static release index, comparison bench, and technical guide library. Built with Astro 7, strict TypeScript, MDX, vanilla CSS, and optional page-specific interactions.

## Run locally

Use Node.js 22.23.4 or newer, as required by the installed Astro release.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4321/ for the website and http://127.0.0.1:4321/studio/ for the local publishing studio. Keep the development server on loopback.

## Author content

The studio has three tabs: Anime / Manga, Episode / Batch, and Tutorial guide. AniList search accepts a title, numeric ID, or AniList URL. Search runs directly in the browser and can be replaced by manual entry when AniList is unavailable. Review imported archive status and source metadata before saving.

The episode form supports optional technical specifications, dynamic download/audio/subtitle/screenshot/comparison/changelog rows, and multiline technical blocks. The guide editor previews sanitized Markdown and safe HTML; saved MDX supports custom components and imports. Preview does not execute custom MDX. Treat saved MDX as trusted local source code.

**Save to Local Content** validates the entry and creates a new `.mdx` file in its approved content folder. Content IDs are derived from titles, or from the series, episode, and version. Existing `.md` or `.mdx` files are preserved. Choose a new ID for another version. Edit an existing file directly when you want to revise it.

Drafts, releases whose series is a draft, and activity logs referring to draft series are omitted from public routes and both search indexes. Draft entries remain selectable in the local studio.

## Content folders

| Collection | Location | Format |
| --- | --- | --- |
| Anime and manga | `src/content/anime/` | MD / MDX |
| Episode and batch releases | `src/content/episodes/` | MD / MDX |
| Technical guides | `src/content/guides/` | MD / MDX |
| Benchmark datasets | `src/content/benchmarks/` | JSON |
| Activity logs | `src/content/progress/` | MD / MDX |

Schemas are shared between Astro collections and the studio validator. Every episode technical input is optional. Local illustrations and exported comparison frames belong in `public/images/`. Original video, audio, archives, secrets, dependencies, and generated output are excluded by `.gitignore`; TypeScript source is explicitly retained.

The sample archive includes two series, three releases, two guides, one benchmark, two activity logs, and seven original SVG illustrations. Download links and technical measurements are illustrative. `scripts/seed-demo.mjs` recreates these samples only in an empty content destination; it refuses to overwrite existing files.

## Build and verify

```sh
npx astro check && npm run build
npm test
npm run test:e2e
npm run test:production
```

The build generates `dist/` and a Pagefind index. `/studio/` becomes a simple redirect to `/`; the authoring UI, authoring JavaScript, and write middleware are absent from production. Deploy only `dist/` to a static host. No server adapter is required.

For Cloudflare Pages, connect the GitHub repository and select `main` as the production branch, `npm run build` as the build command, and `dist` as the output directory. Keep the root directory at the repository root. The `.node-version` file selects the verified Node.js runtime. Each push to the connected production branch triggers a new deployment.

Browser checks use an installed Microsoft Edge and start local development and preview servers when needed. They cover public routes, search, filters, keyboard and pointer comparison controls, native dimensions, lightboxes, copy controls, charts, themes, responsive layouts, AniList autofill with a deterministic API fixture, and actual local draft saves. The production audit briefly creates exclusive QA entries, verifies draft exclusion and optional field rendering, removes only its own files, and rebuilds the clean archive.

`npm run verify` runs the complete check suite. If running in a restricted environment that blocks Astro's user-level telemetry configuration, set `ASTRO_TELEMETRY_DISABLED=1` for the command session. This does not alter site behavior.

See `BUILD_REPORT.md` for the completed work, verification results, command ledger, and source file inventory.
