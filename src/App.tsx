import { useState, useEffect, useCallback } from "react";
import { ActiveTab, Poem, AlignmentStatus } from "./types";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { LibraryView } from "./features/library/LibraryView";
import { PoemPlayerView } from "./features/player/PoemPlayerView";
import { BoundaryReviewEditor } from "./features/editor/BoundaryReviewEditor";
import { ImportView } from "./features/import/ImportView";
import { SettingsView } from "./features/settings/SettingsView";
import { DiwanRepository } from "./lib/db/repository";

export function App() {
  const [repo, setRepo] = useState<DiwanRepository | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [activePoem, setActivePoem] = useState<Poem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="h-screen w-screen flex bg-charcoal-950 text-parchment-100 overflow-hidden select-none min-w-[900px] min-h-[600px]">
      {/* Right-side RTL Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasActivePoem={activePoem !== null}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-charcoal-950">
        <Header
          activeTab={activeTab}
          activePoem={activePoem}
          onBackToLibrary={() => setActiveTab("library")}
        />

        <main className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-gold-400 font-poetry text-lg">
              جاري تحميل ديوان الشعر...
            </div>
          ) : (
            <>
              {activeTab === "library" && (
                <LibraryView
                  poems={poems}
                  onOpenPoem={handleOpenPoem}
                  onNavigateToImport={() => setActiveTab("import")}
                />
              )}

              {activeTab === "player" && activePoem && (
                <PoemPlayerView
                  poem={activePoem}
                  onUpdateBoundary={handleUpdateBoundary}
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
      </div>
    </div>
  );
}

export default App;
