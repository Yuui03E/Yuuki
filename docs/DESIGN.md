# Website design and content organization

Yuuki uses an editorial archive layout: OLED black, warm white, a soft lime accent, and a mix of clear interface text and book-like headings. Artwork and file details come from saved posts. The theme uses local system fonts and does not need a font service.

## Where visitors find things

| Page | What it shows | Where you edit it |
| --- | --- | --- |
| Home | A release spotlight, collection totals, recent releases, current work, and guides | It follows the published collections automatically |
| Archive | Anime and manga titles, covers, status, and linked releases | Anime / Manga in the local studio |
| Releases | Episodes and batches, available file details, and download links | Episode / Batch in the local studio |
| Guides | Instructions, settings, optional screenshots, videos, and comparisons | Tutorial guide in the local studio |
| Compare | Frame pairs from published releases and guides, plus benchmark records | Add comparisons to their parent post; benchmark records stay in their collection |
| About | The approach and dated workbench updates | Progress entries |

The homepage spotlight starts with the newest release attached to a featured series, then includes the other published general releases. With two or more releases it becomes a slideshow, advancing every eight seconds. Visitors can move backward or forward, pause playback, or browse with the arrow, Home and End keys. Hover, keyboard focus, an offscreen spotlight and a hidden browser tab pause automatic playback. Reduced motion uses manual browsing. Other slides load their artwork when selected. A single release needs no controls; without releases, the spotlight can show a published series. Images use the release thumbnail, then the series banner or cover.

## Appearance controls

The footer's **Appearance** drawer changes the actual site: editorial, modern, bookish or monospace fonts; original, preset or custom text colors; plain, contour, orbital or grid backgrounds; design strength; and background grain from off to 100%. The default stays OLED black with faint contours and grain off. The **Yuuki** wordmark keeps its capital Y.

These preferences are saved under `yuuki.appearance.v1`, with the existing `yuuki-theme` key retained for the color theme. Valid settings restore before the page paints and synchronize between open tabs. If persistent storage is unavailable, the site tries tab storage and explains that limit. With all storage blocked, controls still work for the current page. Custom colors are adjusted for readable text in the current theme; the drawer shows the effective shade. Fonts remain local system fonts, and code keeps its monospace font.

The footer clock displays only the device's time, with 24-hour, 12-hour and hidden modes. It updates by the minute while visible and shows no city or timezone in its text, tooltip or accessible label. The drawer also remembers automatic or manual release playback.

Background shuffle selects a different contour, orbital or grid design every five minutes. It is on by default and can be turned off to keep the current design. Selecting Plain switches shuffle off. The saved change time keeps the schedule consistent between pages; hidden tabs stop their timer and catch up once when visible again. Older saved Plain preferences stay fixed. Grain uses a static, higher-contrast texture with a stronger 100% setting in both themes.

Background artwork and static grain are small local SVGs. They live behind the content; images, videos, charts and comparison pixels receive no texture, blend or filter effects. Appearance choices personalize a visitor's browser and do not change published posts.

The release index shows only specification columns represented in the current list. On smaller screens, each release becomes a readable card with its available details. The release reader puts downloads first and offers direct links to the sections present in that post.

Drafts and adult records keep their existing separation. The local preset guide remains a draft. The shared design also applies to its local preview.

## Recommended next step

Review the real pages locally, then complete one real release with its series, notes, download links, and a few useful comparison frames. Let that post establish the content pattern before adding many more. Existing sample records remain available; manage them individually when the real collection is ready.

GitHub stores the reviewed reusable implementation. Publishing a public website update is a separate, deliberate action using the complete local archive.
