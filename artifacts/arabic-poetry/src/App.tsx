import { useState, useEffect, useCallback } from "react";
import { ActiveTab, Playlist, Poem, Verse, VerseExplanationItem, VerseSegmentationSuggestion } from "./types";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { MiniPlayer } from "./components/MiniPlayer";
import { LibraryView } from "./features/library/LibraryView";
import { PoemPlayerView } from "./features/player/PoemPlayerView";
import { ImportView } from "./features/import/ImportView";
import { SettingsView } from "./features/settings/SettingsView";
import { PlaylistsView } from "./features/playlists/PlaylistsView";
import { PlaylistDetailView } from "./features/playlists/PlaylistDetailView";
import { AddToPlaylistModal } from "./features/playlists/AddToPlaylistModal";
import { DiwanRepository } from "./lib/db/repository";
import { normalizeArabic } from "./lib/utils";
import { ParsedExplanationBlock } from "./lib/import/pasteExplanationParser";
import { AudioPlayerProvider, useAudioPlayerContext } from "./contexts/AudioPlayerContext";
import { ImportQueueProvider, useImportQueueContext } from "./contexts/ImportQueueContext";
import { ImportQueueTray } from "./components/ImportQueueTray";

export function App() {
  return (
    <AudioPlayerProvider>
      <ImportQueueProvider>
        <AppShell />
      </ImportQueueProvider>
    </AudioPlayerProvider>
  );
}

function AppShell() {
  const [repo, setRepo] = useState<DiwanRepository | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [activePoem, setActivePoem] = useState<Poem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [addToPlaylistPoems, setAddToPlaylistPoems] = useState<Poem[] | null>(null);
  const {
    controller,
    playerState,
    currentPoem,
    clearPoem,
    loadQueue,
    activePlaylistId,
    queueIndex,
    hasQueue,
    shuffle,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
    playNextInQueue,
    playPreviousInQueue,
  } = useAudioPlayerContext();
  const { subscribeToCompletion } = useImportQueueContext();

  // Initialize DB and load initial data
  useEffect(() => {
    let isMounted = true;

    async function initDb() {
      try {
        const repository = await DiwanRepository.create();
        if (!isMounted) return;
        setRepo(repository);

        let loadedPoems = await repository.getAllPoems();
        // If legacy demo poems (poem-1, poem-2, poem-3) are present in the local database,
        // purge them so the user starts with a clean empty state as requested.
        const legacyDemoIds = ["poem-1", "poem-2", "poem-3"];
        const hasLegacyDemos = loadedPoems.some((p) => legacyDemoIds.includes(p.id));
        if (hasLegacyDemos) {
          for (const demoId of legacyDemoIds) {
            await repository.deletePoem(demoId);
          }
          loadedPoems = await repository.getAllPoems();
        }

        const loadedPlaylists = await repository.getAllPlaylists();

        if (isMounted) {
          setPoems(loadedPoems);
          setPlaylists(loadedPlaylists);
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

  // A background queue job (started from the import wizard) can finish
  // while the wizard itself is no longer mounted, so refresh the poems list
  // here at the app root whenever a poem_import job completes. The queue
  // context saves the poem through its own repository instance (the
  // WebMemoryAdapter's browser fallback only reflects writes it made itself
  // in-memory, only syncing through localStorage), so re-fetch through a
  // freshly created repository rather than AppShell's own possibly-stale
  // `repo` instance.
  useEffect(() => {
    const unsubscribe = subscribeToCompletion((job) => {
      if (job.jobType !== "poem_import" || job.status !== "completed") return;
      DiwanRepository.create().then(async (freshRepo) => {
        const updatedPoems = await freshRepo.getAllPoems();
        setPoems(updatedPoems);
      });
    });
    return unsubscribe;
  }, [subscribeToCompletion]);

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

  const handleApplySegmentationSuggestions = useCallback(
    async (accepted: VerseSegmentationSuggestion[]) => {
      if (!activePoem || accepted.length === 0) return;

      if (repo) {
        for (const suggestion of accepted) {
          if (suggestion.kind === "hemistich_split") {
            const [verseId] = suggestion.verseIds;
            const [target] = suggestion.suggested;
            await repo.updateVerseText(verseId, target.firstHemistich, target.secondHemistich);
          } else if (suggestion.kind === "merge_verses") {
            const [keepId, removeId] = suggestion.verseIds;
            const [target] = suggestion.suggested;
            await repo.mergeVerses(activePoem.id, keepId, removeId, target.firstHemistich, target.secondHemistich);
          } else if (suggestion.kind === "split_verse") {
            const [verseId] = suggestion.verseIds;
            const [first, second] = suggestion.suggested;
            await repo.splitVerse(activePoem.id, verseId, first, second);
          }
        }
        const refreshed = await repo.getPoemById(activePoem.id);
        if (refreshed) {
          setActivePoem(refreshed);
          setPoems((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
        }
        return;
      }

      // In-memory fallback (no repo yet) — mirror the same transformations
      // directly on the poem's verse array, keeping order_index contiguous.
      let verses = [...activePoem.verses].sort((a, b) => a.orderIndex - b.orderIndex);
      for (const suggestion of accepted) {
        if (suggestion.kind === "hemistich_split") {
          const [verseId] = suggestion.verseIds;
          const [target] = suggestion.suggested;
          const text = `${target.firstHemistich} ${target.secondHemistich}`.trim();
          verses = verses.map((v) =>
            v.id === verseId
              ? { ...v, firstHemistich: target.firstHemistich, secondHemistich: target.secondHemistich, text, normalizedText: normalizeArabic(text) }
              : v
          );
        } else if (suggestion.kind === "merge_verses") {
          const [keepId, removeId] = suggestion.verseIds;
          const [target] = suggestion.suggested;
          const text = `${target.firstHemistich} ${target.secondHemistich}`.trim();
          verses = verses
            .filter((v) => v.id !== removeId)
            .map((v) =>
              v.id === keepId
                ? { ...v, firstHemistich: target.firstHemistich, secondHemistich: target.secondHemistich, text, normalizedText: normalizeArabic(text) }
                : v
            )
            .map((v, idx) => ({ ...v, orderIndex: idx + 1 }));
        } else if (suggestion.kind === "split_verse") {
          const [verseId] = suggestion.verseIds;
          const [first, second] = suggestion.suggested;
          const firstText = `${first.firstHemistich} ${first.secondHemistich}`.trim();
          const secondText = `${second.firstHemistich} ${second.secondHemistich}`.trim();
          const next: Verse[] = [];
          verses.forEach((v) => {
            if (v.id === verseId) {
              next.push({ ...v, firstHemistich: first.firstHemistich, secondHemistich: first.secondHemistich, text: firstText, normalizedText: normalizeArabic(firstText) });
              next.push({
                // See repository.ts splitVerse for why a random suffix is
                // required alongside Date.now(): accepting multiple
                // split_verse suggestions in one batch can otherwise produce
                // colliding ids within the same millisecond.
                id: `${verseId}-split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                poemId: v.poemId,
                orderIndex: 0,
                text: secondText,
                normalizedText: normalizeArabic(secondText),
                firstHemistich: second.firstHemistich,
                secondHemistich: second.secondHemistich,
              });
            } else {
              next.push(v);
            }
          });
          verses = next.map((v, idx) => ({ ...v, orderIndex: idx + 1 }));
        }
      }
      const updated: Poem = { ...activePoem, verses, versesCount: verses.length };
      setActivePoem(updated);
      setPoems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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

  const refreshPlaylists = useCallback(async () => {
    if (!repo) return;
    const updated = await repo.getAllPlaylists();
    setPlaylists(updated);
    return updated;
  }, [repo]);

  const handleDeletePoem = useCallback(
    async (poemId: string) => {
      if (repo) {
        await repo.deletePoem(poemId);
        const updatedPoems = await repo.getAllPoems();
        setPoems(updatedPoems);
        if (activePoem?.id === poemId) {
          setActivePoem(updatedPoems[0] || null);
          if (updatedPoems.length === 0) {
            setActiveTab("library");
          }
        }
      } else {
        setPoems((prev) => prev.filter((p) => p.id !== poemId));
        if (activePoem?.id === poemId) {
          setActivePoem(null);
          setActiveTab("library");
        }
      }
      if (currentPoem?.id === poemId) {
        clearPoem();
      }
      await refreshPlaylists();
    },
    [repo, activePoem, currentPoem, clearPoem, refreshPlaylists]
  );

  const handleBulkDeletePoems = useCallback(
    async (poemIds: string[]) => {
      if (repo) {
        await repo.deletePoems(poemIds);
        const updatedPoems = await repo.getAllPoems();
        setPoems(updatedPoems);
        if (activePoem && poemIds.includes(activePoem.id)) {
          setActivePoem(updatedPoems[0] || null);
          if (updatedPoems.length === 0) {
            setActiveTab("library");
          }
        }
      } else {
        setPoems((prev) => prev.filter((p) => !poemIds.includes(p.id)));
        if (activePoem && poemIds.includes(activePoem.id)) {
          setActivePoem(null);
          setActiveTab("library");
        }
      }
      if (currentPoem && poemIds.includes(currentPoem.id)) {
        clearPoem();
      }
      await refreshPlaylists();
    },
    [repo, activePoem, currentPoem, clearPoem, refreshPlaylists]
  );

  const handleDeleteAllPoems = useCallback(async () => {
    if (repo) {
      await repo.deleteAllPoems();
      const updatedPoems = await repo.getAllPoems();
      setPoems(updatedPoems);
    } else {
      setPoems([]);
    }
    setActivePoem(null);
    clearPoem();
    setActiveTab("library");
    await refreshPlaylists();
  }, [repo, clearPoem, refreshPlaylists]);

  const handleOpenPlaylist = useCallback(
    (playlist: Playlist) => {
      setActivePlaylist(playlist);
      setActiveTab("playlists");
    },
    []
  );

  const handleCreatePlaylist = useCallback(
    async (name: string) => {
      if (!repo) return;
      await repo.createPlaylist(name);
      await refreshPlaylists();
    },
    [repo, refreshPlaylists]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId: string) => {
      if (!repo) return;
      await repo.deletePlaylist(playlistId);
      if (activePlaylist?.id === playlistId) setActivePlaylist(null);
      await refreshPlaylists();
    },
    [repo, activePlaylist, refreshPlaylists]
  );

  const handleRenamePlaylist = useCallback(
    async (playlistId: string, name: string) => {
      if (!repo) return;
      await repo.renamePlaylist(playlistId, name);
      const updated = await refreshPlaylists();
      const refreshed = updated?.find((p) => p.id === playlistId) || null;
      if (refreshed) setActivePlaylist(refreshed);
    },
    [repo, refreshPlaylists]
  );

  const handleAddPoemsToPlaylist = useCallback(
    async (playlistId: string, poemIds: string[]) => {
      if (!repo) return;
      for (const poemId of poemIds) {
        await repo.addPoemToPlaylist(playlistId, poemId);
      }
      const updated = await refreshPlaylists();
      const refreshed = updated?.find((p) => p.id === playlistId) || null;
      if (refreshed && activePlaylist?.id === playlistId) setActivePlaylist(refreshed);
      setAddToPlaylistPoems(null);
    },
    [repo, refreshPlaylists, activePlaylist]
  );

  const handleCreatePlaylistAndAddPoems = useCallback(
    async (name: string, poemIds: string[]) => {
      if (!repo) return;
      const created = await repo.createPlaylist(name);
      for (const poemId of poemIds) {
        await repo.addPoemToPlaylist(created.id, poemId);
      }
      await refreshPlaylists();
      setAddToPlaylistPoems(null);
    },
    [repo, refreshPlaylists]
  );

  const handleRemovePoemFromPlaylist = useCallback(
    async (playlistId: string, poemId: string) => {
      if (!repo) return;
      await repo.removePoemFromPlaylist(playlistId, poemId);
      const updated = await refreshPlaylists();
      const refreshed = updated?.find((p) => p.id === playlistId) || null;
      if (refreshed) setActivePlaylist(refreshed);
    },
    [repo, refreshPlaylists]
  );

  const handleReorderPlaylist = useCallback(
    async (playlistId: string, orderedPoemIds: string[]) => {
      if (!repo) return;
      await repo.reorderPlaylistPoems(playlistId, orderedPoemIds);
      const updated = await refreshPlaylists();
      const refreshed = updated?.find((p) => p.id === playlistId) || null;
      if (refreshed) setActivePlaylist(refreshed);
    },
    [repo, refreshPlaylists]
  );

  const getPlaylistPoems = useCallback(
    (playlist: Playlist): Poem[] => {
      return playlist.poemIds
        .map((id) => poems.find((p) => p.id === id))
        .filter((p): p is Poem => Boolean(p));
    },
    [poems]
  );

  const handlePlayPlaylistFromIndex = useCallback(
    (playlist: Playlist, index: number) => {
      const orderedPoems = getPlaylistPoems(playlist);
      if (orderedPoems.length === 0) return;
      loadQueue(orderedPoems, index, playlist.id);
    },
    [getPlaylistPoems, loadQueue]
  );

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-charcoal-950 text-parchment-100 overflow-hidden font-sans selection:bg-accent-700/30 selection:text-accent-500">
      {/* Right-side RTL Navigation (Sidebar on Desktop, Bottom bar on Mobile) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasActivePoem={activePoem !== null}
        poemsCount={poems.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-charcoal-900 relative">
        <Header
          activeTab={activeTab}
          activePoem={activePoem}
          onBackToLibrary={() => setActiveTab("library")}
        />

        <main className="flex-1 overflow-hidden relative pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:pb-0">
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
                  onBulkDeletePoems={handleBulkDeletePoems}
                  onAddToPlaylist={(poem) => setAddToPlaylistPoems([poem])}
                  onBulkAddToPlaylist={(selectedPoems) => setAddToPlaylistPoems(selectedPoems)}
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
                  onApplySegmentationSuggestions={handleApplySegmentationSuggestions}
                />
              )}

              {activeTab === "import" && (
                <ImportView onImportPoem={handleImportPoem} />
              )}

              {activeTab === "playlists" && !activePlaylist && (
                <PlaylistsView
                  playlists={playlists}
                  onOpenPlaylist={handleOpenPlaylist}
                  onCreatePlaylist={handleCreatePlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                />
              )}

              {activeTab === "playlists" && activePlaylist && (
                <PlaylistDetailView
                  playlist={activePlaylist}
                  poems={getPlaylistPoems(activePlaylist)}
                  isPlayingThisPlaylist={activePlaylistId === activePlaylist.id}
                  isPlaying={playerState.isPlaying}
                  currentPoemId={currentPoem?.id}
                  shuffle={shuffle}
                  repeatMode={repeatMode}
                  onBack={() => setActivePlaylist(null)}
                  onPlayFromIndex={(index) => handlePlayPlaylistFromIndex(activePlaylist, index)}
                  onTogglePlay={() => controller.togglePlay()}
                  onToggleShuffle={toggleShuffle}
                  onCycleRepeatMode={cycleRepeatMode}
                  onRemovePoem={(poemId) => handleRemovePoemFromPlaylist(activePlaylist.id, poemId)}
                  onReorder={(orderedPoemIds) => handleReorderPlaylist(activePlaylist.id, orderedPoemIds)}
                  onRenamePlaylist={(name) => handleRenamePlaylist(activePlaylist.id, name)}
                />
              )}

              {activeTab === "settings" && (
                <SettingsView
                  poemsCount={poems.length}
                  onDeleteAllPoems={handleDeleteAllPoems}
                />
              )}
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
            hasQueue={hasQueue}
            queueIndex={queueIndex}
            shuffle={shuffle}
            repeatMode={repeatMode}
            onNext={playNextInQueue}
            onPrevious={playPreviousInQueue}
            onToggleShuffle={toggleShuffle}
            onCycleRepeatMode={cycleRepeatMode}
          />
        )}
      </div>

      {addToPlaylistPoems && addToPlaylistPoems.length > 0 && (
        <AddToPlaylistModal
          poems={addToPlaylistPoems}
          playlists={playlists}
          onClose={() => setAddToPlaylistPoems(null)}
          onAddToExisting={(playlistId) =>
            handleAddPoemsToPlaylist(
              playlistId,
              addToPlaylistPoems.map((p) => p.id)
            )
          }
          onCreateAndAdd={(name) =>
            handleCreatePlaylistAndAddPoems(
              name,
              addToPlaylistPoems.map((p) => p.id)
            )
          }
        />
      )}

      <ImportQueueTray />
    </div>
  );
}

export default App;
