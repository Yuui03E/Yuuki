# Yuuki images and videos

The selected storage is **Cloudflare R2 Standard**. Follow [R2 setup](R2_SETUP.md) to enable it, create a dedicated private bucket, and connect the read-only media service.

Enter the title first (or select the series and episode), then choose **Upload to R2** beside a media field. Originals are preserved in ignored `media-library/posts/<collection>/<post-id>/media/<audience>/`. R2 uses the matching `media/<audience>/<collection>/<post-id>/` group. Hash filenames prevent collisions; original filenames stay in the manifest. Changing the displayed title keeps the Content ID and addresses stable. Online bytes are verified before filling the field.

Saving backs up the editable source and media manifest in that post folder and privately in R2. Use `npm run media:backup` after editing source files directly. Old flat uploads stay available for existing links; `media:organize -- --check` previews their migration. See [folder layout and recovery](R2_SETUP.md#backups-and-recovery).

Images: PNG, JPG, WebP, GIF up to **10 MB**. Videos: MP4 or WebM up to **25 MB**, with optional posters. The service does not recompress files. For exact encoding comparisons use PNG or lossless WebP, equal frame dimensions, and consistent color interpretation. Lossy WebP can change the pixels you are comparing.

The viewer supports a slider, instant A/B switching, and native pixel inspection. Videos use native controls, no autoplay, and no preload. Optional interactions load on the pages using them.

Guides support multiple screenshots, comparison pairs and videos. Load a saved guide in the studio before uploading into its existing folder; a current source revision prevents attaching uploads through a stale editor. See [guide writing](GUIDES.md) for adding evidence and previewing drafts.

Mark adult posts before uploading. Adult classification is inherited by releases, inferred from R2 adult paths and Hentai tags, and enforced during page and search generation. Visitors confirm once per browser/site, with a visible option to hide content and reset that saved preference. Media remains unloaded before the first confirmation. The choice does not make public URLs private or verify a visitor's age.

Existing full-size HTTPS image links, including imgbox, remain supported. Use a direct media URL rather than a gallery/viewer page or thumbnail. Existing media URLs are not automatically migrated or downloaded. ImgLink remains unsuitable for exact frames because the user observed compression.

Posts and editable metadata remain in local `src/content/`. Their published representation is served by Cloudflare Pages. Bulk media stays out of GitHub and outside `public/`; only safe SVG illustrations belong in the code repository.

Keep an independent backup of the local collections, entire media library, and settings. See [R2 costs, limits, recovery and content rules](R2_SETUP.md) and [Pages publishing](PUBLISHING.md).
