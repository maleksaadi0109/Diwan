import React, { useState, useEffect } from "react";
import { Poem, AlignmentStatus } from "@/types";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import {
  Play,
  Pause,
  AlertTriangle,
  Split,
  Settings2
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

  const handleSplitVerse = () => {
    if (!selectedBoundary) return;
    const mid = selectedBoundary.startMs + Math.round((selectedBoundary.endMs - selectedBoundary.startMs) / 2);
    handleNudgeEnd(mid - selectedBoundary.endMs);
    setStatusMessage("تم تقسيم حدود البيت إلى شطرين متكافئين");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-sand-100 select-none">
      {/* Editor Header */}
      <div className="px-8 py-5 border-b border-sand-300 bg-sand-50/50 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-poetry text-2xl font-bold text-ink-950">
              محرر المحاذاة وتدقيق الحدود
            </h2>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sand-200 text-ink-700 border border-sand-300 flex items-center gap-1.5 shadow-sm">
              <Settings2 className="w-3.5 h-3.5" /> محرر دقيق
            </span>
          </div>
          <p className="text-xs text-ink-500 mt-1 font-sans tracking-wide">
            {poem.title} — {poem.poet.name} ({poem.verses.length} بيت)
          </p>
        </div>

        {statusMessage && (
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-center gap-2 shadow-sm font-medium animate-in fade-in zoom-in">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Canvas / Scrubber Visualizer */}
      <div className="p-6 border-b border-sand-300 bg-sand-100/50">
        <div className="bg-sand-50 p-4 rounded-xl border border-sand-300 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-ink-600 font-medium">
            <span>المخطط الزمني للقصيدة والتسجيل</span>
            <span className="font-mono ltr-num text-crimson-800 font-bold bg-crimson-800/5 px-2 py-0.5 rounded">
              {formatTime(currentTimeMs, true)}
            </span>
          </div>

          {/* Simulated Waveform Track */}
          <div className="relative h-20 bg-sand-100 rounded-lg overflow-hidden border border-sand-300 flex items-center px-3 shadow-inner">
            <div className="w-full flex items-center justify-between gap-[1px] h-12">
              {Array.from({ length: 80 }).map((_, i) => {
                const height = 15 + Math.sin(i * 0.5) * 35 + ((i % 4) * 10);
                const isInsideSelected =
                  selectedBoundary &&
                    (i / 80) * totalDuration >= selectedBoundary.startMs &&
                    (i / 80) * totalDuration <= selectedBoundary.endMs;

                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      isInsideSelected
                        ? "bg-crimson-800 shadow-[0_0_8px_rgba(106,26,34,0.4)] z-10"
                        : "bg-sand-300 hover:bg-sand-400"
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
        <div className="flex-1 overflow-y-auto p-6 space-y-3 border-l border-sand-300 bg-sand-100/30">
          {poem.verses.map((verse) => {
            const b = boundaries.get(verse.id);
            const isSelected = verse.id === selectedVerseId;
            const status = b?.status || "auto";

            return (
              <div
                key={verse.id}
                onClick={() => setSelectedVerseId(verse.id)}
                className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 font-sans tracking-wide ${
                  isSelected
                    ? "bg-sand-50 border-crimson-800/40 shadow-md ring-1 ring-crimson-800/20"
                    : "bg-sand-50/50 border-sand-300 hover:border-sand-400 hover:bg-sand-50"
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    isSelected ? "bg-crimson-800 text-sand-50" : "bg-sand-200 text-ink-600"
                  }`}>
                    {toArabicDigits(verse.orderIndex)}
                  </span>
                  <div className={`font-poetry text-xl truncate transition-colors ${
                    isSelected ? "text-crimson-900 font-bold" : "text-ink-900"
                  }`}>
                    <span>{verse.firstHemistich}</span>
                    <span className="text-sand-400 mx-3">...</span>
                    <span>{verse.secondHemistich}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {b ? (
                    <div className="text-right font-mono text-[13px] font-medium ltr-num text-ink-700 bg-sand-200/50 px-2 py-1 rounded">
                      <span>{formatTime(b.startMs, true)}</span>
                      <span className="text-sand-400 mx-2">→</span>
                      <span>{formatTime(b.endMs, true)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-400 px-4">—</span>
                  )}

                  <span
                    className={`px-3 py-1 rounded-md text-[11px] font-bold border w-24 text-center ${
                      !b
                        ? "bg-sand-200 text-ink-600 border-sand-300"
                        : status === "reviewed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : status === "manual"
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : status === "review"
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-sky-50 text-sky-700 border-sky-300"
                    }`}
                  >
                    {!b
                      ? "غير محاذى"
                      : status === "reviewed"
                      ? "مدقق"
                      : status === "manual"
                      ? "يدوي"
                      : status === "review"
                      ? "للمراجعة"
                      : "آلي"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Unaligned verse notice */}
        {selectedVerse && !selectedBoundary && (
          <div className="w-[420px] bg-sand-50 p-8 shrink-0 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-ink-900 font-poetry">
              البيت رقم {toArabicDigits(selectedVerse.orderIndex)}
            </h3>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm leading-relaxed flex items-start gap-3 shadow-inner">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
              <span>
                لا توجد محاذاة زمنية لهذا البيت — لم تنجح المحاذاة التلقائية أو حُفظت القصيدة بدون
                تسجيل صوتي محاذى. استخدم مشغّل القصيدة لإضافة الحدود يدوياً.
              </span>
            </div>
          </div>
        )}

        {/* Right: Fine Nudge & Inspection Controls */}
        {selectedVerse && selectedBoundary && (
          <div className="w-[420px] bg-sand-50 p-8 overflow-y-auto space-y-8 shrink-0 flex flex-col justify-between shadow-[inset_2px_0_12px_rgba(0,0,0,0.02)]">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-ink-950 flex items-center gap-3 font-poetry">
                  <span>البيت رقم {toArabicDigits(selectedVerse.orderIndex)}</span>
                  <span className="text-[11px] font-sans font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {Math.round((selectedBoundary.confidence || 0.85) * 100)}% دقة
                  </span>
                </h3>
                <p className="font-poetry text-[17px] text-ink-900 mt-4 p-5 bg-sand-100 rounded-xl border border-sand-300 leading-relaxed shadow-inner">
                  {selectedVerse.text}
                </p>
              </div>

              {/* Loop Audition Button */}
              <button
                onClick={toggleLoopPlay}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border shadow-sm ${
                  isPlayingLoop
                    ? "bg-crimson-800 text-sand-50 border-crimson-900 shadow-md"
                    : "bg-white text-ink-800 border-sand-300 hover:bg-sand-100"
                }`}
              >
                {isPlayingLoop ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlayingLoop ? "إيقاف التكرار التجريبي" : "استماع تكراري لحدود البيت (Loop)"}</span>
              </button>

              {/* Start Timestamp Adjuster */}
              <div className="bg-sand-100 p-5 rounded-xl border border-sand-300 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-800 font-bold font-sans">طابع البداية:</span>
                  <span className="font-mono ltr-num text-crimson-800 font-bold bg-white px-2 py-0.5 rounded border border-sand-300">
                    {formatTime(selectedBoundary.startMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleNudgeStart(-200)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    -200
                  </button>
                  <button
                    onClick={() => handleNudgeStart(-50)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    -50
                  </button>
                  <button
                    onClick={() => handleNudgeStart(50)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    +50
                  </button>
                  <button
                    onClick={() => handleNudgeStart(200)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    +200
                  </button>
                </div>
              </div>

              {/* End Timestamp Adjuster */}
              <div className="bg-sand-100 p-5 rounded-xl border border-sand-300 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-800 font-bold font-sans">طابع النهاية:</span>
                  <span className="font-mono ltr-num text-crimson-800 font-bold bg-white px-2 py-0.5 rounded border border-sand-300">
                    {formatTime(selectedBoundary.endMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleNudgeEnd(-200)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    -200
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(-50)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    -50
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(50)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    +50
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(200)}
                    className="py-1.5 bg-white hover:bg-sand-200 text-xs font-mono rounded-lg text-ink-800 border border-sand-300 transition-colors font-medium shadow-sm"
                  >
                    +200
                  </button>
                </div>
              </div>

              {/* Split action */}
              <div className="flex gap-2">
                <button
                  onClick={handleSplitVerse}
                  className="flex-1 py-2.5 bg-white hover:bg-sand-200 border border-sand-300 rounded-xl text-xs font-bold text-ink-800 flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Split className="w-4 h-4 text-ink-500" />
                  <span>توسيط نقطة النهاية (شطرين متكافئين)</span>
                </button>
              </div>
            </div>

            {/* Status Validation Actions */}
            <div className="pt-6 border-t border-sand-300 space-y-3">
              <span className="text-xs font-bold text-ink-800 font-sans tracking-wide block">حالة التدقيق:</span>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleStatusToggle("auto")}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors shadow-sm ${
                    selectedBoundary.status === "auto"
                      ? "bg-sky-100 text-sky-800 border-sky-300 ring-2 ring-sky-300/50 ring-offset-1 ring-offset-sand-50"
                      : "bg-white text-ink-600 border-sand-300 hover:bg-sand-100"
                  }`}
                >
                  آلي
                </button>
                <button
                  onClick={() => handleStatusToggle("reviewed")}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors shadow-sm ${
                    selectedBoundary.status === "reviewed"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-300/50 ring-offset-1 ring-offset-sand-50"
                      : "bg-white text-ink-600 border-sand-300 hover:bg-sand-100"
                  }`}
                >
                  مدقق
                </button>
                <button
                  onClick={() => handleStatusToggle("manual")}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors shadow-sm ${
                    selectedBoundary.status === "manual"
                      ? "bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-300/50 ring-offset-1 ring-offset-sand-50"
                      : "bg-white text-ink-600 border-sand-300 hover:bg-sand-100"
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
