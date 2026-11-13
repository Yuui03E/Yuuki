# Yuuki publishing roadmap

Updated on 13 November 2026. The chosen workflow is **GitHub for reusable code, local files for real editorial data, imgbox for public images, and direct local publication to Cloudflare Pages**. A finished static build holds the published text and metadata online; no separate database is required.

## Implemented in the project

- All five real collections stay in `src/content/`, but are removed from current Git tracking and excluded by ignore rules. Their original local files were preserved.
- A local migration snapshot records the original content bytes. It is on the same PC; an independent backup is still recommended.
- Non-explicit sample records are in `examples/content/`. `npm run seed:demo` imports them only into an empty local archive and refuses to overwrite records.
- The studio explains local-only posts and imgbox full-size image addresses. It retains origin/host validation, loopback binding, validated collection writes, optional technical fields and duplicate protection.
- `npm run check:repo` rejects tracked real content, media, credentials/configuration and generated files.
- Local builds require published records and refuse the Cloudflare Git-build or GitHub Actions environment. A code-only checkout cannot replace production through the default build command.
- `npm run publish:site` performs checks, builds fresh output, validates the generated asset set, and uploads only `dist/` using the installed Wrangler CLI. `--check` stops before uploading; `--preview BRANCH` cannot target the production branch.
- Safe import, publishing failure behavior and content boundaries have automated checks. A separate verification builds a code-only checkout from the safe examples.
- ImgLink is rejected following the user's observed image compression. Imgbox is the selected public image host.

## Where information lives

| Material | Source/master | Online copy |
| --- | --- | --- |
| UI, themes, components, schemas and local studio | GitHub and PC | Compiled assets on Pages |
| Real titles, descriptions, tags, notes, specs and image addresses | Local MDX/JSON and backup | Published HTML and search data on Pages |
| Drafts and private working notes | Local files and backup | None |
| Original screenshots and video | PC and backup | None unless deliberately published |
| Public screenshot copies | Local originals retained | Imgbox |
| Build output, content caches, traces and configuration | Ignored local files | Only reviewed `dist/` is uploaded |

Published values can be read by visitors and crawlers. Keeping their editable files out of GitHub does not make public HTML or search data private. The current search builder includes guide bodies and MediaInfo in search data; review personal file paths or private information before publishing. The studio and write endpoints remain development-only.

## One-time host setup still needed

1. In the existing Cloudflare Pages project's **Build → Branch control**, disable automatic production deployments and set automatic preview branches to **None**. Cloudflare supports Wrangler uploads to existing Git-connected projects. This does not delete the current deployed website or require recreating its project.
2. Authenticate locally with `npx wrangler login`, then inspect `npx wrangler pages project list`.
3. Copy `publishing.example.json` to ignored `publishing.local.json`. Enter the verified existing project name and production branch. Do not infer the project identifier solely from the public hostname.
4. Run `npm run publish:site -- --check`. Review the local production preview with `npm run preview -- --port 4322`.
5. Explicitly publish a preview with `npm run publish:site -- --preview review`. Preview URLs can be public; they are not private draft storage.
6. When the reviewed build is ready, run `npm run publish:site` for production.

Host credentials, imgbox account setup, Cloudflare dashboard settings and an actual site upload are not performed by the GitHub code update. The push uses the documented `[CF-Pages-Skip]` prefix to omit its automatic Pages deployment; the build guard is an additional protection. Future ordinary code pushes may show a stopped cloud build until automatic deployments are disabled.

## Everyday use

Write or update a local record. Upload any new public images to imgbox, correctly marked Adult Content where appropriate. Paste the supplied original full-size URLs into the studio. Keep source/encode PNGs at equal dimensions and below imgbox's 10 MB per-file limit. Mark the intended record published, check and build, preview, then explicitly publish the finished website.

~~~sh
npm run publish:site -- --check
npm run preview -- --port 4322
npm run publish:site
~~~

GitHub pushes are for application code and safe examples. Real posts, their metadata, image addresses and `dist/` stay out of GitHub. Publication still works independently of GitHub pushes. Your PC can turn off after upload: Cloudflare serves the website and imgbox serves the images.

## Git history and backups

This update removes real records from the latest tree; **older Git commits can still contain previously pushed records**. Ignore rules do not erase history, clones, caches or forks. History removal or deleting/replacing a repository is a separate decision and has not been performed. Keep repository documentation, screenshots and examples non-explicit; a private GitHub repository is not a content-policy exemption.

Keep backups of all five local collections, original media and a mapping of original filenames to public image addresses and gallery/account information. Test restoring a small record and frame pair. The migration snapshot is not a substitute for a separate drive/device backup.

## Before publishing explicit material

Adult classification, inheritance from a series to its episodes, a dedicated adult browsing path, separate general/adult search handling, neutral social previews and image loading after an adult-content choice are still planned. The current project does not claim verified-age access control. A static age-warning button or a hidden listing is not legally sufficient age verification everywhere and does not make public URLs private.

Implement these controls before deliberately adding explicit images. Apply classification when building pages and search indexes, not only through CSS. Follow each provider's content rules and applicable law; externally hosted images do not exempt the website from its host's rules. This workflow applies to lawful depictions of adults that you are entitled to publish.

The baseline uses static Free Pages, free imgbox hosting and GitHub for generic code. It needs no R2 billing, purchased domain, hosted CMS, database, SSR or runtime Functions. Service limits, fair use and removal policies still apply; free hosting is not a guarantee of permanent availability. Retain a portable local master and backups.

## Verification commands

~~~sh
npx astro check && npm run build
npm test
npm run test:e2e
npm run test:production
npm run test:code-only
~~~

`npm run verify` runs them together with the repository boundary check. The publisher also rejects private source/configuration files or linked directories in `dist/` and enforces Free Pages limits of 20,000 files and 25 MiB per asset.

## References

- [Cloudflare: disable automatic deployments and use Wrangler](https://developers.cloudflare.com/pages/configuration/git-integration/#disable-automatic-deployments)
- [Cloudflare: skip a Git deployment via commit prefix](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message)
- [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Developer Platform hosting terms](https://www.cloudflare.com/service-specific-terms-developer-platform/)
- [GitHub content policy](https://docs.github.com/en/site-policy/acceptable-use-policies/github-sexually-obscene-content)
- [Imgbox help](https://imgbox.com/help)
- [Imgbox terms](https://imgbox.com/tos)
