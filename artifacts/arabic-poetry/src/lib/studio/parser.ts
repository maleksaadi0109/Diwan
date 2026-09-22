import { StudioVerse } from "./types";

export function parsePastedText(text: string): StudioVerse[] {
  if (!text || !text.trim()) return [];

  const boundedText = text.slice(0, 250_000);
  const lines = boundedText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const verses: StudioVerse[] = [];

  for (const line of lines) {
    // Attempt to split by triple spaces, multiple tabs, or traditional verse separators
    // e.g. "شطر أول   شطر ثان" or "شطر أول * شطر ثان"
    const parts = line.split(/(\s{3,}|\t+|\s+\*\s+|\s+-\s+)/);
    
    // Filter out the separator parts themselves to get just the text parts
    const textParts = parts.filter(p => p.trim() && !/^(\s+|\*|-)+$/.test(p));

    let first = "";
    let second = "";

    if (textParts.length >= 2) {
      // Take first and last (or just first two if it's two)
      first = textParts[0].trim();
      second = textParts[textParts.length - 1].trim();
    } else {
      // Fallback: split exactly in half by word count
      const words = line.trim().split(/\s+/);
      const half = Math.ceil(words.length / 2);
      first = words.slice(0, half).join(" ");
      second = words.slice(half).join(" ");
    }

    verses.push({
      id: `verse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstHemistich: first.slice(0, 500),
      secondHemistich: second.slice(0, 500),
    });
    
    // Enforce max 200 verses from a paste
    if (verses.length >= 200) break;
  }

  return verses;
}

export function formatDraftAsText(verses: StudioVerse[]): string {
  return verses
    .map(v => {
      const f = v.firstHemistich.trim();
      const s = v.secondHemistich.trim();
      if (!f && !s) return "";
      if (!f) return s;
      if (!s) return f;
      return `${f}\t\t${s}`;
    })
    .filter(Boolean)
    .join("\n");
}
