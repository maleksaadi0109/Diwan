import React, { useState, useEffect } from "react";
import { Poem, AlignmentStatus } from "@/types";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import {
  Play,
  Pause,
  AlertTriangle,
  Split,
  Sliders
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
    <div className="h-full flex flex-col justify-between overflow-hidden bg-paper-200 select-none text-ink-900 relative">
      {/* Editor Header */}
      <div className="px-8 py-4 border-b-2 border-paper-400 bg-paper-100 flex items-center justify-between shrink-0 relative z-10">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="font-heading text-3xl font-bold text-ink-900 tracking-wide mt-1">
              محرر المحاذاة وتدقيق الحدود
            </h2>
            <span className="px-3 py-1 bg-paper-200 text-accent-700 border border-paper-400 flex items-center gap-1.5 shadow-sm text-[12px] font-bold rounded-none">
              <Sliders className="w-3.5 h-3.5 text-accent-700" /> محرر دقيق
            </span>
          </div>
          <p className="text-[14px] text-ink-600 mt-2 font-ui font-bold">
            {poem.title} — {poem.poet.name} ({toArabicDigits(poem.verses.length)} بيت)
          </p>
        </div>

        {statusMessage && (
          <div className="px-5 py-2.5 bg-amber-50 border border-amber-800 text-amber-800 text-[14px] flex items-center gap-2 shadow-sm font-bold font-ui animate-in fade-in zoom-in rounded-none">
            <AlertTriangle className="w-5 h-5 text-amber-800" strokeWidth={2.5} />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Canvas / Scrubber Visualizer */}
      <div className="p-6 border-b border-paper-400 bg-paper-200 relative z-0">
        <div className="bg-paper-100 p-5 border border-paper-400 shadow-sm space-y-4 rounded-none">
          <div className="flex items-center justify-between text-[14px] text-ink-700 font-bold font-ui">
            <span>المخطط الزمني للقصيدة والتسجيل</span>
            <span className="font-mono ltr-num text-ink-900 font-bold bg-paper-300 px-3 py-1 border border-paper-400 rounded-none shadow-sm">
              {formatTime(currentTimeMs, true)}
            </span>
          </div>

          {/* Simulated Waveform Track */}
          <div className="relative h-20 bg-paper-300 border border-paper-400 flex items-center px-3 shadow-inner rounded-none">
            <div className="w-full flex items-center justify-between gap-[2px] h-14">
              {Array.from({ length: 80 }).map((_, i) => {
                const height = 15 + Math.sin(i * 0.5) * 35 + ((i % 4) * 10);
                const isInsideSelected =
                  selectedBoundary &&
                    (i / 80) * totalDuration >= selectedBoundary.startMs &&
                    (i / 80) * totalDuration <= selectedBoundary.endMs;

                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-none transition-all duration-300 ${
                      isInsideSelected
                        ? "bg-accent-700 shadow-sm z-10 scale-y-110"
                        : "bg-paper-400 hover:bg-paper-500"
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4 border-l-2 border-paper-400 bg-paper-200 scroll-smooth">
          {poem.verses.map((verse) => {
            const b = boundaries.get(verse.id);
            const isSelected = verse.id === selectedVerseId;
            const status = b?.status || "auto";

            return (
              <div
                key={verse.id}
                onClick={() => setSelectedVerseId(verse.id)}
                className={`p-5 rounded-none border transition-colors cursor-pointer flex items-center justify-between gap-5 font-ui relative ${
                  isSelected
                    ? "bg-paper-100 border-accent-700 ring-1 ring-accent-700 shadow-sm"
                    : "bg-transparent border-transparent hover:bg-paper-100 hover:border-paper-400"
                }`}
              >
                {isSelected && <div className="absolute inset-y-0 right-0 w-1.5 bg-accent-700" />}

                <div className="flex items-center gap-5 flex-1 min-w-0 pr-2">
                  <span className={`w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors font-mono border rounded-none shrink-0 ${
                    isSelected ? "bg-accent-700 text-paper-100 border-accent-700 shadow-sm" : "bg-transparent text-ink-600 border-ink-400"
                  }`}>
                    {toArabicDigits(verse.orderIndex)}
                  </span>
                  <div className={`font-poetry text-[22px] truncate transition-colors ${
                    isSelected ? "text-ink-900 font-bold" : "text-ink-800"
                  }`}>
                    <span>{verse.firstHemistich}</span>
                    <span className="text-accent-700 mx-3 font-ui text-sm font-bold">✦</span>
                    <span>{verse.secondHemistich}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {b ? (
                    <div className="text-right font-mono text-[14px] font-bold ltr-num text-ink-900 bg-paper-200 px-3 py-1 border border-paper-400 shadow-sm rounded-none">
                      <span>{formatTime(b.startMs, true)}</span>
                      <span className="text-paper-500 mx-2 font-ui">—</span>
                      <span>{formatTime(b.endMs, true)}</span>
                    </div>
                  ) : (
                    <span className="text-[14px] font-bold text-ink-500 px-4 font-ui">—</span>
                  )}

                  <span
                    className={`px-3 py-1 text-[12px] font-bold border w-24 text-center rounded-none shadow-sm ${
                      !b
                        ? "bg-paper-200 text-ink-700 border-paper-400"
                        : status === "reviewed"
                        ? "bg-green-50 text-green-800 border-green-800"
                        : status === "manual"
                        ? "bg-amber-50 text-amber-800 border-amber-800"
                        : status === "review"
                        ? "bg-red-50 text-red-800 border-red-800"
                        : "bg-paper-200 text-ink-800 border-ink-500"
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
          <div className="w-[420px] bg-paper-100 p-8 shrink-0 flex flex-col gap-5 border-r border-paper-400">
            <h3 className="text-3xl font-bold text-ink-900 font-heading">
              البيت رقم {toArabicDigits(selectedVerse.orderIndex)}
            </h3>
            <div className="p-5 bg-amber-50 border border-amber-800 text-amber-800 text-[15px] font-bold font-ui leading-[2] flex items-start gap-4 shadow-sm rounded-none">
              <AlertTriangle className="w-6 h-6 mt-1 shrink-0 text-amber-800" />
              <span>
                لا توجد محاذاة زمنية لهذا البيت — استخدم مشغّل القصيدة لإضافة الحدود يدوياً.
              </span>
            </div>
          </div>
        )}

        {/* Right: Fine Nudge & Inspection Controls */}
        {selectedVerse && selectedBoundary && (
          <div className="w-[420px] bg-paper-100 p-8 overflow-y-auto space-y-8 shrink-0 flex flex-col justify-between shadow-md relative z-10 border-r border-paper-400">
            <div className="space-y-8">
              <div>
                <h3 className="text-3xl font-bold text-ink-900 flex items-center gap-4 font-heading">
                  <span>البيت رقم {toArabicDigits(selectedVerse.orderIndex)}</span>
                  <span className="text-[14px] font-ui font-bold bg-green-50 text-green-800 border border-green-800 px-3 py-0.5 rounded-none shadow-sm">
                    {Math.round((selectedBoundary.confidence || 0.85) * 100)}% دقة
                  </span>
                </h3>
                <p className="font-poetry text-[22px] font-bold text-ink-900 mt-5 p-6 bg-paper-200 border border-paper-400 leading-[2.2] shadow-sm rounded-none">
                  {selectedVerse.text}
                </p>
              </div>

              {/* Loop Audition Button */}
              <button
                onClick={toggleLoopPlay}
                className={`w-full py-3.5 font-bold font-ui text-[14px] flex items-center justify-center gap-2 transition-colors border shadow-sm rounded-none ${
                  isPlayingLoop
                    ? "bg-accent-700 text-paper-100 border-accent-700"
                    : "bg-paper-200 text-ink-800 border-paper-400 hover:bg-paper-300"
                }`}
              >
                {isPlayingLoop ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                <span>{isPlayingLoop ? "إيقاف التكرار التجريبي" : "استماع تكراري لحدود البيت (Loop)"}</span>
              </button>

              {/* Start Timestamp Adjuster */}
              <div className="bg-paper-200 p-5 border border-paper-400 space-y-4 shadow-sm rounded-none font-ui">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-800 font-bold">طابع البداية:</span>
                  <span className="font-mono ltr-num text-ink-900 font-bold bg-paper-100 px-3 py-1 border border-paper-400 rounded-none shadow-sm">
                    {formatTime(selectedBoundary.startMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleNudgeStart(-200)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    -200
                  </button>
                  <button
                    onClick={() => handleNudgeStart(-50)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    -50
                  </button>
                  <button
                    onClick={() => handleNudgeStart(50)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    +50
                  </button>
                  <button
                    onClick={() => handleNudgeStart(200)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    +200
                  </button>
                </div>
              </div>

              {/* End Timestamp Adjuster */}
              <div className="bg-paper-200 p-5 border border-paper-400 space-y-4 shadow-sm rounded-none font-ui">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-800 font-bold">طابع النهاية:</span>
                  <span className="font-mono ltr-num text-ink-900 font-bold bg-paper-100 px-3 py-1 border border-paper-400 rounded-none shadow-sm">
                    {formatTime(selectedBoundary.endMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleNudgeEnd(-200)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    -200
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(-50)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    -50
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(50)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    +50
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(200)}
                    className="py-2.5 bg-paper-100 hover:bg-paper-300 text-[13px] font-mono font-bold text-ink-700 hover:text-ink-900 border border-paper-400 transition-colors shadow-sm rounded-none"
                  >
                    +200
                  </button>
                </div>
              </div>

              {/* Split action */}
              <div className="flex gap-2">
                <button
                  onClick={handleSplitVerse}
                  className="flex-1 py-3.5 bg-transparent hover:bg-paper-300 border border-paper-500 text-[14px] font-bold font-ui text-ink-800 flex items-center justify-center gap-3 transition-colors shadow-sm rounded-none"
                >
                  <Split className="w-5 h-5 text-ink-700" />
                  <span>توسيط نقطة النهاية (شطرين متكافئين)</span>
                </button>
              </div>
            </div>

            {/* Status Validation Actions */}
            <div className="pt-6 border-t border-paper-400 space-y-4 font-ui">
              <span className="text-[14px] font-bold text-ink-800 block">حالة التدقيق:</span>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleStatusToggle("auto")}
                  className={`py-3 text-[14px] font-bold border transition-colors shadow-sm rounded-none ${
                    selectedBoundary.status === "auto"
                      ? "bg-paper-300 text-ink-900 border-paper-500"
                      : "bg-paper-200 text-ink-700 border-paper-400 hover:bg-paper-300"
                  }`}
                >
                  آلي
                </button>
                <button
                  onClick={() => handleStatusToggle("reviewed")}
                  className={`py-3 text-[14px] font-bold border transition-colors shadow-sm rounded-none ${
                    selectedBoundary.status === "reviewed"
                      ? "bg-green-50 text-green-800 border-green-800"
                      : "bg-paper-200 text-ink-700 border-paper-400 hover:bg-paper-300"
                  }`}
                >
                  مدقق
                </button>
                <button
                  onClick={() => handleStatusToggle("manual")}
                  className={`py-3 text-[14px] font-bold border transition-colors shadow-sm rounded-none ${
                    selectedBoundary.status === "manual"
                      ? "bg-amber-50 text-amber-800 border-amber-800"
                      : "bg-paper-200 text-ink-700 border-paper-400 hover:bg-paper-300"
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
