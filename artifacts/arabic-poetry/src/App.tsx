import { useState, useEffect, useCallback } from "react";
import { ActiveTab, Poem, VerseExplanationItem } from "./types";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { MiniPlayer } from "./components/MiniPlayer";
import { LibraryView } from "./features/library/LibraryView";
import { PoemPlayerView } from "./features/player/PoemPlayerView";
import { ImportView } from "./features/import/ImportView";
import { SettingsView } from "./features/settings/SettingsView";
import { DiwanRepository } from "./lib/db/repository";
import { normalizeArabic } from "./lib/utils";
import { ParsedExplanationBlock } from "./lib/import/pasteExplanationParser";
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

  const handleChangeCoverImage = useCallback(
    async (coverImageUrl: string | null) => {
      if (!activePoem) return;
      if (repo) await repo.updatePoemCoverImage(activePoem.id, coverImageUrl);
      const updated: Poem = { ...activePoem, coverImageUrl: coverImageUrl || undefined };
      setActivePoem(updated);
      setPoems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [repo, activePoem]
  );

  const handleImportExplanations = useCallback(
    async (blocks: ParsedExplanationBlock[]) => {
      if (!activePoem) return;
      if (repo) {
        for (const block of blocks) {
          await repo.saveVerseExplanations(block.verseId, block.items);
        }
        const refreshed = await repo.getPoemById(activePoem.id);
        if (refreshed) {
          setActivePoem(refreshed);
          setPoems((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
        }
      } else {
        const byVerseId = new Map(blocks.map((b) => [b.verseId, b.items]));
        const updated: Poem = {
          ...activePoem,
          verses: activePoem.verses.map((v) =>
            byVerseId.has(v.id) ? { ...v, explanations: [...(v.explanations || []), ...byVerseId.get(v.id)!] } : v
          ),
        };
        setActivePoem(updated);
        setPoems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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

  const handleEditVerse = useCallback(
    async (verseId: string, firstHemistich: string, secondHemistich: string) => {
      if (!activePoem) return;
      const trimmedFirst = firstHemistich.trim();
      const trimmedSecond = secondHemistich.trim();
      if (!trimmedFirst || !trimmedSecond) {
        throw new Error("لا يمكن ترك شطر البيت فارغًا.");
      }
      if (repo) {
        await repo.updateVerseText(verseId, trimmedFirst, trimmedSecond);
        const refreshed = await repo.getPoemById(activePoem.id);
        if (refreshed) {
          setActivePoem(refreshed);
          setPoems((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
        }
      } else {
        const text = `${trimmedFirst} ${trimmedSecond}`.trim();
        const updated: Poem = {
          ...activePoem,
          verses: activePoem.verses.map((v) =>
            v.id === verseId
              ? { ...v, firstHemistich: trimmedFirst, secondHemistich: trimmedSecond, text, normalizedText: normalizeArabic(text) }
              : v
          ),
        };
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
        poemsCount={poems.length}
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
                  onSaveExplanations={handleSaveExplanations}
                  onChangeCoverImage={handleChangeCoverImage}
                  onDeleteVerse={handleDeleteVerse}
                  onEditVerse={handleEditVerse}
                  onImportExplanations={handleImportExplanations}
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
