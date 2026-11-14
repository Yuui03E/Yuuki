# Developing Yuuki

Read the root `AGENTS.md` before changing the project. Preserve Astro static output, strict TypeScript, vanilla CSS, nearly zero public JavaScript, optional episode technical fields, draft exclusion, and the loopback-only development studio.

## Where to make changes

| Area | Location |
| --- | --- |
| Pages and routes | `src/pages/` |
| Reusable presentation | `src/components/`, `src/layouts/` |
| Shared design tokens | `src/styles/tokens.css` |
| Content schemas and public visibility | `src/content.config.ts`, `src/lib/` |
| Optional browser interactions | `src/scripts/` |
| Local studio writes and build/publishing tools | `scripts/` |
| Read-only R2 service | `services/media-worker/` |
| Local R2 upload/backup tools | `scripts/media-library.mjs`, `scripts/deploy-media.mjs` |
| Safe examples | `examples/content/`, small SVG assets in `public/` |
| Automated checks | `tests/`, verification tools in `scripts/` |

All five collections are loaded from local files in `src/content/`: anime, episodes, guides, benchmarks, and progress. The studio creates new records and can load and update existing guides with revision checks and source snapshots. Other existing records can be edited locally. Keep original media outside `public/`, because anything in that folder can enter a local build even when ignored by Git. See [guide writing and previews](GUIDES.md).

## Run and verify

~~~sh
npm run dev
npx astro check && npm run build
~~~

On older PowerShell versions, run the check and build on separate lines and continue only if the check succeeds. To avoid user-profile telemetry writes, set `ASTRO_TELEMETRY_DISABLED=1` for the command session.

| Command | Checks |
| --- | --- |
| `npm run check:repo` | Tracked code excludes local posts, media, secrets, and generated files |
| `npm test` | Content validation, write protection, R2 ranges/uploads/backups, adult classification, and publishing boundaries |
| `npm run media:check` | Local R2 configuration and catalog status; no upload |
| `npm run media:deploy -- --check` | R2 deployment settings only; no deployment |
| `npm run media:organize -- --check` | Preview old media grouping without changing files |
| `npm run media:organize -- --apply` | Copy and verify old media into post folders; preserve old links |
| `npm run media:backup` | Refresh all local post snapshots and private online source/manifest backups |
| `npm run test:e2e` | Browser interactions and the local studio using installed Microsoft Edge |
| `npm run test:production` | Draft and adult search exclusion, deferred adult media, production studio exclusion, and missing technical fields |
| `npm run test:code-only` | Tracked code builds with safe examples without real local posts |
| `npm run verify` | Complete verification suite |

Browser checks use ports 4321 and 4322. Code-only verification imports examples into an isolated temporary checkout and reuses installed dependencies. Do not seed examples into an existing authoring archive. Production verification removes its temporary fixtures after checking them.

## Tidy generated files

Stop local development and preview servers before running `npm run clean`. It removes `dist/`, `.astro/`, `.npm-cache/`, `test-results/`, `playwright-report/`, and `.wrangler/logs/`, then removes `.wrangler/` only if empty. It refuses linked folders or files and never targets source, content, media, publishing configuration, backups, dependencies, or Git.

The next development command regenerates Astro state. Run `npm run build` before previewing or publishing. Keep `node_modules/` installed for the next development session; it is useful local tooling and is never committed.

## Synchronize code with GitHub

Git synchronizes tracked source, documentation, configuration, tests, and safe examples. Real post files, media, image addresses, credentials, build output, and installed dependencies remain local. These exclusions are intentional; matching code does not mean uploading every file on the PC.

Before a code push, inspect the changes, run appropriate verification and `npm run check:repo`, and commit the intended files. Push only when requested. Until automatic Cloudflare Git deployments are disabled, begin code-update commit messages with `[CF-Pages-Skip]`. A code push does not publish the local archive.

To bring a completed remote code update onto this PC, start with a clean working tree and use `git pull --ff-only`. A new PC needs its own dependency installation and restored local content/media backup. The demo importer is only for an empty archive without restored posts.

Historical backups, completed visual-review screenshots and scripts, older handoffs, and the old v1 completion report are preserved in the sibling `Yuuki-backups/` folder outside the project. `local-backups/` keeps the current handoff. Archived path references describe the earlier layout. These backups are on the same drive; arrange an independent backup and test restoring a record and frame pair.

See [guide writing](GUIDES.md), [R2 setup](R2_SETUP.md), [publishing](PUBLISHING.md) and [image storage](IMAGES.md).
