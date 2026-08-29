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
    <div className="bg-[#0E1015]/95 backdrop-blur-2xl border-t border-white/[0.08] px-8 py-4 select-none flex flex-col gap-3.5 shrink-0 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] z-20">
      {/* Timeline Slider & Time Stamps (Strict LTR for universal media timeline standard) */}
      <div className="flex items-center gap-4" dir="ltr">
        {/* Current Time */}
        <span className="text-[13px] font-mono text-[#F3E19C] min-w-[50px] text-right select-none font-bold tracking-wider">
          {formatTime(currentTimeMs)}
        </span>

        {/* Interactive Custom Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekFromClick}
          className="relative flex-1 group py-3 flex items-center cursor-pointer"
        >
          {/* Base Track */}
          <div className="w-full h-1.5 group-hover:h-2.5 bg-white/[0.08] rounded-full overflow-hidden transition-all duration-300 relative shadow-inner">
            {/* Gold Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-[#B89225] via-[#D4AF37] to-[#F3E19C] rounded-full transition-all duration-75 relative shadow-[0_0_12px_rgba(212,175,55,0.6)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb Circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0A0C10] border-[3px] border-[#F3E19C] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.8)] transition-all duration-75 pointer-events-none group-hover:scale-125 group-hover:bg-[#D4AF37]"
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
        <span className="text-[13px] font-mono text-[#6C7A8C] min-w-[50px] text-left select-none tracking-wider">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: Speed selector */}
        <div className="flex items-center gap-1.5">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onChangeSpeed(speed)}
              className={`px-3 py-1 rounded-lg text-xs font-mono ltr-num transition-all duration-300 ${
                playbackRate === speed
                  ? "bg-[#D4AF37] text-[#0A0C10] font-bold shadow-[0_0_10px_rgba(212,175,55,0.4)]"
                  : "text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.06] font-medium"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={onPrevVerse}
            className="p-2.5 rounded-xl text-[#A0AAB7] hover:text-[#F3E19C] hover:bg-white/[0.06] transition-colors active:scale-95"
            title="البيت السابق"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#B89225] via-[#D4AF37] to-[#F3E19C] hover:from-[#C9A233] hover:to-[#FFF0C2] text-[#0A0C10] shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center border border-[#FFF5DC]/50"
            title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNextVerse}
            className="p-2.5 rounded-xl text-[#A0AAB7] hover:text-[#F3E19C] hover:bg-white/[0.06] transition-colors active:scale-95"
            title="البيت التالي"
          >
            <SkipBack className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChangeVolume(volume === 0 ? 0.85 : 0)}
            className="text-[#A0AAB7] hover:text-[#F3E19C] transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
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
            className="w-24 h-1.5 bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
          />
        </div>
      </div>
    </div>
  );
};
