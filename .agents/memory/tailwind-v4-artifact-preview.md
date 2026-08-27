---
name: Tailwind v4 artifact preview compatibility
description: Visual setup needed when importing a Tailwind v3-configured UI into the workspace's Tailwind v4 Vite artifact template.
---

The workspace artifact template uses Tailwind v4 through `@tailwindcss/vite`, so a legacy `tailwind.config.js` does not provide custom color and font utilities by itself. Define imported design tokens in a CSS `@theme` block and let the Vite plugin process the stylesheet; avoid reintroducing a Tailwind v3 PostCSS config unless the matching PostCSS packages are installed.

**Why:** An imported app can typecheck and build while silently omitting custom utility classes, producing an apparently unstyled preview.

**How to apply:** When importing a Tailwind v3 app, inspect the built CSS and add `@theme` variables for every custom color/font namespace used by JSX before visual verification.