# Yuuki image storage

**The selected image host is [imgbox](https://imgbox.com/).** ImgLink was rejected after the user observed automatic compression; it must not be used for source/encode comparison frames.

1. Keep original images on the PC and a separate backup.
2. Create or use an imgbox account to manage public copies.
3. Use PNG for exact frame inspection. Imgbox supports PNG, JPG and GIF files up to **10 MB each**.
4. Mark explicit uploads **Adult Content** and comply with the host's rules.
5. Use image URLs supplied by the **full-size** share codes. A gallery/viewer page URL is not an image URL, and a thumbnail is not a full-resolution comparison frame.
6. Store those HTTPS addresses in the local studio's cover, screenshot and comparison fields.
7. Build locally and publish the finished website directly to Cloudflare Pages.

The studio stores address strings in local MDX. It does not upload, download or back up images. The real content collections and their addresses are ignored by Git. Cloudflare receives published HTML, metadata and search data through the finished build, while imgbox serves the public images.

The website's gallery and native-size comparison viewer support external HTTPS image URLs without adding a frontend framework. Verify matching source/encode dimensions and preserve original pixels and color interpretation. Use original full-size results for quality inspection.

| Material | Location |
| --- | --- |
| Original images and image-address mapping | PC and independent backup |
| Public image copies | Imgbox |
| Editable text and metadata | Local `src/content/`, excluded from Git |
| Finished pages and public metadata | Cloudflare Pages |
| Small sample SVG illustrations | Code repository and built website |

`media-library/`, migration snapshots, caches and build output are ignored. Raster files and subfolders under `public/images/` are also ignored; only root-level small SVG examples are tracked. Such ignored files can enter a local build if deliberately placed under `public/`, so keep bulk originals in `media-library/` and use external image addresses.

Imgbox advertises unlimited image storage/time, subject to fair use, and permits full-size inline linking. That is not a verified guarantee that your 5 GB library will always be retained or served. Keep your own originals and mapping.

No account or media upload was created by this project change. A future local upload helper can be added after the manual imgbox flow works; its credentials must stay local. Video remains optional and is not part of this setup.

- [Imgbox help: supported types, size, retention and full-size embedding](https://imgbox.com/help)
- [Imgbox terms](https://imgbox.com/tos)
- [Publishing workflow and remaining setup](PUBLISHING.md)
