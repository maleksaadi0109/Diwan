import React, { useState, useEffect } from "react";
import { Poem, AlignmentStatus } from "@/types";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { usePoemPlayback } from "@/hooks/usePoemPlayback";
import {
  Play,
  Pause,
  AlertTriangle,
  Split,
  Settings2,
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
    <div className="h-full flex flex-col justify-between overflow-hidden bg-[#0A0C10] select-none text-[#F8F9FA]">
      {/* Editor Header */}
      <div className="px-8 py-4 border-b border-white/[0.08] bg-[#0E1015]/90 backdrop-blur-2xl flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-poetry text-2xl md:text-3xl font-bold text-[#F8F9FA] tracking-wide">
              محرر المحاذاة وتدقيق الحدود
            </h2>
            <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#D4AF37]/15 text-[#F3E19C] border border-[#D4AF37]/30 flex items-center gap-1.5 shadow-sm">
              <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" /> محرر دقيق
            </span>
          </div>
          <p className="text-xs text-[#A0AAB7] mt-1 font-sans tracking-wide">
            {poem.title} — {poem.poet.name} ({poem.verses.length} بيت)
          </p>
        </div>

        {statusMessage && (
          <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 shadow-sm font-medium animate-in fade-in zoom-in">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Canvas / Scrubber Visualizer */}
      <div className="p-6 border-b border-white/[0.08] bg-[#12151C]/80">
        <div className="bg-[#14171E] p-4 rounded-2xl border border-white/[0.08] shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A0AAB7] font-medium">
            <span>المخطط الزمني للقصيدة والتسجيل</span>
            <span className="font-mono ltr-num text-[#F3E19C] font-bold bg-[#D4AF37]/15 px-3 py-1 rounded-lg border border-[#D4AF37]/30">
              {formatTime(currentTimeMs, true)}
            </span>
          </div>

          {/* Simulated Waveform Track */}
          <div className="relative h-20 bg-black/40 rounded-xl overflow-hidden border border-white/[0.08] flex items-center px-3 shadow-inner">
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
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      isInsideSelected
                        ? "bg-gradient-to-t from-[#B89225] via-[#D4AF37] to-[#F3E19C] shadow-[0_0_10px_rgba(212,175,55,0.6)] z-10 scale-y-110"
                        : "bg-white/[0.1] hover:bg-white/[0.2]"
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
        <div className="flex-1 overflow-y-auto p-6 space-y-3 border-l border-white/[0.08] bg-[#0E1015]/40 scroll-smooth">
          {poem.verses.map((verse) => {
            const b = boundaries.get(verse.id);
            const isSelected = verse.id === selectedVerseId;
            const status = b?.status || "auto";

            return (
              <div
                key={verse.id}
                onClick={() => setSelectedVerseId(verse.id)}
                className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 font-sans tracking-wide ${
                  isSelected
                    ? "bg-[#181B24] border-[#D4AF37]/50 shadow-[0_8px_24px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]/30"
                    : "bg-[#12151C]/70 border-white/[0.06] hover:border-white/[0.15] hover:bg-[#161922]"
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-colors font-mono ${
                    isSelected ? "bg-[#D4AF37] text-[#0A0C10] shadow-[0_0_10px_rgba(212,175,55,0.4)]" : "bg-white/[0.06] text-[#CED4DA] border border-white/10"
                  }`}>
                    {toArabicDigits(verse.orderIndex)}
                  </span>
                  <div className={`font-poetry text-xl truncate transition-colors ${
                    isSelected ? "text-[#FFF8E7] font-bold" : "text-[#E9ECEF]"
                  }`}>
                    <span>{verse.firstHemistich}</span>
                    <span className="text-[#D4AF37]/60 mx-3 font-sans text-xs">✦</span>
                    <span>{verse.secondHemistich}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {b ? (
                    <div className="text-right font-mono text-[13px] font-medium ltr-num text-[#F3E19C] bg-black/40 px-3 py-1 rounded-lg border border-white/[0.08]">
                      <span>{formatTime(b.startMs, true)}</span>
                      <span className="text-white/20 mx-2">→</span>
                      <span>{formatTime(b.endMs, true)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#6C7A8C] px-4">—</span>
                  )}

                  <span
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold border w-24 text-center ${
                      !b
                        ? "bg-white/[0.04] text-[#6C7A8C] border-white/[0.08]"
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
          <div className="w-[420px] bg-[#0E1015]/95 p-8 shrink-0 flex flex-col gap-4 border-r border-white/[0.08]">
            <h3 className="text-xl font-bold text-[#F8F9FA] font-poetry">
              البيت رقم {toArabicDigits(selectedVerse.orderIndex)}
            </h3>
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm leading-relaxed flex items-start gap-3 shadow-inner">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
              <span>
                لا توجد محاذاة زمنية لهذا البيت — استخدم مشغّل القصيدة لإضافة الحدود يدوياً.
              </span>
            </div>
          </div>
        )}

        {/* Right: Fine Nudge & Inspection Controls */}
        {selectedVerse && selectedBoundary && (
          <div className="w-[420px] bg-[#0E1015]/95 p-8 overflow-y-auto space-y-6 shrink-0 flex flex-col justify-between border-r border-white/[0.08] shadow-2xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-[#F8F9FA] flex items-center gap-3 font-poetry">
                  <span>البيت رقم {toArabicDigits(selectedVerse.orderIndex)}</span>
                  <span className="text-[11px] font-sans font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    {Math.round((selectedBoundary.confidence || 0.85) * 100)}% دقة
                  </span>
                </h3>
                <p className="font-poetry text-[17px] text-[#F8F9FA] mt-4 p-5 bg-black/40 rounded-2xl border border-white/[0.08] leading-relaxed shadow-inner">
                  {selectedVerse.text}
                </p>
              </div>

              {/* Loop Audition Button */}
              <button
                onClick={toggleLoopPlay}
                className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all border shadow-sm ${
                  isPlayingLoop
                    ? "bg-[#D4AF37] text-[#0A0C10] border-[#F3E19C]/40 shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                    : "bg-white/[0.06] text-[#F8F9FA] border-white/10 hover:bg-white/[0.1]"
                }`}
              >
                {isPlayingLoop ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isPlayingLoop ? "إيقاف التكرار التجريبي" : "استماع تكراري لحدود البيت (Loop)"}</span>
              </button>

              {/* Start Timestamp Adjuster */}
              <div className="bg-black/30 p-5 rounded-2xl border border-white/[0.08] space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#A0AAB7] font-bold font-sans">طابع البداية:</span>
                  <span className="font-mono ltr-num text-[#F3E19C] font-bold bg-black/50 px-3 py-1 rounded-lg border border-white/10">
                    {formatTime(selectedBoundary.startMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleNudgeStart(-200)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    -200
                  </button>
                  <button
                    onClick={() => handleNudgeStart(-50)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    -50
                  </button>
                  <button
                    onClick={() => handleNudgeStart(50)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    +50
                  </button>
                  <button
                    onClick={() => handleNudgeStart(200)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    +200
                  </button>
                </div>
              </div>

              {/* End Timestamp Adjuster */}
              <div className="bg-black/30 p-5 rounded-2xl border border-white/[0.08] space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#A0AAB7] font-bold font-sans">طابع النهاية:</span>
                  <span className="font-mono ltr-num text-[#F3E19C] font-bold bg-black/50 px-3 py-1 rounded-lg border border-white/10">
                    {formatTime(selectedBoundary.endMs, true)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleNudgeEnd(-200)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    -200
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(-50)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    -50
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(50)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    +50
                  </button>
                  <button
                    onClick={() => handleNudgeEnd(200)}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono rounded-xl text-[#CED4DA] border border-white/10 transition-colors font-medium shadow-sm"
                  >
                    +200
                  </button>
                </div>
              </div>

              {/* Split action */}
              <div className="flex gap-2">
                <button
                  onClick={handleSplitVerse}
                  className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-2xl text-xs font-bold text-[#F8F9FA] flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Split className="w-4 h-4 text-[#D4AF37]" />
                  <span>توسيط نقطة النهاية (شطرين متكافئين)</span>
                </button>
              </div>
            </div>

            {/* Status Validation Actions */}
            <div className="pt-6 border-t border-white/[0.08] space-y-3">
              <span className="text-xs font-bold text-[#A0AAB7] font-sans tracking-wide block">حالة التدقيق:</span>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleStatusToggle("auto")}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors shadow-sm ${
                    selectedBoundary.status === "auto"
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      : "bg-white/[0.05] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08]"
                  }`}
                >
                  آلي
                </button>
                <button
                  onClick={() => handleStatusToggle("reviewed")}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors shadow-sm ${
                    selectedBoundary.status === "reviewed"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-white/[0.05] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08]"
                  }`}
                >
                  مدقق
                </button>
                <button
                  onClick={() => handleStatusToggle("manual")}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors shadow-sm ${
                    selectedBoundary.status === "manual"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-white/[0.05] text-[#A0AAB7] border-white/10 hover:bg-white/[0.08]"
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
