/**
 * Strips Arabic Tashkeel (diacritics), Tatweel, and standardizes characters
 * for search/matching. Mirrors artifacts/arabic-poetry/src/lib/utils.ts
 * normalizeArabic so search behaves the same across desktop and mobile.
 */
export function normalizeArabic(text: string): string {
  return text
    // Remove Tashkeel (Fatha, Damma, Kasra, Sukun, Shadda, Tanwin, etc.)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove Tatweel (Kashida)
    .replace(/\u0640/g, '')
    // Normalize Hamza forms: أ إ آ ٱ -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Alef Maksura: ى -> ي
    .replace(/ى/g, 'ي')
    // Remove punctuation
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟،؛«»"']/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a verse's text into its two hemistichs (الصدر / العجز) using the
 * same strict separators as the desktop app's MizanAlArabProvider
 * (artifacts/arabic-poetry/src/lib/providers/MizanAlArabProvider.ts
 * splitHemistichs): em dash, hyphen, or pipe surrounded by spaces. Mizan
 * Al-Arab text always uses " — " between hemistichs; locally typed or
 * YouTube-only verses that don't contain a separator are returned as a
 * single first hemistich with an empty second, so callers can fall back to
 * one-line rendering.
 */
export function splitHemistichs(verseText: string): { first: string; second: string } {
  if (!verseText) return { first: '', second: '' };

  const separators = [' — ', ' - ', ' | '];
  for (const sep of separators) {
    const idx = verseText.indexOf(sep);
    if (idx !== -1) {
      return {
        first: verseText.slice(0, idx).trim(),
        second: verseText.slice(idx + sep.length).trim(),
      };
    }
  }

  return { first: verseText.trim(), second: '' };
}
