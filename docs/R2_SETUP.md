# R2 setup for Yuuki

This guide explains setup and recovery for any checkout. This PC is connected to the private `yuuki-media` bucket through its read-only media Worker. Pages publication remains a separate action.

## What goes where

| Material | Master copy | Online copy |
| --- | --- | --- |
| Website code and safe examples | PC and GitHub | Finished pages on Cloudflare Pages |
| Posts and editable metadata | Local `src/content/` and independent backup | Published HTML and search data on Pages |
| Selected images and videos | Ignored `media-library/posts/<collection>/<post-id>/media/<audience>/` | R2 `media/<audience>/<collection>/<post-id>/` |
| Filename, hash, and URL mapping | Ignored `media-library/catalog.json` | Private R2 `metadata/catalog.json` |
| Post sources, drafts and private notes | PC source plus versioned per-post backups | Private `metadata/posts/<collection>/<post-id>/`, excluded from published pages |

The website works while your PC is off. No remote database is needed. Published text and media addresses are public.

## 1. Enable R2 and create a dedicated bucket

Open [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2) in your own account. Complete any activation, billing details, and terms yourself. Do not send passwords, payment details, tokens, or API keys in chat.

Create a new dedicated bucket, for example **yuuki-media**, using **Standard** storage. Keep public bucket access and r2.dev disabled. Do not reuse a bucket with unrelated objects. The suggested name is not a verified resource.

Keep **Workers Free** for this hobby setup. The small read-only media Worker gives the private bucket a public HTTPS address on workers.dev without a paid domain. It serves only hashed image/video paths; it cannot upload or expose the private catalog. CORS allows your configured site and local studio, but it does not prevent other people from fetching a public address.

## 2. Sign in and record the actual settings

From this project folder:

~~~powershell
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) '.wrangler/logs'
npx wrangler login
npx wrangler whoami
npx wrangler r2 bucket list
~~~

Use your browser for sign-in. Verify the correct account and dedicated bucket. Copy `r2.example.json` to `r2.local.json` and replace every placeholder:

- `accountId`: the verified Cloudflare account ID.
- `bucketName`: the actual dedicated Standard bucket.
- `workerName`: your chosen Worker name.
- `mediaOrigin`: its actual HTTPS workers.dev address, without a trailing slash or path. Confirm your account's workers.dev subdomain in the dashboard.
- `publicOrigin`: the website origin, currently `https://yuuki03e.pages.dev`.
- `storageBudgetBytes`: leave at **9000000000** for a 9 GB local guard.

These settings are ignored by Git. Wrangler authentication stays in its own local credential store. No keys are placed in the website.

## 3. Check and deploy the media service

~~~powershell
npm run media:deploy -- --check
npm run media:check
npm run media:deploy
~~~

The first command validates settings and deploys nothing. The last command deliberately deploys the read-only Worker and binds the verified R2 bucket. It selects the account explicitly. It does not deploy the Pages website.

Open `<mediaOrigin>/health`. It must report `service: yuuki-media`, `version: 1`, and your exact bucket name. Confirm the Worker URL matches `mediaOrigin` before uploading.

## 4. Verify with one safe file

Start `npm run dev` and open [the local studio](http://127.0.0.1:4321/studio/).

Use **Upload to R2** beside a cover, screenshot, comparison, or video field. Start with a small non-explicit PNG or WebP. The tool:

1. Checks type and size: PNG/JPG/WebP/GIF up to 10 MB; MP4/WebM up to 25 MB.
2. Preserves the original bytes locally.
3. Reserves its size in the local catalog and checks the 9 GB guard.
4. Reuses an identical online object, or uploads to a SHA-256 filename.
5. Downloads the online copy and verifies its byte count and SHA-256.
6. Fills the verified URL and backs up the mapping privately to R2.

A failed upload preserves the original and pending reservation. Retry the same file after fixing setup; identical files do not consume another reservation. If only the online catalog backup fails, the studio reports that separately. Retry the file to repair it.

The tool checks existing remote content before uploading and refuses mismatched bytes. Wrangler's upload is not an atomic conditional create: use a dedicated bucket, and avoid manual or unrelated writers.

Open the resulting URL and confirm the local original's hash matches. For a short video, test playback and seeking. Check Cloudflare usage and the Standard storage class after this first real upload.

## 5. Adult posts and comparisons

Mark the post **Adult content · 18+** before uploading adult media. Episodes inherit their parent series' classification. Adult R2 paths and existing Hentai tags also classify a record as adult without changing its original file.

Adult records are excluded from general listings, general JSON search, and Pagefind. They have a separate /adult/ area, neutral social metadata, and noindex. Images, posters, and video sources are deferred until the visitor confirms once. That choice is remembered in localStorage for this browser and website origin until reset or browser storage is cleared. Private browsing has its own storage. If persistent storage is blocked, tab storage or the current page provides a fallback. “Hide and reset adult choice” forgets consent and unloads media, including other open tabs on that origin.

Adult notes support Markdown text and fenced code. Put media in dedicated fields; raw HTML, imports, MDX expressions, and Markdown images are rejected for adult notes so they cannot bypass loading controls. General MDX authoring remains supported.

The comparison viewer supports dragging the slider, 1/2 or arrow keys, and Space or clicking an image in Toggle mode. Native view displays original pixels. Upload equal-sized source and encode frames. WebP is accepted and stored unchanged; use lossless WebP or PNG when exact pixels matter.

A choice box is not verified-age access control. Public media URLs remain accessible directly, and provider policies still apply. Only publish lawful material involving adults that you have the right to distribute. No provider guarantees permanent retention of every kind of content.

## Costs and limits

R2 **Standard** currently includes **10 GB-month storage**, **1 million Class A operations**, and **10 million Class B operations per month** in the account's free allowance. Egress from R2 is free. Infrequent Access has different charges and is not used here.

The local **9 GB guard is not an account-wide storage or spending cap**. It counts this catalog's media, including pending uploads and separate general/adult copies. Other buckets, manual uploads, metadata objects, or a lost catalog are outside that count. Do not delete the catalog to make more space.

10,000 visits × 50 media requests is around 500,000 HTTP requests. Cache misses, range requests, and conditional checks can cause additional R2 reads; this example would ordinarily remain within the monthly read allowance. Staying below 10 GB alone does not guarantee a zero bill. Excess operations and storage are still metered. Upload verification and private catalog updates also use operations.

Workers Free allows **100,000 requests per day**. A sudden spike can exhaust that daily allowance and interrupt delivery even when monthly R2 reads remain free. R2 and Workers are separate meters. Check both dashboards and any available usage alerts; alerts are not hard spending caps.

The chosen setup targets $0 at your expected hobby traffic. It is not a promise of 100% uptime or a guaranteed $0 bill.

## Backups and recovery

Enter a post title before uploading. The studio generates a readable Content ID and fixes it for subsequent uploads. Episodes use the series ID, episode label and version. A title change leaves that ID stable. Another form cannot silently reuse a reserved ID; choose a different ID for a different post with the same title.

For example, a post titled `My Anime (2026)` could use:

~~~text
PC: media-library/posts/anime/my-anime-2026/
    manifest.json       original filenames, hashes and online addresses
    post.mdx            latest editable source snapshot
    revisions/          earlier source snapshots, named by hash
    media/adult/        original image/video bytes, named by hash
R2: media/adult/anime/my-anime-2026/<hash>.webp
    metadata/posts/anime/my-anime-2026/manifest.json
    metadata/posts/anime/my-anime-2026/revisions/<hash>.mdx
~~~

Public R2 folders contain only images/videos. The Worker rejects private manifests, post sources and metadata. Saving through the studio backs up the source locally, then requests the private online backup without delaying the saved-post response. If the online step fails, the studio reports that the post is still saved locally. Editing source files directly requires running `npm run media:backup` afterward to refresh those snapshots. This also backs up all five collections, including drafts. It stores external media URLs as references; it does not download externally hosted media.

`npm run media:organize -- --check` previews migration of old flat uploads. `npm run media:organize -- --apply` deliberately copies and verifies them, preserves source revisions, and updates post references. It retains old originals and online addresses. Both copies count toward the local storage guard. Unassigned uploads get their own folder; the connection test is kept separate from real posts. Repeating a completed migration does not make extra media copies.

To recover a post, use its private manifest to locate the source revision and images/videos. Restore the source into its original `src/content/` collection and the full local library/catalog from backup, then rebuild. Preserve existing files before restoration. R2 recovery uses your authenticated account; private files cannot be downloaded through the public Worker.

Back up all five `src/content/` collections, the entire `media-library/`, and `r2.local.json` to an independent drive or backup service. A sibling folder on the same PC does not protect against drive failure. The online copies complement independent originals. The 9 GB guard tracks catalog media; metadata and revision storage also contribute to Cloudflare's billable usage.

Uploads are serialized using `media-library/.upload.lock`. If the local process crashes, stop all studio/upload processes before removing only that stale lock. Preserve the catalog and originals. Changing account, bucket, or media address requires a planned migration; the tool rejects reuse of a catalog belonging to a different setup.

Remote deletion, automatic sync/deletion, and browser uploads by invited contributors are not implemented. This milestone is the owner's loopback-only studio. A later contributor service needs separate sign-in, permissions, upload limits, and moderation.

## Publish the pages afterward

Once media works, configure and review [direct Pages publication](PUBLISHING.md). Upload the complete local build when you intend to publish your posts. A GitHub push synchronizes code; it does not publish this local archive.

## Official references

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Public bucket access and r2.dev limits](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/)

Pricing and allowances were checked for this implementation in November 2026; verify them again before activation.
