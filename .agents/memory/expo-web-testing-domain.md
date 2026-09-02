---
name: Expo web preview testing domain
description: Which URL to point browser-based (Playwright) testing at for an Expo mobile artifact in this project.
---

Expo apps bypass the shared artifact proxy entirely (per the dev_on_replit env docs). Navigating a
testing subagent to the shared workspace domain's `/mobile/` path or even `/` renders either a blank
page or the *wrong* artifact (e.g. the desktop web app registered at previewPath `/`).

**How to apply:** point browser-based testing (or manual verification) at
`https://${REPLIT_EXPO_DEV_DOMAIN}/` (the `*.expo.<region>.replit.dev` domain), not the shared
`$REPLIT_DEV_DOMAIN/mobile/` path. Confirm you're on the right app by checking for
app-specific UI (e.g. this project's "ديوان" home screen with المكتبة/استيراد/الإعدادات tabs)
before trusting further test steps.
