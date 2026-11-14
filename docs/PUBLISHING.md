# Publishing Yuuki

The workflow is: write locally → upload selected media through the studio to R2 → keep the verified media addresses into your posts → build the complete website on this PC → upload the finished site to the existing Cloudflare Pages project.

GitHub holds reusable code and safe examples. Cloudflare serves the published pages and R2 serves public images and videos while this PC is off. Use R2 Standard and Workers Free as described in [R2 setup](R2_SETUP.md). No database, hosted CMS, paid domain, SSR, or server adapter is needed. R2 activation requires billing details; its free allowance is not a hard spending cap.

## Current status

Local content separation, safe sample import, repository checks, guarded local builds, and the direct publisher are implemented. R2 and its read-only media Worker are connected on this PC. Pages target configuration and a direct website upload remain unfinished. Do not assume the live site matches the current local build.

## One-time Cloudflare setup

1. Open the **existing** Pages project's branch controls. Disable automatic production deployments and set automatic preview branches to **None**. The existing Git-connected project supports Wrangler uploads; do not recreate it.
2. Sign in locally and inspect the project list:

   ~~~sh
   npx wrangler login
   npx wrangler pages project list
   ~~~

3. Copy the root `publishing.example.json` to `publishing.local.json`. Enter the verified existing project name and production branch from Cloudflare. Do not guess the project name from its public address. This file is ignored by Git and contains no credentials.

## Review before uploading

~~~sh
npm run publish:site -- --check
npm run preview -- --port 4322
~~~

Open http://127.0.0.1:4322/. The check command uploads nothing. Review the intended public posts, links, images, comparison frames, and searchable text. Current search includes guide bodies and episode MediaInfo; remove private filenames, paths, or other personal details from intended public records before publication.

Drafts and episodes of draft series stay out of public pages and search. The writing studio, its authoring JavaScript, and write endpoints are development-only. Published text and metadata remain readable to visitors and crawlers even though their editable files are absent from GitHub.

Guide drafts have a full local preview at `/studio/preview/guides/<content-id>/`. These previews are absent from the production build. Review the guide locally before clearing its draft flag; see [guide editing](GUIDES.md).

## Upload when publication is intended

A review preview uses a branch different from production:

~~~sh
npm run publish:site -- --preview review
~~~

Preview addresses can be public; they are not private draft storage. Publish the reviewed production site with:

~~~sh
npm run publish:site
~~~

The publisher checks the repository, runs Astro checks, builds fresh output, validates the asset set, and uploads only `dist/`. Failed checks stop before upload. Each publication replaces the deployed asset set, so always publish the complete fresh local build.

Output checks reject directory links and recognized private source/configuration files, and enforce 20,000 files and 25 MiB per asset. They do not detect every possible private string in generated HTML.

## Code updates and local masters

A GitHub push and a website upload are separate actions. Local builds deliberately stop in Cloudflare Git-build and GitHub Actions environments, where real local posts are unavailable. Keep this guard. Until automatic Git deployments are disabled, use the documented `[CF-Pages-Skip]` commit prefix for code updates.

Keep separate backups of all five local collections, original media, and filename-to-image-address mappings. Older Git commits may still contain records pushed before local-content separation; ignore rules do not erase history, clones, or caches. This cleanup does not rewrite Git history.

## Before explicit-image publication

Adult classification, inheritance from series to episodes, separate adult browsing/search, neutral social previews, and remembered browser consent are implemented. Mark adult posts before uploading, and review the separate adult area with a safe fixture. Existing Hentai tags and adult R2 paths also infer classification. Adult notes use text and fenced code; dedicated fields hold media. This PC's R2 service is connected. Publishing changed pages to the live website remains a separate action.

A static warning is not verified-age access control and does not make public URLs private. Follow the providers' content rules and applicable law for lawful depictions of adults you are entitled to publish. Use safe fixtures when testing these controls.

See [image storage](IMAGES.md) and [development checks](DEVELOPMENT.md).

## References

- [Cloudflare automatic deployment controls](https://developers.cloudflare.com/pages/configuration/git-integration/#disable-automatic-deployments)
- [Cloudflare commit skip prefix](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message)
- [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare hosting terms](https://www.cloudflare.com/service-specific-terms-developer-platform/)
