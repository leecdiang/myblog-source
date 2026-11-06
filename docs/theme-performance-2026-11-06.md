# Theme performance and dark reading pass

Local preview only. No deployment was performed.

## Measured resource changes

Same local preview, 1440 × 960 desktop sampling. Counts exclude the HTML document. Sizes are decoded resource bytes, including images and external resources; they are not compressed network transfer sizes. Measurements are development samples, not field performance or a promised loading time.

| Page | Requests before → after | Resource bytes before → after | Reduction |
| --- | --- | --- | --- |
| About | 18 → 10 | 915,010 → 466,776 | 49.0% |
| Links, before opening Orrery | 14 → 4 | 791,937 → 259,030 | 67.3% |

Both sampled pages now request zero external CDN resources. On a formula-free article, the final sample loaded five resources and no MathJax. Twenty published articles now include eight MathJax initializers rather than twenty; actual formula markup is detected as well as explicit front matter.

The temporary sampling page was removed after verification. Raw samples and the reading screenshot are in `/Users/lee/Documents/ChatGPT/leecdiang.com/work/performance/`.

## Implementation

- `scripts/studio-assets.js` produces minified CSS and JavaScript with content-derived filenames. The normal pages load the core bundle; article utilities load on rich content pages. Install build dependencies with `npm ci`.
- Used Font Awesome glyphs are emitted as local SVG masks. The build-only icon bank and its license are in `theme-assets/fontawesome/`; no icon font, Font Awesome CDN stylesheet, Anime or Lozad is requested by Studio.
- Only the active theme background is requested. The portrait homepage keeps its existing photo layout and downloads neither decorative background.
- Orrery resources load after activation or the `#orrery` deep link, with retry and keyboard focus handling. Snapshot updates stop while the document is hidden or the closed modal has no visible sidebar card.
- Mermaid loads near a diagram, when a diagram is revealed, or through a relevant anchor. Failed loads retain readable source. The legacy theme bootstrap remains supported.
- MathJax is served locally from the pinned npm package, including its components and fonts. Articles and their source images were not edited.
- Translation skips protected article subtrees. Section tracking caches geometry and invalidates it on layout changes rather than reading every heading on every scroll.
- ASV and HeteroSpec thumbnails use lossless WebP, verified pixel-identical to the PNGs: 397,687 → 147,912 bytes. Full-size links retain the PNG originals.

## Dark article treatment

Only dark article pages receive the quieter treatment: halo opacity 0.20, a feathered `rgba(24,33,43,.94)` reading surface, 18px text with 1.9 line height, a 700px desktop text column and 14px code/tables. Figure palettes and all other page surfaces retain their existing styles.

## Verification

- Forced Hexo build completed without warnings or errors; generated asset references resolve.
- All 187 preexisting files under `source/_posts` match the pre-change SHA-256 snapshot.
- Browser checks passed for dark/light switching, bilingual UI with unchanged article/TOC text, code copying, TOC tracking, category/search/reset, formula rendering, lazy Mermaid rendering/recoloring, and Orrery activation/deep-link/Escape/focus return.
- A formula article without `mathjax: true` rendered 19 MathJax expressions without MathJax errors. Its Mermaid engine was absent initially and rendered two diagrams after navigating to their section.
- At 390 × 844, the homepage remains one viewport with the existing photo/intro composition and no ambient image requests.

## Backup and rollback

Pre-change files are preserved at `/Users/lee/myblog-backups/2026-11-06-performance-reading/`, with repository-relative paths. Restore those files to undo the theme pass, restore the original package files and run `npm ci`, then rebuild and restart the local preview. New build-only files, bundles/loaders and WebP thumbnails may be removed after restoring the original layout. Rebuild before reviewing a rollback; generated files are not the editable source.

The source PNGs, original avatar and article material remain available. This pass does not change hosting headers or establish real-user Core Web Vitals; those require a published deployment and field data.
