import React, { useCallback, useEffect, useRef, useState } from "react";
import { Poem, Verse, VerseExplanationItem, VerseSegmentationSuggestion, WordDefinition } from "@/types";
import { VerseExplanationStatus, VerseItem } from "./VerseItem";
import { AudioControlsBar } from "./AudioControlsBar";
import { PoemMetadataDrawer } from "./PoemMetadataDrawer";
import { DictionaryWordModal } from "./DictionaryWordModal";
import { VerseExplanationModal } from "./VerseExplanationModal";
import { ImportExplanationModal } from "./ImportExplanationModal";
import { FocusModeView } from "./FocusModeView";
import { VerseShareModal } from "./VerseShareModal";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import { Info, BookOpen, AlertCircle, Maximize2, ClipboardPaste, Keyboard } from "lucide-react";
import { ParsedExplanationBlock } from "@/lib/import/pasteExplanationParser";
import { analyzeVerseMeter } from "@/lib/arud/meterDetector";
import { DiwanRepository } from "@/lib/db/repository";
import { MizanAlArabProvider } from "@/lib/providers/MizanAlArabProvider";

interface PoemPlayerViewProps {
  poem: Poem;
  onSaveExplanations?: (verseId: string, items: VerseExplanationItem[]) => Promise<void>;
  onChangeCoverImage?: (coverImageUrl: string | null) => Promise<void> | void;
  onDeleteVerse?: (verseId: string) => Promise<void> | void;
  onEditVerse?: (verseId: string, firstHemistich: string, secondHemistich: string) => Promise<void> | void;
  onImportExplanations?: (blocks: ParsedExplanationBlock[]) => Promise<void> | void;
  onApplySegmentationSuggestions?: (accepted: VerseSegmentationSuggestion[]) => Promise<void> | void;
  onMarkVerseBoundary?: (verseId: string, boundaryMs: number) => Promise<void> | void;
  onOpenShortcutsHelp?: () => void;
}

interface ExplanationViewState {
  status: VerseExplanationStatus;
  items: VerseExplanationItem[];
  error: string | null;
}

export const PoemPlayerView: React.FC<PoemPlayerViewProps> = ({
  poem,
  onSaveExplanations,
  onChangeCoverImage,
  onDeleteVerse,
  onEditVerse,
  onImportExplanations,
  onApplySegmentationSuggestions,
  onMarkVerseBoundary,
  onOpenShortcutsHelp,
}) => {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [explanationModalVerseId, setExplanationModalVerseId] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showImportExplanation, setShowImportExplanation] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDefinition, setWordDefinition] = useState<WordDefinition | null>(null);
  const [isLoadingWord, setIsLoadingWord] = useState(false);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [shareVerseIndex, setShareVerseIndex] = useState<number | null>(null);
  const [explanationStates, setExplanationStates] = useState<Record<string, ExplanationViewState>>({});

  const verseElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const explanationRequestRef = useRef(0);
  const mizanProviderRef = useRef<MizanAlArabProvider | null>(null);

  const {
    isPlaying,
    currentTimeMs,
    durationMs,
    playbackRate,
    volume,
    activeVerseIndex,
    activeVerse,
    errorMessage,
    isUserScrolling,
    handleUserScroll,
    togglePlay,
    seekTo,
    seekToVerse,
    nextVerse,
    prevVerse,
    setPlaybackRate,
    setVolume,
  } = usePoemPlayback(poem);

  const lastScrolledVerseIdRef = useRef<string | null>(null);

  const getMizanProvider = () => {
    if (!mizanProviderRef.current) mizanProviderRef.current = new MizanAlArabProvider();
    return mizanProviderRef.current;
  };

  const loadExplanation = useCallback(async (verse: Verse) => {
    const cached = verse.explanations || [];
    if (cached.length > 0) {
      setExplanationStates((previous) => ({
        ...previous,
        [verse.id]: { status: "loaded", items: cached, error: null },
      }));
      return;
    }

    if (!verse.externalId || poem.externalProvider !== "mizan_al_arab") {
      setExplanationStates((previous) => ({
        ...previous,
        [verse.id]: {
          status: verse.explanation ? "loaded" : "empty",
          items: [],
          error: null,
        },
      }));
      return;
    }

    const requestId = ++explanationRequestRef.current;
    setExplanationStates((previous) => ({
      ...previous,
      [verse.id]: { status: "loading", items: [], error: null },
    }));

    try {
      const items = await getMizanProvider().fetchExplanations(verse.externalId);
      if (requestId !== explanationRequestRef.current) return;
      setExplanationStates((previous) => ({
        ...previous,
        [verse.id]: {
          status: items.length > 0 ? "loaded" : "empty",
          items,
          error: null,
        },
      }));
      if (onSaveExplanations && items.length > 0) {
        await onSaveExplanations(verse.id, items);
      }
    } catch (err: unknown) {
      if (requestId !== explanationRequestRef.current) return;
      const error = err as Error;
      setExplanationStates((previous) => ({
        ...previous,
        [verse.id]: {
          status: "error",
          items: [],
          error: error.message || "تعذر جلب الشرح من ميزان العرب",
        },
      }));
    }
  }, [poem.externalProvider, onSaveExplanations]);

  useEffect(() => {
    if (!isUserScrolling && activeVerse && containerRef.current) {
      if (lastScrolledVerseIdRef.current === activeVerse.id) {
        return;
      }
      lastScrolledVerseIdRef.current = activeVerse.id;

      const verseEl = verseElementsRef.current.get(activeVerse.id);
      if (verseEl && typeof verseEl.scrollIntoView === "function") {
        verseEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeVerse, isUserScrolling]);

  const handleVerseSelect = (verse: Verse) => {
    setSelectedVerseId(verse.id);
    loadExplanation(verse);
  };

  // Row navigation (Up/Down) moves which verse row is *selected* for
  // editing/inspection, distinct from the Left/Right shortcuts in
  // usePoemPlayback which seek playback to the previous/next verse. Save an
  // in-progress edit (Ctrl+Enter) and cancel it (Esc) are handled locally
  // inside VerseItem, next to the state they act on. Marking a boundary (B)
  // needs the current playback time, so it's handled here.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "ArrowDown" || e.code === "ArrowUp") {
        if (poem.verses.length === 0) return;
        e.preventDefault();
        const currentIndex = selectedVerseId
          ? poem.verses.findIndex((v) => v.id === selectedVerseId)
          : -1;
        let nextIndex: number;
        if (e.code === "ArrowDown") {
          nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, poem.verses.length - 1);
        } else {
          nextIndex = currentIndex < 0 ? poem.verses.length - 1 : Math.max(currentIndex - 1, 0);
        }
        const nextVerseRow = poem.verses[nextIndex];
        handleVerseSelect(nextVerseRow);
        const el = verseElementsRef.current.get(nextVerseRow.id);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (e.code === "KeyB") {
        if (!onMarkVerseBoundary || !activeVerse) return;
        e.preventDefault();
        onMarkVerseBoundary(activeVerse.id, currentTimeMs);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poem.verses, selectedVerseId, activeVerse, currentTimeMs, onMarkVerseBoundary]);

  const handleRetryExplanation = (verse: Verse) => {
    loadExplanation(verse);
  };

  const handleOpenExplanation = (verse: Verse) => {
    setSelectedVerseId(verse.id);
    setExplanationModalVerseId(verse.id);
    loadExplanation(verse);
  };

  const handleDeleteVerse = async (verse: Verse) => {
    if (!onDeleteVerse) return;
    await onDeleteVerse(verse.id);
    if (selectedVerseId === verse.id) setSelectedVerseId(null);
    if (explanationModalVerseId === verse.id) setExplanationModalVerseId(null);
  };

  const handleWordClick = async (word: string) => {
    setSelectedWord(word);
    setIsLoadingWord(true);
    try {
      const repo = await DiwanRepository.create();
      const def = await repo.getWordDefinition(word);
      setWordDefinition(def);
    } catch {
      setWordDefinition(null);
    } finally {
      setIsLoadingWord(false);
    }
  };

  const meterInfo = analyzeVerseMeter(
    poem.verses[0]?.firstHemistich || "",
    poem.verses[0]?.secondHemistich || "",
    poem.bahr
  );

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden relative pb-[env(safe-area-inset-bottom)]">
      {/* Header bar within Player */}
      <div className="px-4 md:px-8 py-4 border-b border-white/5 bg-charcoal-900/90 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10 shadow-sm">
        <div className="min-w-0 flex-1">
          <h2 className="font-poetry text-2xl md:text-3xl font-bold text-parchment-100 truncate">
            {poem.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-sans text-ink-500">
            <span className="text-parchment-100 font-bold">{poem.poet.name}</span>
            <span className="text-white/20">•</span>
            <span>بحر {poem.bahr} <strong className="text-accent-700">({meterInfo.pattern})</strong></span>
            <span className="text-white/20">•</span>
            <span>الرويّ: <strong className="text-parchment-100">{meterInfo.rawiyy}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 font-sans">
          {onOpenShortcutsHelp && (
            <button
              onClick={onOpenShortcutsHelp}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer bg-white/5 text-ink-500 border-white/5 hover:bg-white/10 hover:text-parchment-100 focus-visible:ring-2 focus-visible:ring-accent-700"
              title="اختصارات لوحة المفاتيح (؟)"
              aria-label="عرض اختصارات لوحة المفاتيح"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">الاختصارات</span>
            </button>
          )}

          {/* Presentation Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer bg-white/5 text-ink-500 border-white/5 hover:bg-white/10 hover:text-parchment-100 focus-visible:ring-2 focus-visible:ring-accent-700"
            title="وضع العرض"
            aria-label="وضع العرض ملء الشاشة"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">وضع العرض</span>
          </button>

          {onImportExplanations && (
            <button
              onClick={() => setShowImportExplanation(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs font-bold border bg-white/5 text-ink-500 border-white/5 hover:bg-white/10 hover:text-parchment-100 transition-all whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700"
              title="استيراد شرح جاهز"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-accent-700" />
              <span className="hidden sm:inline">استيراد شرح</span>
            </button>
          )}

          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 ${
              showMetadata
                ? "bg-accent-700/10 text-accent-500 border-accent-700/20"
                : "bg-white/5 text-ink-500 border-white/5 hover:bg-white/10 hover:text-parchment-100"
            }`}
            title="معلومات القصيدة والشاعر"
            aria-pressed={showMetadata}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">بيانات القصيدة</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-4 md:mx-8 mt-4 p-4 bg-crimson-500/10 border border-crimson-500/20 text-crimson-500 text-xs font-sans font-bold flex items-center gap-3 select-text rounded-2xl shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main content: Verses stream + Metadata Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Verses List */}
        <div
          ref={containerRef}
          onScroll={handleUserScroll}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-12 space-y-6 max-w-4xl mx-auto w-full scroll-smooth"
        >
          {poem.verses.map((verse, index) => (
            <VerseItem
              key={verse.id}
              verse={verse}
              isActive={index === activeVerseIndex}
              isSelected={verse.id === selectedVerseId}
              onSeekToVerse={(v: Verse) => seekToVerse(v)}
              onSelectVerse={handleVerseSelect}
              onOpenExplanation={handleOpenExplanation}
              onDeleteVerse={onDeleteVerse ? handleDeleteVerse : undefined}
              onEditVerse={onEditVerse}
              onShareVerse={() => setShareVerseIndex(index)}
              explanationItems={explanationStates[verse.id]?.items}
              explanationStatus={explanationStates[verse.id]?.status}
              explanationError={explanationStates[verse.id]?.error}
              onRetryExplanation={() => handleRetryExplanation(verse)}
              onWordClick={handleWordClick}
              verseRef={(el) => {
                if (el) {
                  verseElementsRef.current.set(verse.id, el);
                } else {
                  verseElementsRef.current.delete(verse.id);
                }
              }}
            />
          ))}

          <div className="text-center py-12 text-xs text-ink-600 flex items-center justify-center gap-2 font-sans opacity-70">
            <BookOpen className="w-4 h-4 text-accent-700" />
            <span>تمت القصيدة</span>
          </div>
        </div>

        {/* Metadata Drawer */}
        <PoemMetadataDrawer
          poem={poem}
          isOpen={showMetadata}
          onToggle={() => setShowMetadata(!showMetadata)}
          onChangeCoverImage={onChangeCoverImage}
        />
      </div>

      {/* Audio Controls Bar */}
      <AudioControlsBar
        isPlaying={isPlaying}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        playbackRate={playbackRate}
        volume={volume}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
        onPrevVerse={prevVerse}
        onNextVerse={nextVerse}
        onChangeSpeed={setPlaybackRate}
        onChangeVolume={setVolume}
      />

      {/* Verse Explanation Modal (opened via double-click on a verse) */}
      <VerseExplanationModal
        verse={poem.verses.find((v) => v.id === explanationModalVerseId) || null}
        items={explanationModalVerseId ? explanationStates[explanationModalVerseId]?.items : undefined}
        status={explanationModalVerseId ? explanationStates[explanationModalVerseId]?.status : undefined}
        error={explanationModalVerseId ? explanationStates[explanationModalVerseId]?.error : undefined}
        onRetry={() => {
          const verse = poem.verses.find((v) => v.id === explanationModalVerseId);
          if (verse) handleRetryExplanation(verse);
        }}
        onClose={() => setExplanationModalVerseId(null)}
      />

      {/* Dictionary Word Modal */}
      <DictionaryWordModal
        word={selectedWord}
        definition={wordDefinition}
        isLoading={isLoadingWord}
        onClose={() => {
          setSelectedWord(null);
          setWordDefinition(null);
        }}
      />

      {/* Import Explanation (paste) Modal */}
      {showImportExplanation && onImportExplanations && (
        <ImportExplanationModal
          verses={poem.verses}
          onClose={() => setShowImportExplanation(false)}
          onApplySuggestions={onApplySegmentationSuggestions}
          onImport={async (blocks) => {
            await onImportExplanations(blocks);
            setExplanationStates((previous) => {
              const next = { ...previous };
              blocks.forEach((block) => {
                const existing = next[block.verseId]?.items || [];
                next[block.verseId] = {
                  status: "loaded",
                  items: [...existing, ...block.items],
                  error: null,
                };
              });
              return next;
            });
          }}
        />
      )}

      {/* Verse Share Modal: generate a shareable PNG card for a verse or range */}
      {shareVerseIndex !== null && (
        <VerseShareModal
          poem={poem}
          initialVerseIndex={shareVerseIndex}
          onClose={() => setShareVerseIndex(null)}
        />
      )}

      {/* Focus Mode: fullscreen, distraction-free verses only */}
      {isFocusMode && (
        <FocusModeView
          poem={poem}
          activeVerseIndex={activeVerseIndex}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onSeekToVerse={(v: Verse) => seekToVerse(v)}
          onExit={() => setIsFocusMode(false)}
        />
      )}
    </div>
  );
};
