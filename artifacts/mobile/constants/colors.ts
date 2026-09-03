/**
 * Semantic design tokens for the mobile app.
 *
 * Mirrors a dark "illuminated manuscript" palette with warm parchment text,
 * deep rich sepia/charcoal surfaces, and antique gold accents.
 */

const dark = {
  // Legacy aliases (kept for backward compatibility)
  text: '#EBE3D5',
  tint: '#C79A5E',

  // Core surfaces
  background: '#1A1614',
  foreground: '#EBE3D5',

  // Cards / elevated surfaces
  card: '#241F1C',
  cardForeground: '#EBE3D5',

  // Primary action color (buttons, links, active states) — antique gold
  primary: '#C79A5E',
  primaryForeground: '#1A1614',

  // Secondary / less-emphasis interactive surfaces
  secondary: '#2F2926',
  secondaryForeground: '#EBE3D5',

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: '#342D29',
  mutedForeground: '#A3968A',

  // Accent highlights (badges, selected items, focus rings)
  accent: '#2F2926',
  accentForeground: '#C79A5E',

  // Destructive actions (delete, error states)
  destructive: '#C54E4E',
  destructiveForeground: '#EBE3D5',

  // Borders and input outlines
  border: '#3A332E',
  input: '#2F2926',
};

const colors = {
  light: dark,
  dark,

  // Border radius (in px) — elegant gentle rounding
  radius: 8,
};

export default colors;
