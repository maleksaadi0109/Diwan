import React from "react";
import { Play, Pause, X, ChevronUp } from "lucide-react";
import { Poem } from "@/types";
import { AudioPlayerState } from "@/lib/audio/AudioController";

interface MiniPlayerProps {
  poem: Poem;
  playerState: AudioPlayerState;
  onTogglePlay: () => void;
  onExpand: () => void;
  onClose: () => void;
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
}) => {
  const { isPlaying, currentTimeMs, durationMs } = playerState;
  const progress = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/[0.08] bg-[#0E1015]/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.35)] font-sans"
      dir="rtl"
    >
      {/* Progress bar */}
      <div className="h-1 w-full bg-white/[0.06]">
        <div
          className="h-full bg-gradient-to-r from-[#B89225] to-[#D4AF37] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-[#D4AF37] to-[#B89225] text-[#0A0C10] shadow-[0_0_15px_rgba(212,175,55,0.3)] cursor-pointer hover:brightness-110 transition-all"
          title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
        >
          {isPlaying ? <Pause className="w-4.5 h-4.5" fill="currentColor" /> : <Play className="w-4.5 h-4.5 mr-[-2px]" fill="currentColor" />}
        </button>

        {poem.coverImageUrl && (
          <button
            onClick={onExpand}
            className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/10"
            title="العودة إلى المشغّل"
          >
            <img src={poem.coverImageUrl} alt="" className="w-full h-full object-cover" />
          </button>
        )}

        <button
          onClick={onExpand}
          className="flex-1 min-w-0 flex flex-col items-start text-right cursor-pointer group"
          title="العودة إلى المشغّل"
        >
          <span className="font-poetry text-base font-bold text-[#F8F9FA] truncate w-full group-hover:text-[#D4AF37] transition-colors">
            {poem.title}
          </span>
          <span className="text-[11px] text-[#A0AAB7] font-medium truncate w-full flex items-center gap-1.5">
            <span>{poem.poet.name}</span>
            <span className="text-white/20">•</span>
            <span className="ltr-num">{formatTime(currentTimeMs)} / {formatTime(durationMs)}</span>
          </span>
        </button>

        <button
          onClick={onExpand}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.06] transition-all cursor-pointer"
          title="العودة إلى المشغّل"
        >
          <ChevronUp className="w-4.5 h-4.5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.06] transition-all cursor-pointer"
          title="إيقاف التشغيل وإغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
