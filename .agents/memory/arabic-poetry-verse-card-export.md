---
name: Verse-card PNG export (html-to-image) font CORS
description: html-to-image throws a console SecurityError trying to inline Google Fonts CSS when exporting a styled DOM node to PNG; fix and why.
---

When rasterizing a styled DOM node to PNG in the browser with `html-to-image` (`toPng`), its default font-embedding step tries to read `cssRules` off every stylesheet on the page, including cross-origin ones like Google Fonts' `@import`ed stylesheet. That throws a `SecurityError` in the console (CORS) even though the export itself still succeeds.

**Why:** The app's Arabic webfonts (Amiri/Cairo) are loaded via a cross-origin `@import` in `globals.css`, not self-hosted. `html-to-image` can't read that stylesheet's rules to inline it as base64.

**How to apply:** Pass `skipFonts: true` to `toPng()`/`toJpeg()` calls. Since the fonts are already loaded and applied on the live page (await `document.fonts.ready` first), skipping re-embedding doesn't change how the exported image looks — it only avoids the console error. This applies to any future export-to-image feature (e.g. exporting other card/poster types), not just verse-share cards.
