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
    <div className="bg-charcoal-900 border-t border-charcoal-800 px-6 py-3 select-none flex flex-col gap-2 shrink-0">
      {/* Timeline Slider & Time Stamps (Strict LTR for universal media timeline standard) */}
      <div className="flex items-center gap-3" dir="ltr">
        {/* Current Time */}
        <span className="text-xs font-mono text-gold-400 min-w-[45px] text-left select-none font-semibold">
          {formatTime(currentTimeMs)}
        </span>

        {/* Interactive Custom Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekFromClick}
          className="relative flex-1 group py-2 flex items-center cursor-pointer"
        >
          {/* Base Track */}
          <div className="w-full h-1.5 group-hover:h-2 bg-charcoal-800 rounded-full overflow-hidden transition-all relative">
            {/* Gold Progress Fill */}
            <div
              className="h-full bg-gold-500 rounded-full transition-all duration-75 relative shadow-sm shadow-gold-500/50"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb Circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-gold-400 border-2 border-charcoal-950 rounded-full shadow-md transition-all duration-75 pointer-events-none group-hover:scale-125"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />

          {/* Accessible Native Range Slider (Invisible overlay for native touch/keyboard/drag support) */}
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
        <span className="text-xs font-mono text-parchment-400 min-w-[45px] text-right select-none">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: Speed selector */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onChangeSpeed(speed)}
              className={`px-2 py-1 rounded text-xs font-mono ltr-num transition-colors ${
                playbackRate === speed
                  ? "bg-gold-500/20 text-gold-300 font-bold border border-gold-500/30"
                  : "text-parchment-400 hover:text-parchment-200 hover:bg-charcoal-800"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevVerse}
            className="p-2 rounded-full text-parchment-300 hover:text-gold-400 hover:bg-charcoal-800 transition-colors"
            title="البيت السابق"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="p-3.5 rounded-full bg-gold-500 hover:bg-gold-400 text-charcoal-950 shadow-md shadow-gold-500/20 transition-transform active:scale-95"
            title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNextVerse}
            className="p-2 rounded-full text-parchment-300 hover:text-gold-400 hover:bg-charcoal-800 transition-colors"
            title="البيت التالي"
          >
            <SkipBack className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeVolume(volume === 0 ? 0.85 : 0)}
            className="text-parchment-400 hover:text-parchment-200 p-1"
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
            className="w-20 h-1.5 bg-charcoal-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
          />
        </div>
      </div>
    </div>
  );
};
