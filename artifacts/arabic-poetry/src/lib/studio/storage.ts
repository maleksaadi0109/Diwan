import { StudioDraft, StudioStorageData, StudioVerse } from "./types";

const STORAGE_KEY = "diwan_studio_drafts";

export function getEmptyDraft(): StudioDraft {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "قصيدة جديدة",
    verses: [
      {
        id: `verse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        firstHemistich: "",
        secondHemistich: "",
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function loadDrafts(): StudioStorageData {
  try {
    if (typeof localStorage === "undefined") {
      return { version: 1, drafts: [], activeDraftId: null };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, drafts: [], activeDraftId: null };
    }
    
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.drafts)) {
      return { version: 1, drafts: [], activeDraftId: null };
    }

    const validDrafts: StudioDraft[] = [];
    
    for (const d of parsed.drafts) {
      if (!d.id || typeof d.id !== "string") continue;
      if (!Array.isArray(d.verses)) continue;
      
      const title = typeof d.title === "string" ? d.title.slice(0, 100) : "قصيدة جديدة";
      
      const validVerses: StudioVerse[] = [];
      for (const v of d.verses) {
        if (!v.id || typeof v.id !== "string") continue;
        validVerses.push({
          id: v.id,
          firstHemistich: typeof v.firstHemistich === "string" ? v.firstHemistich.slice(0, 500) : "",
          secondHemistich: typeof v.secondHemistich === "string" ? v.secondHemistich.slice(0, 500) : "",
        });
      }
      
      // Enforce max 200 verses
      if (validVerses.length > 200) {
        validVerses.length = 200;
      }

      validDrafts.push({
        id: d.id,
        title,
        verses: validVerses,
        targetRhyme: typeof d.targetRhyme === "string" ? d.targetRhyme.slice(0, 5) : undefined,
        createdAt: typeof d.createdAt === "number" ? d.createdAt : Date.now(),
        updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
      });
    }

    // Enforce max 50 drafts
    if (validDrafts.length > 50) {
      validDrafts.sort((a, b) => b.updatedAt - a.updatedAt);
      validDrafts.length = 50;
    }

    let activeDraftId = typeof parsed.activeDraftId === "string" ? parsed.activeDraftId : null;
    if (activeDraftId && !validDrafts.find((d) => d.id === activeDraftId)) {
      activeDraftId = validDrafts.length > 0 ? validDrafts[0].id : null;
    }

    return {
      version: 1,
      drafts: validDrafts,
      activeDraftId,
    };
  } catch (err) {
    console.error("Failed to load studio drafts from localStorage:", err);
    return { version: 1, drafts: [], activeDraftId: null };
  }
}

export function saveDrafts(data: StudioStorageData): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Failed to save studio drafts to localStorage:", err);
    return false;
  }
}
