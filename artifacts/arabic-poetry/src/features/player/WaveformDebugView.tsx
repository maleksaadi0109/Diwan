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
    <div className="bg-sand-50 border-t border-sand-300 p-4 select-none animate-fadeIn">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3 text-emerald-400 font-bold">
            <span>⚡ Waveform VAD & Verse Boundaries Debug Map</span>
            <span className="text-[10px] text-ink-600 font-normal">
              (Green: Speech | Gray: Silence | Gold Lines: Verse Boundaries)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-ink-800 text-xs px-2 py-0.5 rounded bg-sand-200 border border-sand-400"
          >
            إخفاء المخطط
          </button>
        </div>

        {/* Waveform Visualizer Bar */}
        <div className="relative h-14 bg-sand-100 rounded-xl border border-sand-300 overflow-hidden" dir="ltr">
          {/* Base Silence Background (Gray) */}
          <div className="absolute inset-0 bg-sand-50/80" />

          {/* Speech Regions (Green) based on verse alignments */}
          {poem.verses.map((v, i) => {
            if (!v.alignment) return null;
            const start = (v.alignment.startMs / totalDuration) * 100;
            const width = Math.max(0.5, ((v.alignment.endMs - v.alignment.startMs) / totalDuration) * 100);
            const isCurrent = i === activeVerseIndex;

            return (
              <div
                key={v.id}
                className={`absolute top-2 bottom-2 rounded transition-all duration-75 ${
                  isCurrent
                    ? "bg-emerald-500/80 ring-2 ring-crimson-700/80 shadow-md shadow-emerald-500/30"
                    : "bg-emerald-600/40 hover:bg-emerald-500/60"
                }`}
                style={{ left: `${start}%`, width: `${width}%` }}
                title={`البيت ${i + 1}: ${formatTime(v.alignment.startMs)} - ${formatTime(v.alignment.endMs)}`}
              >
                {/* Hemistich split separator inside verse */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-sand-100/60" />
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
                className="absolute top-0 bottom-0 w-[1.5px] bg-crimson-700/80 z-10 shadow-sm"
                style={{ left: `${pos}%` }}
              />
            );
          })}

          {/* Active Verse Highlight Zone */}
          {activeVerse && (
            <div
              className="absolute top-0 bottom-0 bg-crimson-800/10 border-x border-crimson-700/60 z-15 pointer-events-none"
              style={{
                left: `${activeStartPercent}%`,
                width: `${Math.max(0.5, activeEndPercent - activeStartPercent)}%`,
              }}
            />
          )}

          {/* Current Audio Playhead Needle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 shadow-md shadow-rose-500/60 transition-all duration-75"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="w-2 h-2 rounded-full bg-rose-500 -ml-[3px] -mt-0.5 shadow-sm" />
          </div>
        </div>

        {/* Legend & Current metrics */}
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-600" dir="ltr">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>Speech Region</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sand-200 border border-sand-400 inline-block" />
              <span>Silence Pause (&ge;280ms)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-crimson-700 inline-block" />
              <span>Verse Boundary</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-ink-700">
            <span>Playhead:</span>
            <span className="text-crimson-700 font-bold">{formatTime(currentTimeMs)} ({currentTimeMs}ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
