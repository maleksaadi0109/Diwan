import { normalizeArabic } from "../utils";

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countCharacters(text: string, ignoreSpaces: boolean = false): number {
  if (ignoreSpaces) {
    return text.replace(/\s/g, "").length;
  }
  return text.length;
}

/**
 * Returns a simple balance ratio (length of second / length of first).
 * Ideal is roughly 1.0. We use character count without spaces.
 * Returns null if either is empty.
 */
export function calculateBalanceRatio(first: string, second: string): number | null {
  const c1 = countCharacters(first, true);
  const c2 = countCharacters(second, true);
  if (c1 === 0 || c2 === 0) return null;
  return c2 / c1;
}

/**
 * Extracts the likely rhyme letter (last base Arabic letter ignoring diacritics).
 */
export function extractRhymeLetter(text: string): string | null {
  const normalized = normalizeArabic(text);
  const words = normalized.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return null;
  const lastWord = words[words.length - 1];
  
  // Extract last letter that is an Arabic letter
  for (let i = lastWord.length - 1; i >= 0; i--) {
    const char = lastWord[i];
    // Check if it's in the basic Arabic alphabet range
    if (char >= '\u0621' && char <= '\u064A') {
      // Ignore some common grammatical endings if desired, but for now just return the letter
      // E.g. taa marbuta 'ة' is often considered 'ه' in some rhyme contexts, or ignored, 
      // but let's keep it simple.
      return char;
    }
  }
  return null;
}
