# Writing a practical guide

Start with the reader's decision: what they want to achieve, what they need before starting, and how to judge the result. Keep commands and detailed measurements expandable so the main page stays easy to scan.

## Edit and preview locally

1. Run `npm run dev` and open `http://127.0.0.1:4321/studio/`.
2. Choose **Tutorial guide**. Select a saved guide and click **Load guide**, or choose **New guide**.
3. Write the title, short description, summary, prerequisites and takeaways. Add preset choices only when the guide needs them. Each choice explains its goal, tradeoff, playback requirements and command.
4. Add the explanation in Markdown. Use headings for the steps. Optional plain `<details>` and `<summary>` tags can hold longer notes or measurements.
5. Keep **Save as draft** checked, save, then choose **Preview saved guide**. The full layout is available at `/studio/preview/guides/<content-id>/` only on the development site.

Drafts stay out of the public guide library, public routes and search indexes. Preview pages use `noindex, nofollow` and do not enter production output. Unchecking draft changes the next local build; it does not upload the website. Follow [publishing](PUBLISHING.md) when the complete site is ready.

Saving an existing guide requires the revision loaded by the editor. If the file changed elsewhere, the save stops and preserves it; reload before editing again. Each accepted update keeps the previous source in the post's `revisions/` folder. The guide's Content ID stays fixed when its display title changes, including after media upload. Development refreshes wait for a save and retain the open guide and save feedback in transient tab storage when browser storage is available. Closing the tab ends that temporary editor state.

## Optional evidence

All evidence sections are optional. Add as many items as the explanation needs, within these limits:

| Section | Limit | What to enter |
| --- | ---: | --- |
| Screenshots | 40 | Full-size image and a useful caption; optional alt text |
| Comparisons | 30 pairs | Title, source image, encode image; optional labels, notes and alt text |
| Videos | 8 | Title, MP4/WebM address; optional poster and description |
| Downloads | 30 | Label and address; optional provider |
| Preset choices | 20 | Title, goal, tradeoff and command; optional codec, compatibility and notes |

Use **Add screenshot**, **Add comparison** or **Add video**, then **Upload to R2** beside the corresponding field. Existing saved guides can upload into their own post folders after loading the current revision. Local originals and private backup metadata stay in `media-library/posts/guides/<content-id>/`; the public image/video address uses the corresponding R2 group. See [images and videos](IMAGES.md) for file limits and exact-pixel comparison advice.

Comparisons support dragging a split slider, instant source/encode switching and native pixel inspection. Name each pair after the preset or scene it demonstrates, and explain what to look for. Videos use native playback controls and load only on request. Empty sections are omitted. Existing guides without these fields continue to work.

For adult guides, mark **Adult content** before uploading. Use dedicated media fields; the body supports text, fenced commands and plain disclosure tags without attributes. Raw embedded media, imports and MDX expressions are rejected for adult notes. Browser consent is remembered where storage is available; media stays deferred until confirmation.

## Metadata and backups

Guide fields are shared between the local studio and content collection schema in `src/lib/content-fields.ts`. Required metadata remains `title`, `description`, `category`, `difficulty` and `updatedDate`. Optional guide fields include `summary`, `version`, `os`, `tags`, `takeaways`, `prerequisites`, `presets`, `screenshots`, `comparisons`, `videos` and `downloads`. Preset fields are `title`, `goal`, `tradeoff`, `command`, and optional `label`, `codec`, `compatibility`, `language`, `notes`, `recommended`.

Saving creates a local source revision and attempts a private R2 source/manifest backup. The save result tells you if the online backup needs retrying. Direct file edits require `npm run media:backup` afterward. Reference documents can be kept in the post's local `references/` folder; the normal online post backup includes source revisions and the media manifest, not arbitrary reference files.

Keep real guides, source catalogs and media excluded from GitHub. Published text remains visible in the finished site's HTML and search data. Report benchmark numbers with their measurement conditions; command startup checks do not establish visual quality.
