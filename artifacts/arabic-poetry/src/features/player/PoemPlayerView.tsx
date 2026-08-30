import React, { useCallback, useEffect, useRef, useState } from "react";
import { Poem, Verse, VerseExplanationItem, WordDefinition } from "@/types";
import { VerseExplanationStatus, VerseItem } from "./VerseItem";
import { VerseSyncPanel } from "./VerseSyncPanel";
import { AudioControlsBar } from "./AudioControlsBar";
import { PoemMetadataDrawer } from "./PoemMetadataDrawer";
import { DictionaryWordModal } from "./DictionaryWordModal";
import { VerseExplanationModal } from "./VerseExplanationModal";
import { ImportExplanationModal } from "./ImportExplanationModal";
import { FocusModeView } from "./FocusModeView";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import { Info, BookOpen, AlertCircle, Maximize2, ClipboardPaste } from "lucide-react";
import { ParsedExplanationBlock } from "@/lib/import/pasteExplanationParser";
import { analyzeVerseMeter } from "@/lib/arud/meterDetector";
import { DiwanRepository } from "@/lib/db/repository";
import { MizanAlArabProvider } from "@/lib/providers/MizanAlArabProvider";

interface PoemPlayerViewProps {
  poem: Poem;
  onUpdateBoundary?: (
    alignmentId: string,
    startMs: number,
    endMs: number,
    status?: "reviewed" | "manual"
  ) => Promise<void> | void;
  onCreateBoundary?: (verseId: string, startMs: number, endMs: number) => Promise<void> | void;
  onSaveExplanations?: (verseId: string, items: VerseExplanationItem[]) => Promise<void>;
  onApplyOffset?: (
    verseId: string,
    offsetMs: number,
    includeFollowing: boolean
  ) => Promise<void>;
  onDeleteVerse?: (verseId: string) => Promise<void> | void;
  onEditVerse?: (verseId: string, firstHemistich: string, secondHemistich: string) => Promise<void> | void;
  onImportExplanations?: (blocks: ParsedExplanationBlock[]) => Promise<void> | void;
}

interface ExplanationViewState {
  status: VerseExplanationStatus;
  items: VerseExplanationItem[];
  error: string | null;
}

export const PoemPlayerView: React.FC<PoemPlayerViewProps> = ({
  poem,
  onUpdateBoundary,
  onCreateBoundary,
  onSaveExplanations,
  onApplyOffset,
  onDeleteVerse,
  onEditVerse,
  onImportExplanations,
}) => {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [explanationModalVerseId, setExplanationModalVerseId] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showImportExplanation, setShowImportExplanation] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDefinition, setWordDefinition] = useState<WordDefinition | null>(null);
  const [isLoadingWord, setIsLoadingWord] = useState(false);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
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

  const selectedVerse =
    poem.verses.find((verse) => verse.id === selectedVerseId) ||
    activeVerse ||
    poem.verses[0] ||
    null;

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-[#080A0E] text-[#F8F9FA] relative">
      {/* Header bar within Player */}
      <div className="px-8 py-4 border-b border-white/[0.08] bg-[#0E1015]/90 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
        <div className="min-w-0 flex-1">
          <h2 className="font-poetry text-2xl md:text-3xl font-bold text-[#F8F9FA] truncate">
            {poem.title}
          </h2>
          <p className="text-xs text-[#A0AAB7] font-medium mt-1 flex items-center gap-2 font-sans">
            <span className="text-[#F8F9FA] font-bold">{poem.poet.name}</span>
            <span className="text-white/20">•</span>
            <span>بحر {poem.bahr} <strong className="text-[#D4AF37]">({meterInfo.pattern})</strong></span>
            <span className="text-white/20">•</span>
            <span>الرويّ: <strong className="text-[#F8F9FA]">{meterInfo.rawiyy}</strong></span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-full font-sans">
          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(true)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer bg-white/[0.04] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08] hover:text-[#F8F9FA]"
            title="وضع التركيز: عرض الأبيات فقط بشاشة كاملة بدون شرح أو أدوات"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>وضع التركيز</span>
          </button>

          {onImportExplanations && (
            <button
              onClick={() => setShowImportExplanation(true)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border bg-white/[0.04] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08] transition-all whitespace-nowrap cursor-pointer"
              title="استيراد شرح جاهز عبر النسخ واللصق من موقع خارجي"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>استيراد شرح (لصق)</span>
            </button>
          )}

          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
              showMetadata
                ? "bg-white/15 text-[#F8F9FA] border-white/30"
                : "bg-white/[0.04] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08]"
            }`}
            title="معلومات القصيدة والشاعر"
          >
            <Info className="w-3.5 h-3.5" />
            <span>بيانات القصيدة</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-8 mt-4 p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-sans font-bold flex items-center gap-3 select-text rounded-2xl shadow-inner">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main content: Verses stream + Metadata Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Verses List */}
        <div
          ref={containerRef}
          onScroll={handleUserScroll}
          className="flex-1 overflow-y-auto px-6 md:px-12 py-8 space-y-5 max-w-4xl mx-auto w-full scroll-smooth"
        >
          {selectedVerse && (
            <VerseSyncPanel
              verse={selectedVerse}
              verses={poem.verses}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              isPlaying={isPlaying}
              onSeek={seekTo}
              onTogglePlay={togglePlay}
              onSave={async (alignmentId, startMs, endMs, status) => {
                if (!onUpdateBoundary) {
                  throw new Error("لا توجد صلاحية لحفظ تصحيح التوقيت.");
                }
                await onUpdateBoundary(alignmentId, startMs, endMs, status);
              }}
              onCreate={
                onCreateBoundary
                  ? (verseId, startMs, endMs) => onCreateBoundary(verseId, startMs, endMs)
                  : undefined
              }
              onApplyOffset={
                onApplyOffset
                  ? (offsetMs, includeFollowing) =>
                      onApplyOffset(selectedVerse.id, offsetMs, includeFollowing)
                  : undefined
              }
            />
          )}
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

          <div className="text-center py-10 text-xs text-[#A0AAB7] flex items-center justify-center gap-2 font-sans">
            <BookOpen className="w-4 h-4 text-[#D4AF37]" />
            <span>نهاية القصيدة</span>
          </div>
        </div>

        {/* Metadata Drawer */}
        <PoemMetadataDrawer
          poem={poem}
          isOpen={showMetadata}
          onToggle={() => setShowMetadata(!showMetadata)}
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
