---
name: Verse merge/split heuristic thresholds
description: How pasteExplanationParser's merge_verses/split_verse boundary detection scores matches, and why naive test fixtures fail.
---

`detectBoundarySuggestions` in `pasteExplanationParser.ts` needs a quoted block that spans two adjacent verses to score below the single-verse match threshold (0.55) against either verse alone, but above the boundary threshold (0.6) against their concatenation. If one verse's word count dominates the combined block, its overlap fraction alone can already exceed 0.55, so the parser silently takes the normal single-verse-match path instead of flagging a merge/split suggestion.

**Why it matters:** this is not a bug to fix, but a real fixture-design trap — balanced word counts between the two verses are required to exercise the boundary-detection code path at all.
