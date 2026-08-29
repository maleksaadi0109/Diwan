import React, { useState, useEffect } from "react";
import { Poem, AlignmentStatus } from "@/types";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import {
  Play,
  Pause,
  AlertTriangle,
  Split,
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    currentTimeMs,
    durationMs,
    isPlaying,
    play,
    pause,
    seekTo,
  } = usePoemPlayback(poem);

  // Local state copy of verse boundaries for fast responsive dragging/nudging
  const [boundaries, setBoundaries] = useState<
    Map<string, { startMs: number; endMs: number; status: AlignmentStatus; confidence: number }>
  >(() => {
    const map = new Map();
    // Only verses with a real alignment get boundaries — no fabricated
    // 8-second slots; unaligned verses are shown explicitly as such.
    poem.verses.forEach((v) => {
      if (v.alignment) {
        map.set(v.id, {
          startMs: v.alignment.startMs,
          endMs: v.alignment.endMs,
          status: v.alignment.status,
          confidence: v.alignment.confidence,
        });
      }
    });
    return map;
  });

  const selectedVerse = poem.verses.find((v) => v.id === selectedVerseId) || poem.verses[0];
  const selectedBoundary = selectedVerse ? boundaries.get(selectedVerse.id) : null;

  useEffect(() => {
    const next = new Map<string, { startMs: number; endMs: number; status: AlignmentStatus; confidence: number }>();
    poem.verses.forEach((verse) => {
      if (verse.alignment) {
        next.set(verse.id, {
          startMs: verse.alignment.startMs,
          endMs: verse.alignment.endMs,
          status: verse.alignment.status,
          confidence: verse.alignment.confidence,
        });
      }
    });
    setBoundaries(next);
    setSelectedVerseId(poem.verses[0]?.id || "");
  }, [poem.id]);

  useEffect(() => {
    if (!isPlayingLoop || !isPlaying || !selectedBoundary) return;
    if (currentTimeMs >= selectedBoundary.endMs) {
      seekTo(selectedBoundary.startMs);
    }
  }, [currentTimeMs, isPlaying, isPlayingLoop, seekTo, selectedBoundary]);

  const handleNudgeStart = (deltaMs: number) => {
    if (!selectedVerse || !selectedBoundary) return;
    const nextStart = Math.max(0, selectedBoundary.startMs + deltaMs);
    if (nextStart >= selectedBoundary.endMs - 300) {
      setStatusMessage("لا يمكن أن تكون بداية البيت بعد نهايته!");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const previous = poem.verses[poem.verses.findIndex((verse) => verse.id === selectedVerse.id) - 1]?.alignment;
    if (previous && nextStart < previous.endMs) {
      setStatusMessage("لا يمكن أن تتداخل بداية البيت مع نهاية البيت السابق!");
      return;
    }

    const updated = {
      ...selectedBoundary,
      startMs: nextStart,
      status: "manual" as AlignmentStatus,
    };

    setBoundaries((prev) => new Map(prev).set(selectedVerse.id, updated));
    if (selectedVerse.alignment) {
      void Promise.resolve(onUpdateBoundary(selectedVerse.alignment.id, updated.startMs, updated.endMs, "manual"))
        .catch((error) => setStatusMessage(error instanceof Error ? error.message : "تعذر حفظ التعديل."));
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
    if (durationMs > 0 && nextEnd > durationMs) {
      setStatusMessage("لا يمكن أن تتجاوز نهاية البيت مدة التسجيل!");
      return;
    }
    const next = poem.verses[poem.verses.findIndex((verse) => verse.id === selectedVerse.id) + 1]?.alignment;
    if (next && nextEnd > next.startMs) {
      setStatusMessage("لا يمكن أن تتداخل نهاية البيت مع بداية البيت التالي!");
      return;
    }

    const updated = {
      ...selectedBoundary,
      endMs: nextEnd,
      status: "manual" as AlignmentStatus,
    };

    setBoundaries((prev) => new Map(prev).set(selectedVerse.id, updated));
    if (selectedVerse.alignment) {
      void Promise.resolve(onUpdateBoundary(selectedVerse.alignment.id, updated.startMs, updated.endMs, "manual"))
        .catch((error) => setStatusMessage(error instanceof Error ? error.message : "تعذر حفظ التعديل."));
    }
  };

  const handleStatusToggle = (status: AlignmentStatus) => {
    if (!selectedVerse || !selectedBoundary) return;
    const updated = { ...selectedBoundary, status };
    setBoundaries((prev) => new Map(prev).set(selectedVerse.id, updated));
    if (selectedVerse.alignment) {
      void Promise.resolve(onUpdateBoundary(selectedVerse.alignment.id, updated.startMs, updated.endMs, status))
        .catch((error) => setStatusMessage(error instanceof Error ? error.message : "تعذر حفظ الحالة."));
    }
  };

  const toggleLoopPlay = () => {
    if (isPlayingLoop) {
      setIsPlayingLoop(false);
      pause();
    } else {
      if (!selectedBoundary) return;
      setIsPlayingLoop(true);
      seekTo(selectedBoundary.startMs);
      void play();
    }
  };

  const lastAlignedEnd = poem.verses.reduce(
    (max, v) => (v.alignment ? Math.max(max, v.alignment.endMs) : max),
    0
  );
  const totalDuration = durationMs || poem.recordings[0]?.durationMs || lastAlignedEnd;

  // Move the selected boundary to the middle for quick manual auditioning.
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
                    (i / 64) * totalDuration >= selectedBoundary.startMs &&
                    (i / 64) * totalDuration <= selectedBoundary.endMs;

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
                  {b ? (
                    <div className="text-right font-mono text-xs ltr-num text-parchment-300">
                      <span>{formatTime(b.startMs, true)}</span>
                      <span className="text-charcoal-600 mx-1">→</span>
                      <span>{formatTime(b.endMs, true)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-parchment-500">—</span>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      !b
                        ? "bg-charcoal-800 text-parchment-400 border-charcoal-700"
                        : status === "reviewed"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : status === "manual"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : status === "review"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : "bg-sky-500/15 text-sky-300 border-sky-500/30"
                    }`}
                  >
                    {!b
                      ? "غير محاذى"
                      : status === "reviewed"
                      ? "مدقق"
                      : status === "manual"
                      ? "يدوي"
                      : status === "review"
                      ? "بحاجة لمراجعة"
                      : "آلي"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Unaligned verse notice */}
        {selectedVerse && !selectedBoundary && (
          <div className="w-96 bg-charcoal-900/50 p-6 shrink-0 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-parchment-100">
              البيت رقم {toArabicDigits(selectedVerse.orderIndex)}
            </h3>
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                لا توجد محاذاة زمنية لهذا البيت — لم تنجح المحاذاة التلقائية أو حُفظت القصيدة بدون
                تسجيل صوتي محاذى. لا تُعرض حدود زمنية مصطنعة؛ أعد تشغيل المحاذاة من الاستيراد أو
                أضف الحدود يدويًا من مشغّل القصيدة.
              </span>
            </div>
          </div>
        )}

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
