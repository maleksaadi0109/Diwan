---
name: Arabic Poetry mobile/desktop feature parity — what was ported vs. deliberately skipped
description: Decisions made when bringing mobile up to feature parity with the desktop Arabic Poetry app; read before adding more mobile features or asked "why doesn't mobile have X".
---

Ported to mobile (local-state/AsyncStorage implementations, not full parity with desktop's DB-backed versions):
- Arabic-normalized search across title/poet/verse text, verse inline edit/delete, per-poem local undo/redo, touch equivalent of desktop's boundary-edit keyboard shortcut, playlists (create/rename/delete/add/remove poems), full-screen focus/presentation mode, verse-to-PNG share card, bulk library multi-select (delete/add-to-playlist).

Deliberately NOT ported, with reasons:
- **Verse explanations & dictionary lookup**: desktop's explanations come from mizanalarab.com's per-verse `explanations/classical|verse/{verseId}` endpoints keyed by Mizan's *external verse id*. Mobile's `Verse` type only stores a poem-level `externalId`/`externalProvider`, not one per verse — porting this needs a data-model change (store per-verse external ids at Mizan-import time) before it's feasible.
- **Background import queue (desktop's `ImportQueueContext`)**: tied to desktop's local worker process for YouTube download + FFmpeg + offline Whisper ASR + alignment. Mobile has no equivalent local worker — it calls the shared api-server synchronously instead — so the queue/job abstraction doesn't have a matching backend to manage.
- **Keyboard shortcuts reference modal**: no physical keyboard on mobile.
- **Local audio import + offline ASR transcription**: too heavy for mobile (large model bundling), already excluded from mobile's design.
- **Desktop's 5-step "Smart Import Wizard"**: mobile's existing direct import flows (YouTube/cookie-unlock/Mizan catalog) already cover the same need without the wizard shell.

**Why recorded:** these are non-obvious scope boundaries a future session could otherwise "rediscover" by re-reading both codebases; they reflect real architecture mismatches, not oversights.
