# Yuuki

An Astro 7 static anime encoding journal with strict TypeScript, MDX, vanilla CSS, an OLED-black theme, frame comparisons, and a local writing studio.

## Start here

Use Node.js 22.23.4 or newer; `.node-version` selects the checked runtime. Dependencies are already installed in an existing working folder. In a fresh checkout, install them once:

~~~sh
npm ci
~~~

Only in a **new, empty archive**, import the safe examples:

~~~sh
npm run seed:demo
~~~

The importer refuses to replace existing posts. Start the website and studio with:

~~~sh
npm run dev
~~~

- Website: http://127.0.0.1:4321/
- Local studio: http://127.0.0.1:4321/studio/

## Folder guide

| Location | Purpose |
| --- | --- |
| `src/` | Website pages, components, styles, schemas, and local posts |
| `src/content/` | Your five local collections; post files stay out of GitHub |
| `public/` | Favicon and small SVG sample illustrations |
| `examples/content/` | Safe examples for new checkouts and verification |
| `scripts/` | Local writing, building, publishing, and maintenance tools |
| `services/media-worker/` | Read-only R2 media delivery, deployed separately from Pages |
| `media-library/` | Ignored local originals and upload catalog |
| `local-backups/` | Current local handoff; completed reviews are archived in `Yuuki-backups/` beside the project |
| `tests/` | Validation, publishing, and browser checks |
| `docs/` | Development, publishing, and image instructions |
| Root configuration files | Runtime, dependencies, Astro, search, and verification settings |

`AGENTS.md` contains the architectural rules. `node_modules/` contains the installed tools needed for development and stays local. Build output, caches, and test reports are also local and reproducible.

## Keep the folder tidy

Stop any local development or preview servers, then run:

~~~sh
npm run clean
~~~

This removes only build output, generated Astro state, project npm cache, test reports, and Wrangler logs. Posts, images, publishing settings, backups, installed dependencies, and Git history are preserved. The next development run recreates the state it needs; build again before using the production preview.

## What stays synchronized

GitHub and this PC share the same reusable code, configuration, documentation, tests, and safe examples through Git. Your real posts, drafts, image addresses, original media, credentials, installed dependencies, and generated output remain local by design.

Keep an independent backup of `src/content/`, original media, and image-address mappings. Historical snapshots, completed visual reviews, older handoffs, and the old completion report are stored outside this project in the sibling `Yuuki-backups/` folder. That folder is on the same drive and is not an independent backup.

## Checks and next steps

~~~sh
npx astro check && npm run build
~~~

- [Development and Git synchronization](docs/DEVELOPMENT.md)
- [Writing guides, draft previews and optional media](docs/GUIDES.md)
- [Website design and content organization](docs/DESIGN.md)
- [Publishing to the existing Cloudflare Pages site](docs/PUBLISHING.md)
- [R2 account setup, uploads, backups, and costs](docs/R2_SETUP.md)
- [Images and local originals](docs/IMAGES.md)

R2 is connected on this PC. The studio organizes verified uploads by post, backs up sources privately, and remembers adult-content confirmation in the visitor's browser. Guides have a practical reader layout, optional screenshots/videos/comparisons, local draft previews and revision-aware editing. The website shares an editorial OLED-black theme, content-driven homepage, responsive release list, and organized series and guide readers. Direct Pages publication is configured separately from GitHub code synchronization; `npm run publish:site` uploads the complete local build to the verified existing project.
