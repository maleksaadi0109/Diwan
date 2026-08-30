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
    <div className="bg-charcoal-950/95 border-t border-white/5 backdrop-blur-2xl px-4 md:px-8 py-3 md:py-4 select-none flex flex-col gap-2 md:gap-3 shrink-0 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] z-20 relative">
      {/* Timeline Slider & Time Stamps */}
      <div className="flex items-center gap-4" dir="ltr">
        {/* Current Time */}
        <span className="text-[11px] md:text-xs font-mono text-accent-700 min-w-[45px] text-right select-none font-bold tracking-wider ltr-num">
          {formatTime(currentTimeMs)}
        </span>

        {/* Interactive Custom Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekFromClick}
          className="relative flex-1 group py-3 flex items-center cursor-pointer"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={durationMs || 100}
          aria-valuenow={currentTimeMs}
          aria-label="موقع التشغيل الزمني"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onSeek(Math.min(durationMs, currentTimeMs + 5000));
            if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTimeMs - 5000));
          }}
        >
          {/* Base Track */}
          <div className="w-full h-1.5 md:h-2 group-hover:h-2 md:group-hover:h-2.5 bg-charcoal-800 rounded-full overflow-hidden transition-all duration-300 relative border border-white/5 shadow-inner">
            {/* Gold Progress Fill */}
            <div
              className="h-full bg-accent-700 from-accent-600 via-accent-700 to-accent-400 rounded-full transition-all duration-75 relative shadow-[0_0_12px_rgba(212,175,55,0.4)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 bg-accent-700 border-2 border-charcoal-950 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all duration-75 pointer-events-none group-hover:scale-125"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>

        {/* Total Duration */}
        <span className="text-[11px] md:text-xs font-mono text-ink-500 min-w-[45px] text-left select-none tracking-wider font-semibold ltr-num">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: Speed selector */}
        <div className="hidden md:flex items-center gap-1 bg-charcoal-850 p-1 rounded-xl border border-white/5">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onChangeSpeed(speed)}
              className={`px-2.5 py-1 text-xs font-mono ltr-num transition-all rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
                playbackRate === speed
                  ? "bg-accent-700/10 text-accent-700 font-bold"
                  : "text-ink-500 hover:text-parchment-100 hover:bg-white/5"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-3 md:gap-5 flex-1 justify-center md:flex-none">
          <button
            onClick={onPrevVerse}
            className="p-2 md:p-2.5 rounded-xl text-ink-500 hover:text-accent-700 hover:bg-accent-700/10 transition-all active:scale-95 border border-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            title="البيت السابق"
            aria-label="البيت السابق"
          >
            <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-accent-700 hover:bg-accent-600 text-charcoal-950 shadow-lg shadow-accent-700/20 transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer border border-accent-600/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700"
            title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
            aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-charcoal-950" />
            ) : (
              <Play className="w-5 h-5 fill-current text-charcoal-950 ml-0.5" />
            )}
          </button>

          <button
            onClick={onNextVerse}
            className="p-2 md:p-2.5 rounded-xl text-ink-500 hover:text-accent-700 hover:bg-accent-700/10 transition-all active:scale-95 border border-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            title="البيت التالي"
            aria-label="البيت التالي"
          >
            <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="flex items-center gap-2 md:gap-3 bg-charcoal-850 px-2.5 py-1.5 md:px-3.5 md:py-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => onChangeVolume(volume === 0 ? 0.85 : 0)}
            className="text-ink-500 hover:text-accent-700 transition-colors p-1 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            aria-label={volume === 0 ? "إلغاء كتم الصوت" : "كتم الصوت"}
          >
            {volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4 text-crimson-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
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
            className="w-16 md:w-20 h-1.5 bg-charcoal-950 rounded-full appearance-none cursor-pointer accent-accent-700 border border-white/5"
            aria-label="التحكم بمستوى الصوت"
          />
        </div>
      </div>
    </div>
  );
};
