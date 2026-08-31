---
name: aldiwan.net poem import
description: How the aldiwan.net poem/word-meaning provider works and its Cloudflare limitation.
---

aldiwan.net is behind Cloudflare bot protection: any plain server-side HTTP request (worker `urllib`, Node `fetch`, the vite dev proxy) gets a 403 "Just a moment..." challenge page instead of real content — confirmed consistently across host variants and even the RSS path. There is no known way around this without a real browser/JS challenge solver, so the app's `AldewanProvider.fetchByUrl` must always be expected to fail in production; it detects the challenge page and surfaces a clear Arabic error rather than silently returning garbage.

**Why:** verified by direct `fetch` tests returning `403`/"Just a moment" for every path tried; only fetching through the Wayback Machine (`web.archive.org`, which serves its own cached copy, not aldiwan.net's live Cloudflare-fronted server) returned real HTML.

**How to apply:** when working on the Aldiwan import feature, don't assume `fetchByUrl` failures are bugs — check for the Cloudflare challenge signature (`Just a moment`, `challenges.cloudflare.com`) first. If real HTML is ever needed for structure/testing again, pull a page via the Wayback Machine `availability` API + snapshot URL rather than fetching aldiwan.net directly.

Real aldiwan.net poem-page structure (confirmed via a Wayback snapshot of `poem81.html`):
- Poem title / poet / era: `<script type="application/ld+json">` with `"@type":"BreadcrumbList"`, `itemListElement` ordered by `position` (era, poet, poem title).
- Verses: `<div id="poem_content">` containing one `<h3>` per hemistich (two consecutive `<h3>` = one bait); words with contributed meanings are wrapped in `<span class="mosahma_highlight" id="N">`.
- Bahr/rhyme: links `href="sea-<name>.html"` ("بحر ...") and `href="q-<letter>"` ("قافية ...") near a `"نبذة عن القصيدة"` heading that marks the end of the verses block.
- Word-meaning glossary ("مساهمات"): `<div id="mosahma_<N>" class="mosahmat_item">` blocks, each with an `<h2>` holding the exact poem word and an `<h4>` holding the contributed meaning text.
