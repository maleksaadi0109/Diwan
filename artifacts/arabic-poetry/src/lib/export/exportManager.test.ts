import { describe, it, expect } from "vitest";
import { exportLrc, exportSrt } from "./exportManager";
import { Poem } from "@/types";

function makePoem(withAlignment: boolean[]): Poem {
  return {
    id: "p-1",
    title: "قصيدة اختبار",
    poet: { id: "poet-1", name: "المتنبي", era: "العصر العباسي" },
    era: "العصر العباسي",
    bahr: "البسيط",
    rhyme: "الميم",
    verses: withAlignment.map((aligned, i) => ({
      id: `v-${i + 1}`,
      poemId: "p-1",
      orderIndex: i + 1,
      text: `بيت رقم ${i + 1}`,
      firstHemistich: `شطر أول ${i + 1}`,
      secondHemistich: `شطر ثانٍ ${i + 1}`,
      alignment: aligned
        ? {
            id: `a-${i + 1}`,
            verseId: `v-${i + 1}`,
            recordingId: "r-1",
            startMs: i * 5000 + 1000,
            endMs: i * 5000 + 5000,
            confidence: 0.9,
            status: "auto" as const,
          }
        : undefined,
    })),
    recordings: [],
  } as unknown as Poem;
}

describe("exportManager unaligned verses", () => {
  it("LRC: never invents timestamps for unaligned verses", () => {
    const lrc = exportLrc(makePoem([true, false, true]));
    // Aligned verses carry timestamps
    expect(lrc).toContain("بيت رقم 1");
    expect(lrc).toContain("بيت رقم 3");
    // Unaligned verse appears as untimed comment, not with a [mm:ss] tag
    const unalignedLine = lrc.split("\n").find((l) => l.includes("بيت رقم 2"));
    expect(unalignedLine).toBeDefined();
    expect(unalignedLine!.startsWith("#")).toBe(true);
    expect(unalignedLine).not.toMatch(/^\[\d/);
  });

  it("SRT: skips unaligned verses entirely with sequential numbering", () => {
    const srt = exportSrt(makePoem([true, false, true]));
    expect(srt).toContain("شطر أول 1");
    expect(srt).not.toContain("شطر أول 2");
    expect(srt).toContain("شطر أول 3");
    // Numbering stays sequential: 1 then 2 (not 3)
    const blocks = srt.trim().split("\n\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[1].startsWith("2\n")).toBe(true);
    // No fabricated 8-second timestamps
    expect(srt).not.toContain("00:00:08,000");
  });

  it("SRT: fully unaligned poem exports no timed blocks", () => {
    const srt = exportSrt(makePoem([false, false]));
    expect(srt.trim()).toBe("");
  });
});
