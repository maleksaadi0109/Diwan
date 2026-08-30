---
name: Arabic poetry app has multiple independent import flows
description: The import screen has 4 separate tabs (wizard/mizan/youtube/manual) that build their own Poem object independently — a feature added to one does not automatically apply to the others.
---

`ImportView.tsx` has 4 tabs, each with its own poem-construction code path: "wizard" (`NewPoemWizard.tsx`, self-contained YouTube+pipeline flow), "mizan" (`MizanImportView.tsx`, text-only import), "youtube" (`YouTubeImportView.tsx`, audio-only download, no Poem object), and "manual" (`ImportView.tsx`'s own `handleSave`, which is what the "youtube" tab's downloaded audio actually gets attached to when a user pastes a YouTube URL just for audio then fills in title/poet/verses by hand).

**Why:** A feature (e.g. capturing a YouTube thumbnail as a poem cover image) implemented only in `NewPoemWizard.tsx` silently does not apply to poems created via YouTube-tab-audio + manual-tab-save, because that combo bypasses the wizard's code entirely and builds its own `Poem` object in `ImportView.tsx`'s `handleSave`. This caused a real user-facing bug: cover images worked in automated tests (which used the wizard) but not for the user's actual real-world flow (youtube tab + manual tab).

**How to apply:** When adding/changing behavior around poem creation/import (cover images, tags, metadata, etc.), grep for all `Poem = {`/`newPoem`/`finalPoem` object-literal construction sites across the import feature, not just the most obvious one. Test each import tab combination, not just the "wizard" happy path.
