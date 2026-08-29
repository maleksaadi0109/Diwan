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
    <div className="bg-paper-100 border-t-2 border-paper-400 px-8 py-4 select-none flex flex-col gap-4 shrink-0 shadow-sm z-20 relative">
      {/* Timeline Slider & Time Stamps (Strict LTR for universal media timeline standard) */}
      <div className="flex items-center gap-4" dir="ltr">
        {/* Current Time */}
        <span className="text-[14px] font-mono text-accent-700 min-w-[50px] text-right select-none font-bold tracking-wider">
          {formatTime(currentTimeMs)}
        </span>

        {/* Interactive Custom Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekFromClick}
          className="relative flex-1 group py-3 flex items-center cursor-pointer"
        >
          {/* Base Track */}
          <div className="w-full h-1.5 group-hover:h-2 bg-paper-300 rounded-none overflow-hidden transition-all duration-300 relative border-y border-paper-400 shadow-inner">
            {/* Ink Progress Fill */}
            <div
              className="h-full bg-accent-700 rounded-none transition-all duration-75 relative border-y border-accent-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb Square */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-paper-100 border-[3px] border-accent-700 rounded-none shadow-sm transition-all duration-75 pointer-events-none group-hover:scale-125 group-hover:bg-accent-700"
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
        <span className="text-[14px] font-mono text-ink-600 min-w-[50px] text-left select-none tracking-wider font-bold">
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
              className={`px-3 py-1 text-[13px] font-mono ltr-num transition-colors border rounded-none ${
                playbackRate === speed
                  ? "bg-accent-700 text-paper-100 font-bold border-accent-700"
                  : "text-ink-700 hover:text-ink-900 border-transparent hover:bg-paper-200 font-bold"
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
            className="p-2.5 rounded-none text-ink-600 hover:text-accent-700 hover:bg-paper-200 transition-colors active:scale-95 border border-transparent"
            title="البيت السابق"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-14 h-14 rounded-none bg-accent-700 hover:bg-accent-600 text-paper-100 shadow-sm transition-all duration-300 active:scale-95 flex items-center justify-center border-2 border-accent-700"
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
            className="p-2.5 rounded-none text-ink-600 hover:text-accent-700 hover:bg-paper-200 transition-colors active:scale-95 border border-transparent"
            title="البيت التالي"
          >
            <SkipBack className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChangeVolume(volume === 0 ? 0.85 : 0)}
            className="text-ink-600 hover:text-accent-700 transition-colors p-2 rounded-none hover:bg-paper-200"
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
            className="w-24 h-1.5 bg-paper-300 rounded-none appearance-none cursor-pointer accent-accent-700 border border-paper-400"
          />
        </div>
      </div>
    </div>
  );
};
