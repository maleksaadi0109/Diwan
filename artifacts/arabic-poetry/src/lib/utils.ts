import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format milliseconds into MM:SS or MM:SS.mmm format for playback displays
 */
export function formatTime(ms: number, includeMs = false): string {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliRemainder = Math.floor(ms % 1000);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const padMs = (n: number) => n.toString().padStart(3, "0");

  if (includeMs) {
    return `${pad(minutes)}:${pad(seconds)}.${padMs(milliRemainder)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Strips Arabic Tashkeel (diacritics), Tatweel, and standardizes characters for search/matching
 */
export function normalizeArabic(text: string): string {
  return text
    // Remove Tashkeel (Fatha, Damma, Kasra, Sukun, Shadda, Tanwin, etc.)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // Remove Tatweel (Kashida)
    .replace(/\u0640/g, "")
    // Normalize Hamza forms: أ إ آ ٱ -> ا
    .replace(/[أإآٱ]/g, "ا")
    // Normalize Taa Marbuta: ة -> ه (secondary in search)
    // Normalize Alef Maksura: ى -> ي
    .replace(/ى/g, "ي")
    // Remove punctuation
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟،؛«»"']/g, " ")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert western digits to Arabic-Indic digits if needed
 */
export function toArabicDigits(num: number | string): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num
    .toString()
    .replace(/\d/g, (d) => arabicDigits[parseInt(d, 10)]);
}
