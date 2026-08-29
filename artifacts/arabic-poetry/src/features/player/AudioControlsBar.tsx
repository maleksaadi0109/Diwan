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
    <div className="bg-sand-50/80 backdrop-blur border-t border-sand-300 px-8 py-4 select-none flex flex-col gap-4 shrink-0 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.05)] z-20">
      {/* Timeline Slider & Time Stamps (Strict LTR for universal media timeline standard) */}
      <div className="flex items-center gap-4" dir="ltr">
        {/* Current Time */}
        <span className="text-[13px] font-mono text-crimson-800 min-w-[50px] text-right select-none font-bold tracking-wider">
          {formatTime(currentTimeMs)}
        </span>

        {/* Interactive Custom Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekFromClick}
          className="relative flex-1 group py-3 flex items-center cursor-pointer"
        >
          {/* Base Track */}
          <div className="w-full h-1.5 group-hover:h-2 bg-sand-200/80 rounded-full overflow-hidden transition-all duration-300 relative shadow-inner">
            {/* Crimson Progress Fill */}
            <div
              className="h-full bg-crimson-800 rounded-full transition-all duration-75 relative shadow-[0_0_8px_rgba(106,26,34,0.4)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb Circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-sand-50 border-[3px] border-crimson-800 rounded-full shadow-md transition-all duration-75 pointer-events-none group-hover:scale-125 group-hover:bg-crimson-800"
            style={{ left: `calc(${progressPercent}% - 8px)` }}
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
        <span className="text-[13px] font-mono text-ink-500 min-w-[50px] text-left select-none tracking-wider">
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
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono ltr-num transition-all duration-300 ${
                playbackRate === speed
                  ? "bg-crimson-800 text-sand-50 font-bold shadow-sm"
                  : "text-ink-600 hover:text-ink-900 hover:bg-sand-200 font-medium"
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
            className="p-2.5 rounded-full text-ink-500 hover:text-crimson-800 hover:bg-sand-200/80 transition-colors"
            title="البيت السابق"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-14 h-14 rounded-full bg-crimson-800 hover:bg-crimson-700 text-sand-50 shadow-[0_4px_12px_-2px_rgba(106,26,34,0.3)] transition-transform duration-200 active:scale-95 flex items-center justify-center border border-crimson-900"
            title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </button>

          <button
            onClick={onNextVerse}
            className="p-2.5 rounded-full text-ink-500 hover:text-crimson-800 hover:bg-sand-200/80 transition-colors"
            title="البيت التالي"
          >
            <SkipBack className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChangeVolume(volume === 0 ? 0.85 : 0)}
            className="text-ink-500 hover:text-crimson-800 transition-colors p-1.5 rounded-full hover:bg-sand-200/80"
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
            className="w-24 h-1.5 bg-sand-300 rounded-lg appearance-none cursor-pointer accent-crimson-800"
          />
        </div>
      </div>
    </div>
  );
};
