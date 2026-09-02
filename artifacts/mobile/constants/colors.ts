/**
 * Semantic design tokens for the mobile app.
 *
 * Mirrors the dark "illuminated manuscript" palette of the sibling
 * artifacts/arabic-poetry desktop app (artifacts/arabic-poetry/src/styles/globals.css):
 * deep charcoal surfaces, warm parchment text, and a gold accent.
 * The app is intentionally dark-only (light === dark) so it always
 * matches the desktop app regardless of the device's system theme.
 */

const dark = {
  // Legacy aliases (kept for backward compatibility)
  text: '#fdfbf7',
  tint: '#d4af37',

  // Core surfaces
  background: '#0a0b0e',
  foreground: '#fdfbf7',

  // Cards / elevated surfaces
  card: '#14171d',
  cardForeground: '#fdfbf7',

  // Primary action color (buttons, links, active states) — illumination gold
  primary: '#d4af37',
  primaryForeground: '#14171d',

  // Secondary / less-emphasis interactive surfaces
  secondary: '#181b23',
  secondaryForeground: '#eee4d0',

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: '#181b23',
  mutedForeground: '#a0aab7',

  // Accent highlights (badges, selected items, focus rings)
  accent: '#20242e',
  accentForeground: '#f5d77f',

  // Destructive actions (delete, error states)
  destructive: '#e63946',
  destructiveForeground: '#fdfbf7',

  // Borders and input outlines
  border: '#20242e',
  input: '#242834',
};

const colors = {
  light: dark,
  dark,

  // Border radius (in px), matches the desktop app's card/button rounding.
  radius: 14,
};

export default colors;
