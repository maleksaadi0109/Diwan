import React, { useEffect, useRef, useState } from "react";
import { Poem, Verse } from "@/types";
import { VerseItem } from "./VerseItem";
import { AudioControlsBar } from "./AudioControlsBar";
import { PoemMetadataDrawer } from "./PoemMetadataDrawer";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import { Info, BookOpen, AlertCircle } from "lucide-react";

interface PoemPlayerViewProps {
  poem: Poem;
  onUpdateBoundary?: (
    alignmentId: string,
    startMs: number,
    endMs: number,
    status?: "reviewed" | "manual"
  ) => void;
}

export const PoemPlayerView: React.FC<PoemPlayerViewProps> = ({ poem }) => {
  const [showMetadata, setShowMetadata] = useState(true);
  const verseElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll to active verse smoothly, respecting manual user scrolling
  useEffect(() => {
    if (activeVerse && isPlaying && !isUserScrolling) {
      const el = verseElementsRef.current.get(activeVerse.id);
      if (el && containerRef.current) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeVerse, isPlaying, isUserScrolling]);

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-charcoal-950">
      {/* Header bar within Player */}
      <div className="px-8 py-4 border-b border-charcoal-850 bg-charcoal-900/30 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-poetry text-2xl font-bold text-parchment-50">
            {poem.title}
          </h2>
          <p className="text-xs text-gold-400 font-medium mt-0.5">
            {poem.poet.name} — بحر {poem.bahr}
          </p>
        </div>

        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
            showMetadata
              ? "bg-gold-500/15 text-gold-300 border-gold-500/30"
              : "bg-charcoal-850 text-parchment-400 border-charcoal-700 hover:text-parchment-200"
          }`}
          title="معلومات القصيدة والشاعر"
        >
          <Info className="w-4 h-4" />
          <span>بيانات القصيدة</span>
        </button>
      </div>

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
          {poem.verses.map((verse, index) => (
            <VerseItem
              key={verse.id}
              verse={verse}
              isActive={index === activeVerseIndex}
              onSeekToVerse={(v: Verse) => seekToVerse(v)}
              verseRef={(el) => {
                if (el) {
                  verseElementsRef.current.set(verse.id, el);
                } else {
                  verseElementsRef.current.delete(verse.id);
                }
              }}
            />
          ))}

          <div className="text-center py-8 text-xs text-charcoal-600 flex items-center justify-center gap-2">
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
    </div>
  );
};
