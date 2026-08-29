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
    // Show the first explanation immediately when the player opens. This
    // avoids requiring an extra click before the explanation card appears.
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
      // A malformed source URL should not prevent normal player use.
    }
  }, [handleVerseSelect, poem.sourceUrl, poem.verses, selectedVerseId]);

  // Auto-scroll to active verse using behavior: "auto" during playback to avoid perception lag
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

  // Unaligned verses are never active (findActiveVerseIndexBinary skips
  // them), so no fabricated fallback timing is needed here.
  const activeStartMs = activeVerse?.alignment?.startMs ?? 0;
  const activeEndMs = activeVerse?.alignment?.endMs ?? 0;
  const activeDiffMs = currentTimeMs - activeStartMs;
  const selectedVerse =
    poem.verses.find((verse) => verse.id === selectedVerseId) ||
    activeVerse ||
    poem.verses[0] ||
    null;

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-sand-100 relative">
      {/* Header bar within Player */}
      <div className="px-8 py-4 border-b border-sand-300 bg-sand-50/30 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-poetry text-2xl font-bold text-ink-950">
            {poem.title}
          </h2>
          <p className="text-xs text-crimson-700 font-medium mt-0.5 flex items-center gap-2">
            <span>{poem.poet.name}</span>
            <span>•</span>
            <span>بحر {poem.bahr} ({meterInfo.pattern})</span>
            <span>•</span>
            <span>الروي: {meterInfo.rawiyy}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Waveform VAD Debug Toggle */}
          <button
            onClick={() => setShowWaveformDebug(!showWaveformDebug)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              showWaveformDebug
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-white text-ink-600 border-sand-400 hover:text-ink-800"
            }`}
            title="مخطط فترات الصمت والكلام (VAD Waveform Map)"
          >
            <AudioWaveform className="w-3.5 h-3.5" />
            <span>مخطط VAD</span>
          </button>

          {/* Debug Telemetry Toggle */}
          <button
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              showDebugOverlay
                ? "bg-crimson-800/20 text-crimson-600 border-crimson-800/40"
                : "bg-white text-ink-600 border-sand-400 hover:text-ink-800"
            }`}
            title="مؤشرات التزامن المباشرة (Sync Telemetry)"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>مؤشرات التزامن</span>
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-crimson-800/15 text-crimson-600 border border-crimson-800/30 hover:bg-crimson-800/25 transition-colors"
            title="تصدير القصيدة والكلمات المتزامنة (LRC, SRT, JSON)"
          >
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>

          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              showMetadata
                ? "bg-crimson-800/15 text-crimson-600 border-crimson-800/30"
                : "bg-white text-ink-600 border-sand-400 hover:text-ink-800"
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
        <div className="absolute top-20 left-6 z-40 bg-sand-100/90 backdrop-blur-md border border-emerald-500/40 rounded-xl p-3.5 shadow-2xl font-mono text-[11px] text-emerald-300 space-y-1 select-text pointer-events-auto max-w-sm ltr-num animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-emerald-500/30 pb-1 mb-1.5">
            <span>⚡ Audio-to-Verse Sync Telemetry</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">{fps} FPS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Audio currentTime:</span>
            <span className="font-bold text-ink-900">{currentTimeMs} ms ({(currentTimeMs / 1000).toFixed(3)}s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Active Verse Index:</span>
            <span className="font-bold text-crimson-600">
              {activeVerseIndex >= 0 ? `Verse ${activeVerseIndex + 1} of ${poem.verses.length}` : "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Verse Boundaries:</span>
            <span>[{activeStartMs} ms - {activeEndMs} ms]</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Offset (Current - Start):</span>
            <span className={activeDiffMs >= 0 ? "text-emerald-400" : "text-amber-400"}>
              {activeDiffMs >= 0 ? `+${activeDiffMs}` : activeDiffMs} ms
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-ink-600 border-t border-sand-300 pt-1 mt-1">
            <span>Clock Source:</span>
            <span className="text-emerald-400 font-semibold">requestAnimationFrame (Zero lag)</span>
          </div>
        </div>
      )}

      {/* Error banner if audio fails to load or unsupported codec */}
      {errorMessage && (
        <div className="mx-8 mt-4 p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2.5 select-text animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main content: Verses stream + Metadata Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Verses List with user-scroll detection */}
        <div
          ref={containerRef}
          onScroll={handleUserScroll}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-4xl mx-auto w-full"
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

          <div className="text-center py-8 text-xs text-ink-400 flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" />
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
