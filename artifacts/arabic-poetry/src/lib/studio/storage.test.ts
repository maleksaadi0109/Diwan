import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadDrafts, saveDrafts, getEmptyDraft } from "./storage";
import { StudioStorageData } from "./types";

describe("Studio Storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return empty draft format if localStorage is empty", () => {
    const data = loadDrafts();
    expect(data.drafts.length).toBe(0);
    expect(data.activeDraftId).toBeNull();
  });

  it("should recover from malformed JSON", () => {
    localStorage.setItem("diwan_studio_drafts", "{ invalid json ");
    const data = loadDrafts();
    expect(data.drafts.length).toBe(0);
  });

  it("should truncate long titles and verses", () => {
    const hugeTitle = "A".repeat(200);
    const hugeVerse = "B".repeat(600);
    
    const draft = getEmptyDraft();
    draft.title = hugeTitle;
    draft.verses[0].firstHemistich = hugeVerse;

    saveDrafts({ version: 1, drafts: [draft], activeDraftId: draft.id });
    
    const data = loadDrafts();
    expect(data.drafts[0].title.length).toBeLessThanOrEqual(100);
    expect(data.drafts[0].verses[0].firstHemistich.length).toBeLessThanOrEqual(500);
  });

  it("should limit the number of verses to 200", () => {
    const draft = getEmptyDraft();
    draft.verses = Array.from({ length: 250 }, (_, i) => ({
      id: `v-${i}`,
      firstHemistich: "test",
      secondHemistich: "test"
    }));

    saveDrafts({ version: 1, drafts: [draft], activeDraftId: draft.id });
    
    const data = loadDrafts();
    expect(data.drafts[0].verses.length).toBe(200);
  });
});
