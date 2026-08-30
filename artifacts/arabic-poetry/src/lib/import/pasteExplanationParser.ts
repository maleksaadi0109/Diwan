import { Verse, VerseExplanationItem, VerseSegmentationSuggestion } from "@/types";
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
  /**
   * Discrepancies between how the pasted explanation quotes a verse and how
   * the poem's own verse records are currently segmented. Always requires
   * explicit user confirmation before being applied — see `App.tsx`'s
   * segmentation-suggestion handling.
   */
  segmentationSuggestions: VerseSegmentationSuggestion[];
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

/** Threshold for the cross-verse merge/split heuristics — stricter than the
 * single-verse match threshold (0.55) because combined text is longer and a
 * false positive here would suggest restructuring the poem's own verse rows. */
const BOUNDARY_MATCH_THRESHOLD = 0.6;

function verseFullText(verse: Verse): string {
  return verse.text || `${verse.firstHemistich} ${verse.secondHemistich}`.trim();
}

/**
 * Detects two poem-data segmentation problems by comparing raw hemistich
 * quote blocks that failed to match any single existing verse against
 * combinations of the poem's own (still-unused) verses:
 *  - `merge_verses`: one explanation quote block matches the concatenation of
 *    two adjacent stored verses — the poem likely split one بيت into two rows.
 *  - `split_verse`: two consecutive explanation quote blocks together match
 *    one stored verse — the poem likely merged two abيات into one row.
 */
function detectBoundarySuggestions(
  unmatchedBlocks: { combined: string; rawLines: string[] }[],
  verses: Verse[],
  usedVerseIds: Set<string>
): { suggestions: VerseSegmentationSuggestion[]; remainingUnmatched: string[] } {
  const suggestions: VerseSegmentationSuggestion[] = [];
  const consumedVerseIds = new Set<string>();
  const blockConsumed = new Array(unmatchedBlocks.length).fill(false);
  const orderedVerses = [...verses].sort((a, b) => a.orderIndex - b.orderIndex);

  const isAvailable = (id: string) => !usedVerseIds.has(id) && !consumedVerseIds.has(id);

  // Pass 1: merge_verses — one quote block spans two adjacent stored verses.
  for (let bi = 0; bi < unmatchedBlocks.length; bi++) {
    const block = unmatchedBlocks[bi];
    const normalizedBlock = normalizeArabic(block.combined);
    let best: { a: Verse; b: Verse; score: number } | null = null;
    for (let vi = 0; vi < orderedVerses.length - 1; vi++) {
      const a = orderedVerses[vi];
      const b = orderedVerses[vi + 1];
      if (!isAvailable(a.id) || !isAvailable(b.id)) continue;
      const combinedNormalized = normalizeArabic(`${verseFullText(a)} ${verseFullText(b)}`);
      const score = wordOverlapScore(normalizedBlock, combinedNormalized);
      if (!best || score > best.score) best = { a, b, score };
    }
    if (best && best.score >= BOUNDARY_MATCH_THRESHOLD) {
      const [suggestedFirst, suggestedSecond] =
        block.rawLines.length === 2
          ? block.rawLines
          : [verseFullText(best.a), verseFullText(best.b)];
      suggestions.push({
        id: makeId("merge"),
        kind: "merge_verses",
        verseIds: [best.a.id, best.b.id],
        description: `يبدو أن الشرح يقتبس هذين البيتين كبيت واحد، بينما هما مخزّنان كبيتين منفصلين في القصيدة.`,
        current: [
          { firstHemistich: best.a.firstHemistich, secondHemistich: best.a.secondHemistich },
          { firstHemistich: best.b.firstHemistich, secondHemistich: best.b.secondHemistich },
        ],
        suggested: [{ firstHemistich: suggestedFirst, secondHemistich: suggestedSecond }],
      });
      consumedVerseIds.add(best.a.id);
      consumedVerseIds.add(best.b.id);
      blockConsumed[bi] = true;
    }
  }

  // Pass 2: split_verse — two consecutive quote blocks together match one stored verse.
  for (let bi = 0; bi < unmatchedBlocks.length - 1; bi++) {
    if (blockConsumed[bi] || blockConsumed[bi + 1]) continue;
    const blockA = unmatchedBlocks[bi];
    const blockB = unmatchedBlocks[bi + 1];
    const normalizedCombined = normalizeArabic(`${blockA.combined} ${blockB.combined}`);
    let best: { verse: Verse; score: number } | null = null;
    for (const verse of orderedVerses) {
      if (!isAvailable(verse.id)) continue;
      const score = wordOverlapScore(normalizedCombined, normalizeArabic(verseFullText(verse)));
      if (!best || score > best.score) best = { verse, score };
    }
    if (best && best.score >= BOUNDARY_MATCH_THRESHOLD) {
      suggestions.push({
        id: makeId("split"),
        kind: "split_verse",
        verseIds: [best.verse.id],
        description: `يبدو أن الشرح يقتبس هذا البيت كبيتين منفصلين، بينما هو مخزّن كبيت واحد في القصيدة.`,
        current: [{ firstHemistich: best.verse.firstHemistich, secondHemistich: best.verse.secondHemistich }],
        suggested: [
          { firstHemistich: blockA.rawLines[0] || blockA.combined, secondHemistich: blockA.rawLines[1] || "" },
          { firstHemistich: blockB.rawLines[0] || blockB.combined, secondHemistich: blockB.rawLines[1] || "" },
        ],
      });
      consumedVerseIds.add(best.verse.id);
      blockConsumed[bi] = true;
      blockConsumed[bi + 1] = true;
    }
  }

  const remainingUnmatched = unmatchedBlocks.filter((_, idx) => !blockConsumed[idx]).map((b) => b.combined);
  return { suggestions, remainingUnmatched };
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
  const unmatchedBlocks: { combined: string; rawLines: string[] }[] = [];
  const preVerseProse: string[] = [];
  const segmentationSuggestions: VerseSegmentationSuggestion[] = [];

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
        sourceTitle: "الشرح",
        explanationType: "manual",
        provider: "manual_paste",
      });
    }
    cur.glossary.forEach((g) => {
      items.push({
        id: makeId("glossary"),
        verseId: cur.verse.id,
        text: `${g.term}: ${g.meaning}`,
        sourceTitle: "المعجم",
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
    const rawLines = verseLineBuffer;
    const combined = rawLines.join(" ");
    verseLineBuffer = [];

    const matchedVerse = findMatchingVerse(combined, verses, usedVerseIds);
    if (matchedVerse) {
      flushCurrent();
      usedVerseIds.add(matchedVerse.id);
      state.current = { verse: matchedVerse, prose: [], glossary: [] };

      // The explanation quotes this بيت split across two lines — check
      // whether that split matches how the poem itself stores the hemistich
      // boundary. Only flag it when the combined wording is the same (this
      // is genuinely a different split point, not a differently-worded verse).
      if (rawLines.length === 2) {
        const [quotedFirst, quotedSecond] = rawLines;
        const normalizedQuotedFirst = normalizeArabic(quotedFirst);
        const normalizedQuotedSecond = normalizeArabic(quotedSecond);
        const normalizedStoredFirst = normalizeArabic(matchedVerse.firstHemistich);
        const normalizedStoredSecond = normalizeArabic(matchedVerse.secondHemistich);
        const combinedQuotedNoSpace = normalizeArabic(combined).replace(/\s+/g, "");
        const combinedStoredNoSpace = normalizeArabic(
          `${matchedVerse.firstHemistich} ${matchedVerse.secondHemistich}`
        ).replace(/\s+/g, "");
        const sameWording = combinedQuotedNoSpace === combinedStoredNoSpace;
        const differentSplit =
          normalizedQuotedFirst !== normalizedStoredFirst || normalizedQuotedSecond !== normalizedStoredSecond;
        if (sameWording && differentSplit) {
          segmentationSuggestions.push({
            id: makeId("hemistich"),
            kind: "hemistich_split",
            verseIds: [matchedVerse.id],
            description: "الشرح يقتبس هذا البيت مقسّماً إلى شطرين بشكل مختلف عمّا هو مخزّن حالياً.",
            current: [{ firstHemistich: matchedVerse.firstHemistich, secondHemistich: matchedVerse.secondHemistich }],
            suggested: [{ firstHemistich: quotedFirst, secondHemistich: quotedSecond }],
          });
        }
      }
    } else {
      unmatchedBlocks.push({ combined, rawLines });
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
      sourceTitle: "ملخص ونظرة عامة على القصيدة",
      explanationType: "manual",
      provider: "manual_paste",
    });
  }

  const { suggestions: boundarySuggestions, remainingUnmatched } = detectBoundarySuggestions(
    unmatchedBlocks,
    verses,
    usedVerseIds
  );

  return {
    matched,
    unmatchedVerseBlocks: remainingUnmatched,
    overviewText: preVerseProse.length > 0 ? preVerseProse.join("\n\n") : null,
    segmentationSuggestions: [...segmentationSuggestions, ...boundarySuggestions],
  };
}
