import { Verse, VerseExplanationItem } from "@/types";
import { normalizeArabic } from "@/lib/utils";

/**
 * Parses a block of plain text that the user copy-pasted by hand from a poetry
 * explanation site (e.g. adabworld.com) — title/summary, an optional general
 * "شرح القصيدة" overview, then per-verse content made of: the verse's
 * hemistich(s) (diacritized), a prose explanation paragraph, and an optional
 * glossary list ("term: meaning" lines).
 *
 * This exists because some explanation sites block automated fetching
 * (bot-mitigation firewalls) but the user can still open the page themselves
 * and paste its text content here — this parser turns that plain-text paste
 * into structured, verse-matched explanation items without needing the site
 * to be reachable from the app at all.
 *
 * Parsing works line-by-line rather than by blank-line-separated blocks,
 * because real-world pastes often run a verse's two hemistichs directly
 * after a prose paragraph with no blank line in between (e.g. a "general
 * overview" sentence immediately followed by the first verse's two lines).
 * Each line is classified independently by its own shape (diacritized verse
 * line, "term: meaning" glossary line, or prose) instead of relying on
 * blank-line grouping.
 */

export interface ParsedExplanationBlock {
  verseId: string;
  verseText: string;
  items: VerseExplanationItem[];
}

export interface ParsePasteExplanationResult {
  matched: ParsedExplanationBlock[];
  unmatchedVerseBlocks: string[];
  overviewText: string | null;
}

const DIACRITICS_RE = /[\u064B-\u065F\u0670]/g;
const ARABIC_LETTER_RE = /[\u0621-\u063A\u0641-\u064A]/g;
const GLOSSARY_LINE_RE = /^([^:：]{1,40})[:：]\s*(.+)$/;
const HEADING_RE = /^(ملخص\s+قصيدة|شرح\s+قصيدة)/;

type LineType = "heading" | "verse" | "vocab" | "prose";

/**
 * Ratio of diacritic marks to base Arabic letters in a line. Fully-vocalized
 * poetry (every letter carries tashkeel) sits well above ~0.35; ordinary
 * prose — even classical-style prose that sprinkles occasional tanwin word
 * endings — stays far below that, so density (not mere presence) is what
 * distinguishes a verse line from a prose sentence here.
 */
function diacriticDensity(line: string): number {
  const letters = line.match(ARABIC_LETTER_RE) || [];
  if (letters.length === 0) return 0;
  const diacritics = line.match(DIACRITICS_RE) || [];
  return diacritics.length / letters.length;
}

function classifyLine(line: string): LineType {
  if (HEADING_RE.test(line) && line.split(/\s+/).length <= 8) return "heading";
  // Glossary lines take priority over the diacritic check: a glossary term
  // itself (e.g. "مُطَّرِداً: ممتداً ومستقيماً.") can be fully vocalized too,
  // but the "term: meaning" shape is the more specific and reliable signal.
  if (GLOSSARY_LINE_RE.test(line)) return "vocab";
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 10 && diacriticDensity(line) >= 0.35) return "verse";
  return "prose";
}

function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) intersection++;
  });
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

/** Finds the best-matching, not-yet-matched verse for a pasted verse line-group. */
function findMatchingVerse(blockText: string, verses: Verse[], usedIds: Set<string>): Verse | null {
  const normalizedBlock = normalizeArabic(blockText);
  let best: { verse: Verse; score: number } | null = null;

  for (const verse of verses) {
    if (usedIds.has(verse.id)) continue;
    const normalizedVerse = normalizeArabic(verse.text || `${verse.firstHemistich} ${verse.secondHemistich}`);
    if (normalizedVerse === normalizedBlock) return verse;
    const score = wordOverlapScore(normalizedBlock, normalizedVerse);
    if (!best || score > best.score) best = { verse, score };
  }

  if (best && best.score >= 0.55) return best.verse;
  return null;
}

let uidCounter = 0;
function makeId(prefix: string): string {
  uidCounter += 1;
  return `paste-import-${prefix}-${Date.now()}-${uidCounter}`;
}

export function parsePasteExplanationText(rawText: string, verses: Verse[]): ParsePasteExplanationResult {
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("النص الملصق فارغ — لا يوجد شيء لاستيراده.");
  }

  const usedVerseIds = new Set<string>();
  const matched: ParsedExplanationBlock[] = [];
  const unmatchedVerseBlocks: string[] = [];
  const preVerseProse: string[] = [];

  interface CurrentVerseState {
    verse: Verse;
    prose: string[];
    glossary: { term: string; meaning: string }[];
  }
  const state: { current: CurrentVerseState | null } = { current: null };
  let verseLineBuffer: string[] = [];

  const flushCurrent = () => {
    const cur = state.current;
    if (!cur) return;
    const items: VerseExplanationItem[] = [];
    if (cur.prose.length > 0) {
      items.push({
        id: makeId("prose"),
        verseId: cur.verse.id,
        text: cur.prose.join("\n\n"),
        sourceTitle: "شرح ملصوق يدويًا",
        explanationType: "manual",
        provider: "manual_paste",
      });
    }
    cur.glossary.forEach((g) => {
      items.push({
        id: makeId("glossary"),
        verseId: cur.verse.id,
        text: `${g.term}: ${g.meaning}`,
        sourceTitle: "معجم ملصوق يدويًا",
        explanationType: "classical",
        provider: "manual_paste",
      });
    });
    if (items.length > 0) {
      matched.push({ verseId: cur.verse.id, verseText: cur.verse.text, items });
    }
    state.current = null;
  };

  const flushVerseBuffer = () => {
    if (verseLineBuffer.length === 0) return;
    const combined = verseLineBuffer.join(" ");
    verseLineBuffer = [];

    const matchedVerse = findMatchingVerse(combined, verses, usedVerseIds);
    if (matchedVerse) {
      flushCurrent();
      usedVerseIds.add(matchedVerse.id);
      state.current = { verse: matchedVerse, prose: [], glossary: [] };
    } else {
      unmatchedVerseBlocks.push(combined);
    }
  };

  for (const line of lines) {
    const type = classifyLine(line);

    if (type === "heading") {
      flushVerseBuffer();
      continue;
    }

    if (type === "verse") {
      verseLineBuffer.push(line);
      // A verse is at most two hemistichs; flush as soon as we have two lines
      // so a prose line immediately following (no blank line) starts fresh.
      if (verseLineBuffer.length >= 2) flushVerseBuffer();
      continue;
    }

    // Any non-verse line ends a pending hemistich group.
    flushVerseBuffer();

    if (type === "vocab") {
      const m = line.match(GLOSSARY_LINE_RE);
      if (m && state.current) {
        state.current.glossary.push({ term: m[1].trim(), meaning: m[2].trim() });
      } else if (m && !state.current) {
        preVerseProse.push(line);
      }
      continue;
    }

    // prose
    if (state.current) {
      state.current.prose.push(line);
    } else {
      preVerseProse.push(line);
    }
  }

  flushVerseBuffer();
  flushCurrent();

  // Attach the poem-level overview (if any) to the first matched verse, so the
  // content isn't lost even though there's no dedicated poem-level explanation surface.
  if (preVerseProse.length > 0 && matched.length > 0) {
    matched[0].items.push({
      id: makeId("overview"),
      verseId: matched[0].verseId,
      text: preVerseProse.join("\n\n"),
      sourceTitle: "ملخص ونظرة عامة على القصيدة (ملصوق يدويًا)",
      explanationType: "manual",
      provider: "manual_paste",
    });
  }

  return {
    matched,
    unmatchedVerseBlocks,
    overviewText: preVerseProse.length > 0 ? preVerseProse.join("\n\n") : null,
  };
}
