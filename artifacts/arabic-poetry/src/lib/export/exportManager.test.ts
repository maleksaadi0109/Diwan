import { describe, it, expect } from "vitest";
import {
  formatLrcTimestamp,
  formatSrtTimestamp,
  exportLrc,
  exportSrt,
  exportDiwanJson,
} from "./exportManager";
import { mockPoems } from "@/data/mockData";

describe("Export Manager", () => {
  const mockPoem = mockPoems[0];

  it("formats timestamps accurately for LRC and SRT", () => {
    expect(formatLrcTimestamp(2500)).toBe("[00:02.50]");
    expect(formatLrcTimestamp(65120)).toBe("[01:05.12]");

    expect(formatSrtTimestamp(2500)).toBe("00:00:02,500");
    expect(formatSrtTimestamp(65120)).toBe("00:01:05,120");
  });

  it("exports valid LRC lyrics format with metadata headers", () => {
    const lrc = exportLrc(mockPoem);
    expect(lrc).toContain(`[ti:${mockPoem.title}]`);
    expect(lrc).toContain(`[ar:${mockPoem.poet.name}]`);
    expect(lrc).toContain("[00:02.50]");
    expect(lrc).toContain(mockPoem.verses[0].text);
  });

  it("exports valid SRT subtitle format", () => {
    const srt = exportSrt(mockPoem);
    expect(srt).toContain("1\n00:00:02,500 --> 00:00:09,800");
    expect(srt).toContain(mockPoem.verses[0].firstHemistich);
  });

  it("exports structured Diwan JSON bundle", () => {
    const jsonStr = exportDiwanJson(mockPoem);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schema_version).toBe("1.0");
    expect(parsed.poem.title).toBe(mockPoem.title);
    expect(parsed.poem.verses).toHaveLength(mockPoem.verses.length);
  });
});
