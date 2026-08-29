import React, { useCallback, useEffect, useRef, useState } from "react";
import { Poem, Verse, VerseExplanationItem, WordDefinition } from "@/types";
import { VerseExplanationStatus, VerseItem } from "./VerseItem";
import { VerseSyncPanel } from "./VerseSyncPanel";
import { AudioControlsBar } from "./AudioControlsBar";
import { PoemMetadataDrawer } from "./PoemMetadataDrawer";
import { DictionaryWordModal } from "./DictionaryWordModal";
import { ExportModal } from "../export/ExportModal";
import { WaveformDebugView } from "./WaveformDebugView";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import { Info, BookOpen, AlertCircle, Download, Activity, AudioWaveform } from "lucide-react";
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
}) => {
  const [showMetadata, setShowMetadata] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [showWaveformDebug, setShowWaveformDebug] = useState(false);
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
    fps = 60,
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
      if (items.length > 0) {
        await onSaveExplanations?.(verse.id, items);
      }
    } catch (error) {
      if (requestId !== explanationRequestRef.current) return;
      setExplanationStates((previous) => ({
        ...previous,
        [verse.id]: {
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "تعذر تحميل شرح البيت من ميزان العرب.",
        },
      }));
    }
  }, [onSaveExplanations, poem.externalProvider]);

  const handleVerseSelect = useCallback((verse: Verse) => {
    setSelectedVerseId(verse.id);
    seekToVerse(verse);
    void loadExplanation(verse);
  }, [loadExplanation, seekToVerse]);

  const handleRetryExplanation = useCallback((verse: Verse) => {
    void loadExplanation(verse);
  }, [loadExplanation]);

  useEffect(() => {
    const firstVerse = poem.verses[0];
    setSelectedVerseId(null);
    setExplanationStates({});
    explanationRequestRef.current += 1;
    if (firstVerse) {
      setSelectedVerseId(firstVerse.id);
      void loadExplanation(firstVerse);
    }
  }, [poem.id]);

  useEffect(() => {
    if (!poem.sourceUrl) return;
    try {
      const hash = new URL(poem.sourceUrl).hash;
      const externalId = hash.startsWith("#v=") ? decodeURIComponent(hash.slice(3)) : "";
      const verse = poem.verses.find((item) => item.externalId === externalId);
      if (verse && verse.id !== selectedVerseId) handleVerseSelect(verse);
    } catch {
      // Ignore
    }
  }, [handleVerseSelect, poem.sourceUrl, poem.verses, selectedVerseId]);

  useEffect(() => {
    if (activeVerse && isPlaying && !isUserScrolling) {
      if (lastScrolledVerseIdRef.current !== activeVerse.id) {
        lastScrolledVerseIdRef.current = activeVerse.id;
        const el = verseElementsRef.current.get(activeVerse.id);
        if (el && containerRef.current) {
          el.scrollIntoView({
            behavior: "auto",
            block: "center",
          });
        }
      }
    }
  }, [activeVerse, isPlaying, isUserScrolling]);

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

  const activeStartMs = activeVerse?.alignment?.startMs ?? 0;
  const activeEndMs = activeVerse?.alignment?.endMs ?? 0;
  const activeDiffMs = currentTimeMs - activeStartMs;
  const selectedVerse =
    poem.verses.find((verse) => verse.id === selectedVerseId) ||
    activeVerse ||
    poem.verses[0] ||
    null;

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-paper-200 relative">
      {/* Header bar within Player */}
      <div className="px-8 py-4 border-b-2 border-paper-400 bg-paper-100 flex items-center justify-between shrink-0 z-10">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-ink-900 truncate">
            {poem.title}
          </h2>
          <p className="text-sm text-ink-600 font-medium mt-1 flex items-center gap-2 font-ui">
            <span className="text-ink-800 font-bold">{poem.poet.name}</span>
            <span className="text-paper-400">•</span>
            <span>بحر {poem.bahr} <strong className="text-accent-700">({meterInfo.pattern})</strong></span>
            <span className="text-paper-400">•</span>
            <span>الرويّ: <strong className="text-ink-800">{meterInfo.rawiyy}</strong></span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-full font-ui">
          {/* Waveform VAD Debug Toggle */}
          <button
            onClick={() => setShowWaveformDebug(!showWaveformDebug)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[13px] font-bold border transition-colors whitespace-nowrap ${
              showWaveformDebug
                ? "bg-green-50 text-green-800 border-green-800 shadow-sm"
                : "bg-transparent text-ink-700 border-ink-400 hover:bg-paper-200"
            }`}
            title="مخطط فترات الصمت والكلام (VAD Waveform Map)"
          >
            <AudioWaveform className="w-4 h-4" />
            <span>مخطط VAD</span>
          </button>

          {/* Debug Telemetry Toggle */}
          <button
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[13px] font-bold border transition-colors whitespace-nowrap ${
              showDebugOverlay
                ? "bg-paper-300 text-accent-700 border-accent-700 shadow-sm"
                : "bg-transparent text-ink-700 border-ink-400 hover:bg-paper-200"
            }`}
            title="مؤشرات التزامن المباشرة (Sync Telemetry)"
          >
            <Activity className="w-4 h-4" />
            <span>مؤشرات التزامن</span>
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-none text-[13px] font-bold bg-accent-700 text-paper-100 border border-accent-700 hover:bg-accent-600 transition-colors shadow-sm whitespace-nowrap"
            title="تصدير القصيدة والكلمات المتزامنة (LRC, SRT, JSON)"
          >
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>

          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-none text-[13px] font-bold border transition-colors whitespace-nowrap ${
              showMetadata
                ? "bg-paper-300 text-ink-900 border-paper-500"
                : "bg-transparent text-ink-700 border-ink-400 hover:bg-paper-200"
            }`}
            title="معلومات القصيدة والشاعر"
          >
            <Info className="w-4 h-4" />
            <span>بيانات القصيدة</span>
          </button>
        </div>
      </div>

      {/* Live Synchronization Debug Overlay */}
      {showDebugOverlay && (
        <div className="absolute top-24 left-6 z-40 bg-paper-100 border border-paper-400 p-4 shadow-md font-mono text-[12px] text-ink-800 space-y-1.5 select-text pointer-events-auto max-w-sm ltr-num">
          <div className="flex items-center justify-between text-[13px] font-bold text-accent-700 border-b border-paper-400 pb-1 mb-1.5">
            <span>Audio-to-Verse Sync Telemetry</span>
            <span className="px-2 py-0.5 border border-paper-400 text-ink-700">{fps} FPS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Audio currentTime:</span>
            <span className="font-bold text-ink-900">{currentTimeMs} ms ({(currentTimeMs / 1000).toFixed(3)}s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Active Verse Index:</span>
            <span className="font-bold text-ink-900">
              {activeVerseIndex >= 0 ? `Verse ${activeVerseIndex + 1} of ${poem.verses.length}` : "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Verse Boundaries:</span>
            <span className="text-ink-800">[{activeStartMs} ms - {activeEndMs} ms]</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Offset (Current - Start):</span>
            <span className={activeDiffMs >= 0 ? "text-green-700 font-bold" : "text-amber-700 font-bold"}>
              {activeDiffMs >= 0 ? `+${activeDiffMs}` : activeDiffMs} ms
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-ink-500 border-t border-paper-400 pt-1 mt-1">
            <span>Clock Source:</span>
            <span className="text-ink-700 font-semibold">requestAnimationFrame</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-8 mt-4 p-3.5 bg-red-50 border border-red-800 text-red-800 text-[13px] font-ui font-bold flex items-center gap-2.5 select-text">
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
          className="flex-1 overflow-y-auto px-6 md:px-10 py-8 space-y-4 max-w-4xl mx-auto w-full scroll-smooth"
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

          <div className="text-center py-10 text-[14px] text-ink-500 flex items-center justify-center gap-2 font-ui">
            <BookOpen className="w-4 h-4 text-ink-400" />
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

      {/* Waveform VAD & Boundaries Debug View */}
      <WaveformDebugView
        poem={poem}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        activeVerseIndex={activeVerseIndex}
        isOpen={showWaveformDebug}
        onClose={() => setShowWaveformDebug(false)}
      />

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

      {/* Export Modal */}
      <ExportModal
        poem={poem}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
};
