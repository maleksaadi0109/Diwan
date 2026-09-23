---
name: Poem import flows and background queue lessons
description: Non-obvious pitfalls in the import wizard / YouTube import / background processing queue for arabic-poetry.
---

## 4 independent import tabs
The wizard has 4 independent import tabs, each building its own `Poem` object from scratch. A feature added to one (e.g. cover image) doesn't automatically apply to the others — check all 4 when adding poem-construction fields.

## Browser-preview DB: separate instances silently diverge
The browser-preview fallback DB (used when not running in the desktop shell) keeps its live data in memory and only reflects `localStorage` at construction time. Two independently-created repository instances (e.g. one owned by a background task/context, another owned by a UI component) can diverge: writes from one are invisible to the other until it's freshly reconstructed.

**Why:** Caused a real bug where a background-saved record wasn't visible to the UI until a full reload.

**How to apply:** Code that must read data possibly written elsewhere should get a fresh repository handle at read time rather than reusing a long-held cached instance, in browser-preview mode specifically (the desktop shell uses a real shared database file and isn't affected). A systemic fix is worth its own follow-up task rather than patching every call site.

## Don't let a ref-mirror of React state be the synchronous source of truth for async control flow
A `useRef` that mirrors state via `useEffect(() => { ref.current = state }, [state])` is NOT safe as the thing an async loop or background worker reads to decide what to do next — the effect (and even a `setState(prev => ...)` updater function) only runs on React's own render schedule, not synchronously with the state-setting call. An async function that sets state and then, right after, expects a sibling call to see that update, can easily read a stale/empty snapshot depending on timing.

**Why:** A background job queue that drains itself in a loop (check queue → dispatch job → repeat) hit exactly this: newly enqueued/retried items were invisible to the drain loop because it consulted a ref that hadn't been mirrored yet, so the loop exited thinking there was nothing to do.

**How to apply:** When something (e.g. a queue, worker loop) needs an authoritative, always-current snapshot to drive its own next step, maintain that ref as the primary source of truth yourself — update it synchronously at the same call site that changes the logical state, computed from the ref's own prior value (not from a React state closure) — and drive `setState` off of that same computed value for rendering. Do not rely on a `useEffect` mirror, and do not derive the "final" value of an async completion from re-reading a ref shortly after — have the async function that produced it return the value directly.
