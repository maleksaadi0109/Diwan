import React, { useState, useRef, useEffect } from "react";
import { Poem, Verse, AlignmentStatus } from "@/types";
import { formatTime, toArabicDigits } from "@/lib/utils";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Split,
  Combine,
  Save,
} from "lucide-react";

interface BoundaryReviewEditorProps {
  poem: Poem;
  onUpdateBoundary: (
    alignmentId: string,
    startMs: number,
    endMs: number,
    status?: AlignmentStatus
  ) => void;
  onSelectPoem?: (poemId: string) => void;
}

export const BoundaryReviewEditor: React.FC<BoundaryReviewEditorProps> = ({
  poem,
  onUpdateBoundary,
}) => {
  const [selectedVerseId, setSelectedVerseId] = useState<string>(
    poem.verses[0]?.id || ""
  );
  const [isPlayingLoop, setIsPlayingLoop] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Local state copy of verse boundaries for fast responsive dragging/nudging
  const [boundaries, setBoundaries] = useState<
    Map<string, { startMs: number; endMs: number; status: AlignmentStatus; confidence: number }>
  >(() => {
    const map = new Map();
    poem.verses.forEach((v, i) => {
      map.set(v.id, {
        startMs: v.alignment?.startMs ?? i * 8000,
        endMs: v.alignment?.endMs ?? (i + 1) * 8000,
        status: v.alignment?.status ?? "auto",
        confidence: v.alignment?.confidence ?? 0.85,
      });
    });
    return map;
  });

  const selectedVerse = poem.verses.find((v) => v.id === selectedVerseId) || poem.verses[0];
  const selectedBoundary = selectedVerse ? boundaries.get(selectedVerse.id) : null;
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop loop on unmount
  useEffect(() => {
    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, []);

  const handleNudgeStart = (deltaMs: number) => {
    if (!selectedVerse || !selectedBoundary) return;
    const nextStart = Math.max(0, selectedBoundary.startMs + deltaMs);
    if (nextStart >= selectedBoundary.endMs - 300) {
      setStatusMessage("لا يمكن أن تكون بداية البيت بعد نهايته!");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    const updated = {
      ...selectedBoundary,
      startMs: nextStart,
      status: "manual" as AlignmentStatus,
    };

    setBoundaries((prev) => new Map(prev).set(selectedVerse.id, updated));
    if (selectedVerse.alignment) {
      onUpdateBoundary(selectedVerse.alignment.id, updated.startMs, updated.endMs, "manual");
    }
  };

  const handleNudgeEnd = (deltaMs: number) => {
    if (!selectedVerse || !selectedBoundary) return;
    const nextEnd = selectedBoundary.endMs + deltaMs;
    if (nextEnd <= selectedBoundary.startMs + 300) {
      setStatusMessage("لا يمكن أن تكون نهاية البيت قبل بدايته!");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    const updated = {
      ...selectedBoundary,
      endMs: nextEnd,
      status: "manual" as AlignmentStatus,
    };

    setBoundaries((prev) => new Map(prev).set(selectedVerse.id, updated));
    if (selectedVerse.alignment) {
      onUpdateBoundary(selectedVerse.alignment.id, updated.startMs, updated.endMs, "manual");
    }
  };

  const handleStatusToggle = (status: AlignmentStatus) => {
    if (!selectedVerse || !selectedBoundary) return;
    const updated = { ...selectedBoundary, status };
    setBoundaries((prev) => new Map(prev).set(selectedVerse.id, updated));
    if (selectedVerse.alignment) {
      onUpdateBoundary(selectedVerse.alignment.id, updated.startMs, updated.endMs, status);
    }
  };

  const toggleLoopPlay = () => {
    if (isPlayingLoop) {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
      setIsPlayingLoop(false);
    } else {
      if (!selectedBoundary) return;
      setIsPlayingLoop(true);
      setCurrentTimeMs(selectedBoundary.startMs);

      loopTimerRef.current = setInterval(() => {
        setCurrentTimeMs((prev) => {
          if (prev >= selectedBoundary.endMs) {
            return selectedBoundary.startMs;
          }
          return prev + 100;
        });
      }, 100);
    }
  };

  // Split selected verse evenly into two
  const handleSplitVerse = () => {
    if (!selectedBoundary) return;
    const mid = selectedBoundary.startMs + Math.round((selectedBoundary.endMs - selectedBoundary.startMs) / 2);
    handleNudgeEnd(mid - selectedBoundary.endMs);
    setStatusMessage("تم تقسيم حدود البيت إلى شطرين متكافئين");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-charcoal-950 select-none">
      {/* Editor Header */}
      <div className="px-8 py-4 border-b border-charcoal-850 bg-charcoal-900/30 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-poetry text-2xl font-bold text-parchment-50">
              محرر المحاذاة وتدقيق الحدود الزمنية
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gold-500/15 text-gold-300 border border-gold-500/30">
              محرر دقيق
            </span>
          </div>
          <p className="text-xs text-parchment-400 mt-0.5">
            {poem.title} — {poem.poet.name} ({poem.verses.length} بيت)
          </p>
        </div>

        {statusMessage && (
          <div className="px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Canvas / Scrubber Visualizer */}
      <div className="p-6 border-b border-charcoal-850 bg-charcoal-900/20">
        <div className="bg-charcoal-950 p-4 rounded-2xl border border-charcoal-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-parchment-400">
            <span>المخطط الزمني للقصيدة والتسجيل</span>
            <span className="font-mono ltr-num text-gold-400">
              {formatTime(currentTimeMs, true)}
            </span>
          </div>

          {/* Simulated Waveform Track */}
          <div className="relative h-20 bg-charcoal-900 rounded-xl overflow-hidden border border-charcoal-800 flex items-center px-2">
            <div className="w-full flex items-center justify-between gap-0.5 h-12">
              {Array.from({ length: 64 }).map((_, i) => {
                const height = 15 + Math.sin(i * 0.4) * 35 + ((i % 3) * 10);
                const isInsideSelected =
                  selectedBoundary &&
                  (i / 64) * (poem.verses.length * 8000) >= selectedBoundary.startMs &&
                  (i / 64) * (poem.verses.length * 8000) <= selectedBoundary.endMs;

                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all ${
                      isInsideSelected
                        ? "bg-gold-500 opacity-90 shadow-sm"
                        : "bg-charcoal-700 opacity-40 hover:opacity-70"
                    }`}
                    style={{ height: `${Math.max(10, Math.min(100, height))}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Verses Table & Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Verses List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 border-l border-charcoal-850">
          {poem.verses.map((verse) => {
            const b = boundaries.get(verse.id);
            const isSelected = verse.id === selectedVerseId;
            const status = b?.status || "auto";

            return (
              <div
                key={verse.id}
                onClick={() => setSelectedVerseId(verse.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isSelected
                    ? "bg-gold-500/10 border-gold-500/40 shadow-md"
                    : "bg-charcoal-900/60 border-charcoal-800 hover:border-charcoal-700"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-charcoal-800 text-gold-400 text-xs flex items-center justify-center font-bold font-mono">
                    {toArabicDigits(verse.orderIndex)}
                  </span>
                  <div className="font-poetry text-base text-parchment-100 truncate">
                    <span>{verse.firstHemistich}</span>
                    <span className="text-gold-500/40 mx-2">...</span>
                    <span>{verse.secondHemistich}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right font-mono text-xs ltr-num text-parchment-300">
                    <span>{formatTime(b?.startMs || 0, true)}</span>
                    <span className="text-charcoal-600 mx-1">→</span>
                    <span>{formatTime(b?.endMs || 0, true)}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      status === "reviewed"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : status === "manual"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-sky-500/15 text-sky-300 border-sky-500/30"
                    }`}
                  >
                    {status === "reviewed" ? "مدقق" : status === "manual" ? "يدوي" : "آلي"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Fine Nudge & Inspection Controls */}
        {selectedVerse && selectedBoundary && (
          <div className="w-96 bg-charcoal-900/50 p-6 overflow-y-auto space-y-6 shrink-0 flex flex-col justify-between">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-parchment-100 flex items-center gap-2">
                  <span>البيت رقم {toArabicDigits(selectedVerse.orderIndex)}</span>
                  <span className="text-xs font-normal text-gold-400">
                    ({Math.round((selectedBoundary.confidence || 0.85) * 100)}% دقة المطابقة)
                  </span>
                </h3>
                <p className="font-poetry text-sm text-parchment-200 mt-2 p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 leading-relaxed">
                  {selectedVerse.text}
                </p>
              </div>

              {/* Loop Audition Button */}
              <button
                onClick={toggleLoopPlay}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                  isPlayingLoop
                    ? "bg-amber-500 text-charcoal-950 border-amber-400"
                    : "bg-gold-500/15 hover:bg-gold-500/25 text-gold-300 border-gold-500/30"
                }`}
              >
                {isPlayingLoop ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlayingLoop ? "إيقاف التكرار التجريبي" : "استماع تكراري لحدود البيت (Loop)"}</span>
              </button>

              {/* Start Timestamp Adjuster */}
              <div className="bg-charcoal-950 p-4 rounded-xl border border-charcoal-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-parchment-300 font-semibold">طابع البداية:</span>
                  <span className="font-mono ltr-num text-gold-400 font-bold">
                    {formatTime(selectedBoundary.startMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => handleNudgeStart(-200)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    -200ms
                  </button>
                  <button
                    onClick={() => handleNudgeStart(-50)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    -50ms
                  </button>
                  <button
                    onClick={() => handleNudgeStart(50)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    +50ms
                  </button>
                  <button
                    onClick={() => handleNudgeStart(200)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    +200ms
                  </button>
                </div>
              </div>

              {/* End Timestamp Adjuster */}
              <div className="bg-charcoal-950 p-4 rounded-xl border border-charcoal-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-parchment-300 font-semibold">طابع النهاية:</span>
                  <span className="font-mono ltr-num text-gold-400 font-bold">
                    {formatTime(selectedBoundary.endMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => handleNudgeEnd(-200)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    -200ms
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(-50)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    -50ms
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(50)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    +50ms
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(200)}
                    className="py-1 bg-charcoal-850 hover:bg-charcoal-800 text-[11px] font-mono rounded text-parchment-200 border border-charcoal-750"
                  >
                    +200ms
                  </button>
                </div>
              </div>

              {/* Split & Merge actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSplitVerse}
                  className="flex-1 py-2 bg-charcoal-850 hover:bg-charcoal-800 border border-charcoal-750 rounded-xl text-xs text-parchment-300 flex items-center justify-center gap-1.5"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>توسيط الشطرين</span>
                </button>
              </div>
            </div>

            {/* Status Validation Actions */}
            <div className="pt-4 border-t border-charcoal-800 space-y-2">
              <span className="text-xs text-parchment-400 block">حالة التدقيق:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleStatusToggle("auto")}
                  className={`py-1.5 rounded-lg text-xs font-semibold border ${
                    selectedBoundary.status === "auto"
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      : "bg-charcoal-850 text-parchment-400 border-charcoal-750"
                  }`}
                >
                  آلي
                </button>
                <button
                  onClick={() => handleStatusToggle("reviewed")}
                  className={`py-1.5 rounded-lg text-xs font-semibold border ${
                    selectedBoundary.status === "reviewed"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-charcoal-850 text-parchment-400 border-charcoal-750"
                  }`}
                >
                  مدقق
                </button>
                <button
                  onClick={() => handleStatusToggle("manual")}
                  className={`py-1.5 rounded-lg text-xs font-semibold border ${
                    selectedBoundary.status === "manual"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-charcoal-850 text-parchment-400 border-charcoal-750"
                  }`}
                >
                  يدوي
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
