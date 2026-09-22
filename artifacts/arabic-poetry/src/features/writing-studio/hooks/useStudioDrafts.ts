import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { StudioDraft, StudioVerse } from "../../../lib/studio/types";
import { loadDrafts, saveDrafts, getEmptyDraft } from "../../../lib/studio/storage";

export function useStudioDrafts() {
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ drafts: StudioDraft[]; activeDraftId: string | null } | null>(null);

  useEffect(() => {
    const data = loadDrafts();
    if (data.drafts.length === 0) {
      const initial = getEmptyDraft();
      setDrafts([initial]);
      setActiveDraftId(initial.id);
      saveDrafts({ version: 1, drafts: [initial], activeDraftId: initial.id });
    } else {
      setDrafts(data.drafts);
      setActiveDraftId(data.activeDraftId);
    }
    setIsLoaded(true);
  }, []);

  const flushSave = useCallback(() => {
    if (!pendingSaveRef.current) return;
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    const saved = saveDrafts({
      version: 1,
      drafts: pending.drafts,
      activeDraftId: pending.activeDraftId,
    });
    setSaveStatus(saved ? "saved" : "error");
  }, []);

  const triggerSave = useCallback((newDrafts: StudioDraft[], newActiveId: string | null) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = { drafts: newDrafts, activeDraftId: newActiveId };
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(flushSave, 400);
  }, [flushSave]);

  useEffect(() => {
    const handleBeforeUnload = () => flushSave();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      flushSave();
    };
  }, [flushSave]);

  const mutateDrafts = useCallback((updater: (prev: StudioDraft[]) => StudioDraft[], newActiveId?: string | null) => {
    setDrafts((prev) => {
      const next = updater(prev);
      const activeId = newActiveId !== undefined ? newActiveId : activeDraftId;
      triggerSave(next, activeId);
      return next;
    });
    if (newActiveId !== undefined) {
      setActiveDraftId(newActiveId);
    }
  }, [activeDraftId, triggerSave]);

  const activeDraft = useMemo(() => drafts.find(d => d.id === activeDraftId) || null, [drafts, activeDraftId]);

  const createDraft = useCallback(() => {
    if (drafts.length >= 50) return;
    const newDraft = getEmptyDraft();
    mutateDrafts((prev) => [newDraft, ...prev], newDraft.id);
  }, [drafts.length, mutateDrafts]);

  const switchDraft = useCallback((id: string) => {
    mutateDrafts((prev) => prev, id);
  }, [mutateDrafts]);

  const updateDraft = useCallback((id: string, updates: Partial<StudioDraft>) => {
    mutateDrafts((prev) => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d));
  }, [mutateDrafts]);

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      let next = prev.filter((draft) => draft.id !== id);
      if (next.length === 0) next = [getEmptyDraft()];
      const nextActiveId = activeDraftId === id ? next[0].id : activeDraftId;
      setActiveDraftId(nextActiveId);
      triggerSave(next, nextActiveId);
      return next;
    });
  }, [activeDraftId, triggerSave]);

  const duplicateDraft = useCallback((id: string) => {
    if (drafts.length >= 50) return;
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    
    const newDraft: StudioDraft = {
      ...draft,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${draft.title} (نسخة)`,
      verses: draft.verses.map((v: StudioVerse) => ({
        ...v,
        id: `verse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mutateDrafts((prev) => [newDraft, ...prev], newDraft.id);
  }, [drafts, mutateDrafts]);

  // Verse operations for active draft
  const addVerse = useCallback((index: number) => {
    if (!activeDraftId) return;
    const newVerse: StudioVerse = {
      id: `verse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstHemistich: "",
      secondHemistich: "",
    };
    
    mutateDrafts((prev) => prev.map(d => {
      if (d.id !== activeDraftId) return d;
      if (d.verses.length >= 200) return d;
      const nextVerses = [...d.verses];
      nextVerses.splice(index + 1, 0, newVerse);
      return { ...d, verses: nextVerses, updatedAt: Date.now() };
    }));
  }, [activeDraftId, mutateDrafts]);

  const updateVerse = useCallback((verseId: string, updates: Partial<StudioVerse>) => {
    if (!activeDraftId) return;
    mutateDrafts((prev) => prev.map(d => {
      if (d.id !== activeDraftId) return d;
      return {
        ...d,
        updatedAt: Date.now(),
        verses: d.verses.map((v: StudioVerse) => v.id === verseId ? { ...v, ...updates } : v)
      };
    }));
  }, [activeDraftId, mutateDrafts]);

  const deleteVerse = useCallback((verseId: string) => {
    if (!activeDraftId) return;
    mutateDrafts((prev) => prev.map(d => {
      if (d.id !== activeDraftId) return d;
      // Prevent deleting the very last verse, just clear it instead
      if (d.verses.length <= 1) {
        return {
          ...d,
          updatedAt: Date.now(),
          verses: [{ id: d.verses[0].id, firstHemistich: "", secondHemistich: "" }]
        };
      }
      return {
        ...d,
        updatedAt: Date.now(),
        verses: d.verses.filter(v => v.id !== verseId)
      };
    }));
  }, [activeDraftId, mutateDrafts]);

  const reorderVerse = useCallback((verseId: string, direction: 'up' | 'down') => {
    if (!activeDraftId) return;
    mutateDrafts((prev) => prev.map(d => {
      if (d.id !== activeDraftId) return d;
      const idx = d.verses.findIndex(v => v.id === verseId);
      if (idx < 0) return d;
      if (direction === 'up' && idx === 0) return d;
      if (direction === 'down' && idx === d.verses.length - 1) return d;
      
      const nextVerses = [...d.verses];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [nextVerses[idx], nextVerses[targetIdx]] = [nextVerses[targetIdx], nextVerses[idx]];
      
      return { ...d, verses: nextVerses, updatedAt: Date.now() };
    }));
  }, [activeDraftId, mutateDrafts]);

  return {
    isLoaded,
    saveStatus,
    drafts,
    activeDraftId,
    activeDraft,
    createDraft,
    switchDraft,
    updateDraft,
    deleteDraft,
    duplicateDraft,
    addVerse,
    updateVerse,
    deleteVerse,
    reorderVerse,
  };
}
