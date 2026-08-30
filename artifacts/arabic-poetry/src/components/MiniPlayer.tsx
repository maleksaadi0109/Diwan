import React from "react";
import { Play, Pause, X, ChevronUp, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { Poem, RepeatMode } from "@/types";
import { AudioPlayerState } from "@/lib/audio/AudioController";

interface MiniPlayerProps {
  poem: Poem;
  playerState: AudioPlayerState;
  onTogglePlay: () => void;
  onExpand: () => void;
  onClose: () => void;
  hasQueue?: boolean;
  queueIndex?: number;
  shuffle?: boolean;
  repeatMode?: RepeatMode;
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleShuffle?: () => void;
  onCycleRepeatMode?: () => void;
}

function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "٠:٠٠";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  poem,
  playerState,
  onTogglePlay,
  onExpand,
  onClose,
  hasQueue,
  shuffle,
  repeatMode = "off",
  onNext,
  onPrevious,
  onToggleShuffle,
  onCycleRepeatMode,
}) => {
  const { isPlaying, currentTimeMs, durationMs } = playerState;
  const progress = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0;
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    <div
      className="absolute bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-30 border-t border-white/5 bg-charcoal-900/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.35)] font-sans"
      dir="rtl"
    >
      {/* Progress bar */}
      <div className="h-1 w-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-accent-600 to-accent-700 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5">
        {hasQueue && onPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none"
            title="القصيدة السابقة"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-accent-700 to-accent-600 text-charcoal-950 shadow-md shadow-accent-700/20 cursor-pointer hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:outline-none"
          title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
        >
          {isPlaying ? <Pause className="w-4.5 h-4.5" fill="currentColor" /> : <Play className="w-4.5 h-4.5 mr-[-2px]" fill="currentColor" />}
        </button>

        {hasQueue && onNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none"
            title="القصيدة التالية"
          >
            <SkipBack className="w-4 h-4" />
          </button>
        )}

        {poem.coverImageUrl && (
          <button
            onClick={onExpand}
            className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/10 focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none hidden sm:block"
            title="العودة إلى المشغّل"
          >
            <img src={poem.coverImageUrl} alt="" className="w-full h-full object-cover" />
          </button>
        )}

        <button
          onClick={onExpand}
          className="flex-1 min-w-0 flex flex-col items-start text-right cursor-pointer group focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none px-2 rounded-lg"
          title="العودة إلى المشغّل"
        >
          <span className="font-poetry text-[15px] md:text-base font-bold text-parchment-100 truncate w-full group-hover:text-accent-500 transition-colors">
            {poem.title}
          </span>
          <span className="text-[10px] md:text-[11px] text-ink-500 font-medium truncate w-full flex items-center gap-1.5">
            <span>{poem.poet.name}</span>
            <span className="text-white/20">•</span>
            <span className="ltr-num">{formatTime(currentTimeMs)} / {formatTime(durationMs)}</span>
          </span>
        </button>

        <div className="flex items-center gap-1">
          {hasQueue && onToggleShuffle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleShuffle();
              }}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none ${
                shuffle ? "text-accent-700 bg-accent-700/10" : "text-ink-500 hover:text-parchment-100 hover:bg-white/10"
              }`}
              title="تشغيل عشوائي"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          )}

          {hasQueue && onCycleRepeatMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCycleRepeatMode();
              }}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none ${
                repeatMode !== "off" ? "text-accent-700 bg-accent-700/10" : "text-ink-500 hover:text-parchment-100 hover:bg-white/10"
              }`}
              title="تكرار"
            >
              <RepeatIcon className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onExpand}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none"
            title="العودة إلى المشغّل"
          >
            <ChevronUp className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none"
            title="إيقاف التشغيل وإغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
