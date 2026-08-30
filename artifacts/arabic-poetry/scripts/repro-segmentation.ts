import { parsePasteExplanationText } from "../src/lib/import/pasteExplanationParser";
import type { Verse } from "../src/types";

// Simulates a poem whose 5th verse was stored with a "normal" (non-mudawwar)
// hemistich split -- i.e. the user typed the two hemistichs by naturally
// re-joining the broken word, guessing where the split "should" go -- while
// the real classical text breaks the word itself across the verse boundary.
const verses: Verse[] = [
  { id: "v1", poemId: "p1", orderIndex: 1, text: "تَطاوَلَ لَيلُكَ بِالأَثمَدِ وَنامَ الخَلِيُّ وَلَم تَرقُدِ", normalizedText: "", firstHemistich: "تَطاوَلَ لَيلُكَ بِالأَثمَدِ", secondHemistich: "وَنامَ الخَلِيُّ وَلَم تَرقُدِ" },
  { id: "v2", poemId: "p1", orderIndex: 2, text: "", normalizedText: "", firstHemistich: "وَباتَ وَباتَت لَهُ لَيلَةٌ", secondHemistich: "كَلَيلَةِ ذي العائِرِ الأَرمَدِ" },
  { id: "v3", poemId: "p1", orderIndex: 3, text: "", normalizedText: "", firstHemistich: "وَذَلِكَ مِن نَبَإٍ جاءَني", secondHemistich: "وَخُبِّرتُهُ عَن أَبي الأَسوَدِ" },
  { id: "v4", poemId: "p1", orderIndex: 4, text: "", normalizedText: "", firstHemistich: "وَلَو عَن نَثاً غَيرِهِ جاءَني", secondHemistich: "وَجُرحُ اللِسانِ كَجُرحِ اليَدِ" },
  // WRONG split: user guessed the word boundary wrong (split after "يَزَل" as one word)
  // instead of the real classical break "يَز" / "لُ".
  { id: "v5", poemId: "p1", orderIndex: 5, text: "", normalizedText: "", firstHemistich: "لَقُلتُ مِنَ القَولِ ما لا يَزَلُ", secondHemistich: "يُؤثِرُ عَنّي يَدَ المُسنِدِ" },
];

const explanationText = `تَطاوَلَ لَيلُكَ بِالأَثمَدِ
وَنامَ الخَلِيُّ وَلَم تَرقُدِ
شرح تجريبي للبيت الأول.

لَقُلتُ مِنَ القَولِ ما لا يَز
لُ يُؤثِرُ عَنّي يَدَ المُسنِدِ
شرح تجريبي للبيت الخامس.
`;

const result = parsePasteExplanationText(explanationText, verses);
console.log(JSON.stringify(result, null, 2));
