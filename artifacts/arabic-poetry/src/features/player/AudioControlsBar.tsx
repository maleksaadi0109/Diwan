import React, { useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatTime } from "@/lib/utils";

interface AudioControlsBarProps {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (timeMs: number) => void;
  onPrevVerse: () => void;
  onNextVerse: () => void;
  onChangeSpeed: (speed: number) => void;
  onChangeVolume: (volume: number) => void;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5];

export const AudioControlsBar: React.FC<AudioControlsBarProps> = ({
  isPlaying,
  currentTimeMs,
  durationMs,
  playbackRate,
  volume,
  onTogglePlay,
  onSeek,
  onPrevVerse,
  onNextVerse,
  onChangeSpeed,
  onChangeVolume,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;

  const handleSeekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || durationMs <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(Math.round(ratio * durationMs));
  };

  return (
    <div className="bg-[#0E1015]/95 border-t border-white/[0.08] backdrop-blur-2xl px-8 py-4 select-none flex flex-col gap-3 shrink-0 shadow-2xl z-20 relative">
      {/* Timeline Slider & Time Stamps */}
      <div className="flex items-center gap-4" dir="ltr">
        {/* Current Time */}
        <span className="text-xs font-mono text-[#D4AF37] min-w-[50px] text-right select-none font-bold tracking-wider ltr-num">
          {formatTime(currentTimeMs)}
        </span>

        {/* Interactive Custom Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekFromClick}
          className="relative flex-1 group py-3 flex items-center cursor-pointer"
        >
          {/* Base Track */}
          <div className="w-full h-2 group-hover:h-2.5 bg-black/50 rounded-full overflow-hidden transition-all duration-300 relative border border-white/[0.08] shadow-inner p-0.5">
            {/* Gold Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-[#B89225] via-[#D4AF37] to-[#F3E19C] rounded-full transition-all duration-75 relative shadow-[0_0_12px_rgba(212,175,55,0.6)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#D4AF37] border-2 border-[#0E1015] rounded-full shadow-[0_0_12px_rgba(212,175,55,0.8)] transition-all duration-75 pointer-events-none group-hover:scale-125"
            style={{ left: `calc(${progressPercent}% - 8px)` }}
          />

          {/* Accessible Native Range Slider (Invisible overlay) */}
          <input
            type="range"
            dir="ltr"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="موقع التشغيل الزمني"
          />
        </div>

        {/* Total Duration */}
        <span className="text-xs font-mono text-[#A0AAB7] min-w-[50px] text-left select-none tracking-wider font-semibold ltr-num">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: Speed selector */}
        <div className="flex items-center gap-1.5 bg-[#14171E] p-1 rounded-xl border border-white/[0.08]">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onChangeSpeed(speed)}
              className={`px-2.5 py-1 text-xs font-mono ltr-num transition-all rounded-lg ${
                playbackRate === speed
                  ? "bg-[#D4AF37] text-[#0A0C10] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                  : "text-[#A0AAB7] hover:text-[#F8F9FA]"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-5">
          <button
            onClick={onPrevVerse}
            className="p-2.5 rounded-xl text-[#A0AAB7] hover:text-[#D4AF37] hover:bg-white/[0.05] transition-all active:scale-95 border border-transparent cursor-pointer"
            title="البيت السابق"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#B89225] via-[#D4AF37] to-[#F3E19C] hover:from-[#C9A233] hover:to-[#FFF0B3] text-[#0A0C10] shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer border border-[#FFF0B3]/40"
            title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current text-[#0A0C10]" />
            ) : (
              <Play className="w-6 h-6 fill-current text-[#0A0C10] ml-0.5" />
            )}
          </button>

          <button
            onClick={onNextVerse}
            className="p-2.5 rounded-xl text-[#A0AAB7] hover:text-[#D4AF37] hover:bg-white/[0.05] transition-all active:scale-95 border border-transparent cursor-pointer"
            title="البيت التالي"
          >
            <SkipBack className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="flex items-center gap-3 bg-[#14171E] px-3.5 py-1.5 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => onChangeVolume(volume === 0 ? 0.85 : 0)}
            className="text-[#A0AAB7] hover:text-[#D4AF37] transition-colors p-1 rounded-lg cursor-pointer"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            dir="ltr"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            className="w-20 h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-[#D4AF37] border border-white/10"
          />
        </div>
      </div>
    </div>
  );
};
