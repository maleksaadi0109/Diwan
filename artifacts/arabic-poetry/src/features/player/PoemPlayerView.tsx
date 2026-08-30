import React, { useCallback, useEffect, useRef, useState } from "react";
import { Poem, Verse, VerseExplanationItem, WordDefinition } from "@/types";
import { VerseExplanationStatus, VerseItem } from "./VerseItem";
import { VerseSyncPanel } from "./VerseSyncPanel";
import { AudioControlsBar } from "./AudioControlsBar";
import { PoemMetadataDrawer } from "./PoemMetadataDrawer";
import { DictionaryWordModal } from "./DictionaryWordModal";
import { ExportModal } from "../export/ExportModal";
import { WaveformDebugView } from "./WaveformDebugView";
import { FocusModeView } from "./FocusModeView";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import { Info, BookOpen, AlertCircle, Download, Activity, AudioWaveform, Maximize2 } from "lucide-react";
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
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
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

          {/* Waveform VAD Debug Toggle */}
          <button
            onClick={() => setShowWaveformDebug(!showWaveformDebug)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
              showWaveformDebug
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                : "bg-white/[0.04] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08]"
            }`}
            title="مخطط فترات الصمت والكلام (VAD Waveform Map)"
          >
            <AudioWaveform className="w-3.5 h-3.5" />
            <span>مخطط VAD</span>
          </button>

          {/* Debug Telemetry Toggle */}
          <button
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
              showDebugOverlay
                ? "bg-[#D4AF37]/20 text-[#F3E19C] border-[#D4AF37]/40 shadow-sm"
                : "bg-white/[0.04] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08]"
            }`}
            title="مؤشرات التزامن المباشرة (Sync Telemetry)"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>مؤشرات التزامن</span>
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] text-[#0A0C10] shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all whitespace-nowrap cursor-pointer"
            title="تصدير القصيدة والكلمات المتزامنة (LRC, SRT, JSON)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير</span>
          </button>

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

      {/* Live Synchronization Debug Overlay */}
      {showDebugOverlay && (
        <div className="absolute top-24 left-6 z-40 bg-[#13161D]/95 border border-white/10 p-5 rounded-2xl shadow-2xl font-mono text-xs text-[#CED4DA] space-y-2 select-text pointer-events-auto max-w-sm ltr-num backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs font-bold text-[#D4AF37] border-b border-white/10 pb-2 mb-2">
            <span>Audio-to-Verse Sync Telemetry</span>
            <span className="px-2 py-0.5 border border-white/10 rounded-lg text-[#CED4DA]">{fps} FPS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0AAB7]">Audio currentTime:</span>
            <span className="font-bold text-[#F8F9FA]">{currentTimeMs} ms ({(currentTimeMs / 1000).toFixed(3)}s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0AAB7]">Active Verse Index:</span>
            <span className="font-bold text-[#F8F9FA]">
              {activeVerseIndex >= 0 ? `Verse ${activeVerseIndex + 1} of ${poem.verses.length}` : "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0AAB7]">Verse Boundaries:</span>
            <span className="text-[#CED4DA]">[{activeStartMs} ms - {activeEndMs} ms]</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0AAB7]">Offset (Current - Start):</span>
            <span className={activeDiffMs >= 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {activeDiffMs >= 0 ? `+${activeDiffMs}` : activeDiffMs} ms
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-[#A0AAB7] border-t border-white/10 pt-2 mt-2">
            <span>Clock Source:</span>
            <span className="text-[#CED4DA] font-semibold">requestAnimationFrame</span>
          </div>
        </div>
      )}

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
