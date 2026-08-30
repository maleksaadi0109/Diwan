import { useState, useEffect, useCallback } from "react";
import { ActiveTab, Poem, AlignmentStatus, VerseExplanationItem } from "./types";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { MiniPlayer } from "./components/MiniPlayer";
import { LibraryView } from "./features/library/LibraryView";
import { PoemPlayerView } from "./features/player/PoemPlayerView";
import { BoundaryReviewEditor } from "./features/editor/BoundaryReviewEditor";
import { ImportView } from "./features/import/ImportView";
import { SettingsView } from "./features/settings/SettingsView";
import { DiwanRepository } from "./lib/db/repository";
import { AudioPlayerProvider, useAudioPlayerContext } from "./contexts/AudioPlayerContext";

export function App() {
  return (
    <AudioPlayerProvider>
      <AppShell />
    </AudioPlayerProvider>
  );
}

function AppShell() {
  const [repo, setRepo] = useState<DiwanRepository | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [activePoem, setActivePoem] = useState<Poem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { controller, playerState, currentPoem, clearPoem } = useAudioPlayerContext();

  // Initialize DB and load initial data
  useEffect(() => {
    let isMounted = true;

    async function initDb() {
      try {
        const repository = await DiwanRepository.create();
        if (!isMounted) return;
        setRepo(repository);

        let loadedPoems = await repository.getAllPoems();
        if (loadedPoems.length === 0) {
          // Idempotent seed if database is empty on first run
          await repository.seed();
          loadedPoems = await repository.getAllPoems();
        }

        if (isMounted) {
          setPoems(loadedPoems);
          if (loadedPoems.length > 0) {
            setActivePoem(loadedPoems[0]);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to initialize database:", err);
        if (isMounted) setIsLoading(false);
      }
    }

    initDb();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenPoem = (poem: Poem) => {
    setActivePoem(poem);
    setActiveTab("player");
  };

  const handleImportPoem = useCallback(
    async (newPoem: Poem) => {
      if (repo) {
        await repo.savePoem(newPoem);
        const updatedPoems = await repo.getAllPoems();
        setPoems(updatedPoems);
        setActivePoem(newPoem);
      } else {
        setPoems((prev) => [newPoem, ...prev]);
        setActivePoem(newPoem);
      }
      setActiveTab("player");
    },
    [repo]
  );

  const handleUpdateBoundary = useCallback(
    async (
      alignmentId: string,
      startMs: number,
      endMs: number,
      status: AlignmentStatus = "reviewed"
    ) => {
      if (!repo || !activePoem) return;
      const verse = activePoem.verses.find((item) => item.alignment?.id === alignmentId);
      if (!verse?.alignment) throw new Error("تعذر العثور على محاذاة البيت.");
      const recording = activePoem.recordings.find((item) => item.id === verse.alignment?.recordingId);
      const index = activePoem.verses.findIndex((item) => item.id === verse.id);
      const previous = index > 0 ? activePoem.verses[index - 1]?.alignment : undefined;
      const next = activePoem.verses[index + 1]?.alignment;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs + 300) {
        throw new Error("يجب أن تكون حدود البيت صحيحة ومدة البيت أكثر من 300 مللي ثانية.");
      }
      if (recording && endMs > recording.durationMs) {
        throw new Error("نهاية البيت تتجاوز مدة التسجيل.");
      }
      if (previous?.recordingId === verse.alignment.recordingId && startMs < previous.endMs) {
        throw new Error("بداية البيت تتداخل مع البيت السابق.");
      }
      if (next?.recordingId === verse.alignment.recordingId && endMs > next.startMs) {
        throw new Error("نهاية البيت تتداخل مع البيت التالي.");
      }
      await repo.updateAlignmentBoundary(alignmentId, startMs, endMs, status);
      const refreshed = await repo.getPoemById(activePoem.id);
      if (refreshed) {
        setActivePoem(refreshed);
        setPoems((prev) =>
          prev.map((p) => (p.id === refreshed.id ? refreshed : p))
        );
      }
    },
    [repo, activePoem]
  );

  const handleCreateBoundary = useCallback(
    async (verseId: string, startMs: number, endMs: number) => {
      if (!repo || !activePoem) throw new Error("لا توجد قاعدة بيانات نشطة.");
      const verse = activePoem.verses.find((item) => item.id === verseId);
      if (!verse) throw new Error("تعذر العثور على البيت.");
      if (verse.alignment) throw new Error("هذا البيت محاذى بالفعل.");
      const recording =
        activePoem.recordings.find((item) => item.id === activePoem.defaultRecordingId) ||
        activePoem.recordings[0];
      if (!recording) throw new Error("لا يوجد تسجيل صوتي لهذه القصيدة.");
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs + 300) {
        throw new Error("يجب أن تكون حدود البيت صحيحة ومدة البيت أكثر من 300 مللي ثانية.");
      }
      if (recording.durationMs > 0 && endMs > recording.durationMs) {
        throw new Error("نهاية البيت تتجاوز مدة التسجيل.");
      }
      await repo.saveAlignment({
        id: `align-manual-${verseId}-${Date.now()}`,
        verseId,
        recordingId: recording.id,
        startMs: Math.round(startMs),
        endMs: Math.round(endMs),
        confidence: 1.0,
        status: "manual",
      });
      const refreshed = await repo.getPoemById(activePoem.id);
      if (refreshed) {
        setActivePoem(refreshed);
        setPoems((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
    },
    [repo, activePoem]
  );

  const handleSaveExplanations = useCallback(
    async (verseId: string, items: VerseExplanationItem[]) => {
      if (repo) await repo.saveVerseExplanations(verseId, items);
      const mergeExplanations = (poem: Poem) => ({
        ...poem,
        verses: poem.verses.map((verse) =>
          verse.id === verseId ? { ...verse, explanations: items } : verse
        ),
      });
      setPoems((current) =>
        current.map((poem) => (poem.verses.some((verse) => verse.id === verseId) ? mergeExplanations(poem) : poem))
      );
    },
    [repo]
  );

  const handleApplyOffset = useCallback(
    async (verseId: string, offsetMs: number, includeFollowing: boolean) => {
      if (!repo || !activePoem) return;
      if (!Number.isFinite(offsetMs) || offsetMs === 0) {
        throw new Error("مقدار الانزياح يجب أن يكون رقمًا غير صفري.");
      }
      const startIndex = activePoem.verses.findIndex((verse) => verse.id === verseId);
      if (startIndex < 0) throw new Error("تعذر العثور على البيت المحدد.");
      const selectedVerse = activePoem.verses[startIndex];
      const sourceRecordingId = selectedVerse.alignment?.recordingId;
      if (!sourceRecordingId) throw new Error("لا توجد محاذاة مرتبطة بالتسجيل لهذا البيت.");
      const affected = activePoem.verses.filter((verse, index) =>
        Boolean(
          verse.alignment
          && verse.alignment.recordingId === sourceRecordingId
          && (index === startIndex || (includeFollowing && index >= startIndex))
        )
      );
      const recording = activePoem.recordings.find((item) => item.id === sourceRecordingId);
      const updates = affected.map((verse) => {
        const alignment = verse.alignment!;
        const startMs = Math.round(alignment.startMs + offsetMs);
        const endMs = Math.round(alignment.endMs + offsetMs);
        if (startMs < 0 || endMs <= startMs + 300 || (recording && endMs > recording.durationMs)) {
          throw new Error(`التصحيح يجعل توقيت البيت ${verse.orderIndex} خارج حدود التسجيل.`);
        }
        return { id: alignment.id, startMs, endMs };
      });
      const updatedBounds = new Map(updates.map((update) => [update.id, update]));
      const recordingVerses = activePoem.verses.filter(
        (verse) => verse.alignment?.recordingId === sourceRecordingId
      );
      for (let index = 1; index < recordingVerses.length; index++) {
        const previous = recordingVerses[index - 1].alignment!;
        const current = recordingVerses[index].alignment!;
        const previousEnd = updatedBounds.get(previous.id)?.endMs ?? previous.endMs;
        const currentStart = updatedBounds.get(current.id)?.startMs ?? current.startMs;
        if (currentStart < previousEnd) {
          throw new Error("التصحيح يسبب تداخلاً بين حدود الأبيات.");
        }
      }
      for (const update of updates) {
        await repo.updateAlignmentBoundary(update.id, update.startMs, update.endMs, "manual");
      }
      const refreshed = await repo.getPoemById(activePoem.id);
      if (refreshed) {
        setActivePoem(refreshed);
        setPoems((current) => current.map((poem) => poem.id === refreshed.id ? refreshed : poem));
      }
    },
    [repo, activePoem]
  );

  const handleDeleteVerse = useCallback(
    async (verseId: string) => {
      if (!activePoem) return;
      if (repo) {
        await repo.deleteVerse(activePoem.id, verseId);
        const refreshed = await repo.getPoemById(activePoem.id);
        if (refreshed) {
          setActivePoem(refreshed);
          setPoems((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
        }
      } else {
        const remaining = activePoem.verses
          .filter((v) => v.id !== verseId)
          .map((v, idx) => ({ ...v, orderIndex: idx + 1 }));
        const updated: Poem = { ...activePoem, verses: remaining, versesCount: remaining.length };
        setActivePoem(updated);
        setPoems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    },
    [repo, activePoem]
  );

  const handleDeletePoem = useCallback(
    async (poemId: string) => {
      if (repo) {
        await repo.deletePoem(poemId);
        const updatedPoems = await repo.getAllPoems();
        setPoems(updatedPoems);
        if (activePoem?.id === poemId) {
          setActivePoem(updatedPoems[0] || null);
          setActiveTab("library");
        }
      } else {
        setPoems((prev) => prev.filter((p) => p.id !== poemId));
        if (activePoem?.id === poemId) {
          setActivePoem(null);
          setActiveTab("library");
        }
      }
    },
    [repo, activePoem]
  );

  return (
    <div className="h-screen w-screen flex bg-[#080A0E] text-[#F8F9FA] overflow-hidden select-none min-w-[900px] min-h-[600px] font-sans">
      {/* Right-side RTL Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasActivePoem={activePoem !== null}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-200 relative">
        <Header
          activeTab={activeTab}
          activePoem={activePoem}
          onBackToLibrary={() => setActiveTab("library")}
        />

        <main className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-ink-600 font-poetry text-xl animate-pulse">
              جاري تحميل ديوان الشعر...
            </div>
          ) : (
            <>
              {activeTab === "library" && (
                <LibraryView
                  poems={poems}
                  onOpenPoem={handleOpenPoem}
                  onNavigateToImport={() => setActiveTab("import")}
                  onDeletePoem={handleDeletePoem}
                />
              )}

              {activeTab === "player" && activePoem && (
                <PoemPlayerView
                  poem={activePoem}
                  onUpdateBoundary={handleUpdateBoundary}
                  onCreateBoundary={handleCreateBoundary}
                  onSaveExplanations={handleSaveExplanations}
                  onApplyOffset={handleApplyOffset}
                  onDeleteVerse={handleDeleteVerse}
                />
              )}

              {activeTab === "editor" && activePoem && (
                <BoundaryReviewEditor
                  poem={activePoem}
                  onUpdateBoundary={handleUpdateBoundary}
                  onSelectPoem={(id) => {
                    const p = poems.find((x) => x.id === id);
                    if (p) setActivePoem(p);
                  }}
                />
              )}

              {activeTab === "import" && (
                <ImportView onImportPoem={handleImportPoem} />
              )}

              {activeTab === "settings" && <SettingsView />}
            </>
          )}
        </main>

        {/* Persistent mini player: visible whenever a poem is loaded but the
            full player view isn't showing (e.g. browsing the library while
            a poem keeps playing in the background). */}
        {activeTab !== "player" && currentPoem && (
          <MiniPlayer
            poem={currentPoem}
            playerState={playerState}
            onTogglePlay={() => controller.togglePlay()}
            onExpand={() => {
              setActivePoem(currentPoem);
              setActiveTab("player");
            }}
            onClose={clearPoem}
          />
        )}
      </div>
    </div>
  );
}

export default App;
