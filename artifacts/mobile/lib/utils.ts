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
