import React from "react";
import { Poem } from "@/types";
import { formatTime } from "@/lib/utils";

interface WaveformDebugViewProps {
  poem: Poem;
  currentTimeMs: number;
  durationMs: number;
  activeVerseIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const WaveformDebugView: React.FC<WaveformDebugViewProps> = ({
  poem,
  currentTimeMs,
  durationMs,
  activeVerseIndex,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const totalDuration = durationMs || 60000;
  const currentPercent = (currentTimeMs / totalDuration) * 100;

  // Active verse boundary
  const activeVerse = activeVerseIndex >= 0 && activeVerseIndex < poem.verses.length ? poem.verses[activeVerseIndex] : null;
  const activeStartPercent = activeVerse?.alignment ? (activeVerse.alignment.startMs / totalDuration) * 100 : 0;
  const activeEndPercent = activeVerse?.alignment ? (activeVerse.alignment.endMs / totalDuration) * 100 : 0;

  return (
    <div className="bg-paper-100 border-t border-paper-400 p-4 select-none animate-fadeIn font-ui">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between text-[13px] font-mono font-bold">
          <div className="flex items-center gap-3 text-green-800">
            <span>⚡ Waveform VAD & Verse Boundaries Debug Map</span>
            <span className="text-[11px] text-ink-600 font-bold">
              (Green: Speech | Gray: Silence | Gold Lines: Verse Boundaries)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-ink-700 hover:text-ink-900 text-[12px] px-3 py-1 bg-paper-200 border border-paper-400 rounded-none transition-colors"
          >
            إخفاء المخطط
          </button>
        </div>

        {/* Waveform Visualizer Bar */}
        <div className="relative h-14 bg-paper-300 rounded-none border border-paper-400 overflow-hidden shadow-inner" dir="ltr">
          {/* Base Silence Background (Gray) */}
          <div className="absolute inset-0 bg-paper-200/80" />

          {/* Speech Regions (Green) based on verse alignments */}
          {poem.verses.map((v, i) => {
            if (!v.alignment) return null;
            const start = (v.alignment.startMs / totalDuration) * 100;
            const width = Math.max(0.5, ((v.alignment.endMs - v.alignment.startMs) / totalDuration) * 100);
            const isCurrent = i === activeVerseIndex;

            return (
              <div
                key={v.id}
                className={`absolute top-2 bottom-2 rounded-none transition-all duration-75 ${
                  isCurrent
                    ? "bg-green-700/80 ring-2 ring-accent-700 shadow-sm"
                    : "bg-green-700/40 hover:bg-green-700/60"
                }`}
                style={{ left: `${start}%`, width: `${width}%` }}
                title={`البيت ${i + 1}: ${formatTime(v.alignment.startMs)} - ${formatTime(v.alignment.endMs)}`}
              >
                {/* Hemistich split separator inside verse */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-paper-100/60" />
              </div>
            );
          })}

          {/* Verse Boundaries as Gold Vertical Lines */}
          {poem.verses.map((v) => {
            if (!v.alignment) return null;
            const pos = (v.alignment.startMs / totalDuration) * 100;
            return (
              <div
                key={`b-${v.id}`}
                className="absolute top-0 bottom-0 w-[1.5px] bg-accent-700/80 z-10 shadow-sm"
                style={{ left: `${pos}%` }}
              />
            );
          })}

          {/* Active Verse Highlight Zone */}
          {activeVerse && (
            <div
              className="absolute top-0 bottom-0 bg-accent-700/10 border-x border-accent-700/60 z-15 pointer-events-none"
              style={{
                left: `${activeStartPercent}%`,
                width: `${Math.max(0.5, activeEndPercent - activeStartPercent)}%`,
              }}
            />
          )}

          {/* Current Audio Playhead Needle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-ink-900 z-20 shadow-sm transition-all duration-75"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="w-2.5 h-2.5 rounded-none bg-ink-900 -ml-[4px] -mt-1 shadow-sm" />
          </div>
        </div>

        {/* Legend & Current metrics */}
        <div className="flex items-center justify-between text-[12px] font-mono text-ink-700 font-bold" dir="ltr">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-none bg-green-700 inline-block" />
              <span>Speech Region</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-none bg-paper-200 border border-paper-400 inline-block" />
              <span>Silence Pause (&ge;280ms)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-accent-700 inline-block" />
              <span>Verse Boundary</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-ink-800">
            <span>Playhead:</span>
            <span className="text-accent-700 font-bold">{formatTime(currentTimeMs)} ({currentTimeMs}ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
