---
name: Poem catalog one-click import
description: How the "مكتبة جاهزة" ready-made catalog reuses the existing import pipeline, and how to resolve mizanalarab.com poem ids for new catalog entries.
---

The full text+audio import pipeline (`ImportQueueContext.enqueuePoemImport` /
`processPoemImportJob`) is provider-agnostic: it just needs a
`PoemImportJobPayload` (title, poet, era, bahr, rhyme, `parsedVerses`, and
either a `youtubeUrl` or a local file). The manual wizard
(`NewPoemWizard.tsx`) is only one caller of it.

**Why this matters:** any "curated content" feature (a catalog, a "poem of
the day", bulk seeding) can enqueue the same pipeline directly —
`MizanAlArabProvider.fetchPoemById(id)` + `.mapApiResponseToPayload(...)`
gives `parsedVerses`/era/bahr/rhyme, and a known YouTube URL fills the audio
side — without building a second import path or touching the wizard UI.

**How to apply:** for a new curated/catalog import feature, build the
`PoemImportJobPayload` directly (set `audioSourceMode: "youtube"`,
`importedFromMizan: true`, `mizanPoemId`, `mizanUrl`) and call
`enqueuePoemImport`; track progress via the returned job id against the
shared `jobs` list from `useImportQueueContext()`. Match "already
downloaded" by `poem.externalProvider === "mizan_al_arab" && poem.externalId
=== mizanPoemId`.

## Resolving mizanalarab.com poem ids

mizanalarab.com hosts multiple duplicate pages for the same classical poem
(different ids, same text) — picking the *first* search hit is unreliable.
There is an undocumented, fetchable search endpoint:
`GET https://mizanalarab.com/poems?q=<verse text>` returns a rendered page
whose markdown contains `[<title>\n\n<poet>· <bahr>· ...](https://mizanalarab.com/poem/<id>)`
links. Searching with a few words from partway through the poem (not just
the opening) surfaces the right match; verify by checking the poet name in
the result snippet before picking an id.

For identifying which poem a given YouTube video actually contains, `yt-dlp
--skip-download --print "%(title)s | %(uploader)s | %(duration)s" <url>` (no
download, no auth) is enough — the video title/uploader alone reliably
disambiguates without needing to touch the audio.

## Mizan API access: native vs. browser

`GET https://mizanalarab.com/api/poems/<id>` returns 200 JSON with no
User-Agent header required (confirmed via curl) — a desktop-style
`User-Agent` is not necessary for this endpoint to work. However the
response carries no `Access-Control-Allow-Origin` header, so a browser
`fetch()` to it is blocked by CORS (`net::ERR_FAILED`); only requests from a
context not subject to browser CORS (native mobile fetch, a server-side
fetch, or a worker-bridge proxy as the desktop app uses) can read the
response.
