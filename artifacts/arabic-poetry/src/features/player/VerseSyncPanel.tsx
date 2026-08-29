import React, { useEffect, useState } from "react";
import { Pause, Play, Save, TimerReset } from "lucide-react";
import { AlignmentStatus, Verse } from "@/types";
import { formatTime } from "@/lib/utils";

interface VerseSyncPanelProps {
  verse: Verse;
  verses: Verse[];
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onSeek: (timeMs: number) => void;
  onTogglePlay: () => void;
  onSave: (
    alignmentId: string,
    startMs: number,
    endMs: number,
    status: "reviewed" | "manual"
  ) => Promise<void> | void;
  onApplyOffset?: (offsetMs: number, includeFollowing: boolean) => Promise<void> | void;
  onCreate?: (verseId: string, startMs: number, endMs: number) => Promise<void> | void;
}

function initialBoundary(verse: Verse): { startMs: number; endMs: number } {
  return {
    startMs: verse.alignment?.startMs ?? 0,
    endMs: verse.alignment?.endMs ?? 0,
  };
}

export const VerseSyncPanel: React.FC<VerseSyncPanelProps> = ({
  verse,
  verses,
  currentTimeMs,
  durationMs,
  isPlaying,
  onSeek,
  onTogglePlay,
  onSave,
  onApplyOffset,
  onCreate,
}) => {
  const [startMs, setStartMs] = useState(() => initialBoundary(verse).startMs);
  const [endMs, setEndMs] = useState(() => initialBoundary(verse).endMs);
  const [isLooping, setIsLooping] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [includeFollowing, setIncludeFollowing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const next = initialBoundary(verse);
    setStartMs(next.startMs);
    setEndMs(next.endMs);
    setMessage(null);
    setIsLooping(false);
  }, [verse.id, verse.alignment?.startMs, verse.alignment?.endMs]);

  useEffect(() => {
    if (!isLooping || !isPlaying || endMs <= startMs) return;
    if (currentTimeMs >= endMs) {
      onSeek(startMs);
    }
  }, [currentTimeMs, endMs, isLooping, isPlaying, onSeek, startMs]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((current) => (current === text ? null : current)), 3500);
  };

  const validateBoundary = () => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return "أدخل أرقامًا صحيحة لبداية ونهاية البيت.";
    }
    if (startMs < 0 || endMs <= startMs + 300) {
      return "يجب أن تكون مدة البيت أكثر من 300 مللي ثانية.";
    }
    if (durationMs > 0 && endMs > durationMs) {
      return `نهاية البيت تتجاوز مدة التسجيل (${formatTime(durationMs)}).`;
    }

    const index = verses.findIndex((item) => item.id === verse.id);
    const previous = index > 0 ? verses[index - 1]?.alignment : undefined;
    const next = index >= 0 ? verses[index + 1]?.alignment : undefined;
    if (previous && startMs < previous.endMs) {
      return "بداية البيت تتداخل مع نهاية البيت السابق.";
    }
    if (next && endMs > next.startMs) {
      return "نهاية البيت تتداخل مع بداية البيت التالي.";
    }
    return null;
  };

  const saveBoundary = async () => {
    if (!verse.alignment && !onCreate) {
      showMessage("لا توجد محاذاة محفوظة لهذا البيت بعد.");
      return;
    }
    const error = validateBoundary();
    if (error) {
      showMessage(error);
      return;
    }
    setIsSaving(true);
    try {
      if (verse.alignment) {
        await onSave(verse.alignment.id, startMs, endMs, "manual");
      } else if (onCreate) {
        await onCreate(verse.id, startMs, endMs);
      }
      showMessage("تم حفظ التعديلات بنجاح.");
    } catch (err: unknown) {
      const errorObj = err as Error;
      showMessage(errorObj.message || "تعذر حفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  const nudge = (type: "start" | "end", delta: number) => {
    if (type === "start") {
      setStartMs((current) => Math.max(0, current + delta));
    } else {
      setEndMs((current) => Math.max(0, current + delta));
    }
  };

  const captureStart = () => {
    setStartMs(currentTimeMs);
  };

  const captureEnd = () => {
    setEndMs(currentTimeMs);
  };

  const applyOffset = async () => {
    if (!onApplyOffset || offsetMs === 0) return;
    try {
      await onApplyOffset(offsetMs, includeFollowing);
      showMessage(`تم تطبيق انزياح قدره ${offsetMs}ms بنجاح.`);
      setOffsetMs(0);
    } catch (err: unknown) {
      const errorObj = err as Error;
      showMessage(errorObj.message || "تعذر تطبيق الانزياح.");
    }
  };

  return (
    <section className="bg-[#14171E] border border-white/[0.08] rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-semibold text-[#D4AF37] tracking-widest uppercase block mb-1">
            تدقيق الحدود والمزامنة
          </span>
          <h3 className="font-poetry text-2xl font-bold text-[#F8F9FA]">
            البيت رقم {verse.orderIndex}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsLooping(!isLooping);
            if (!isPlaying) onTogglePlay();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
            isLooping
              ? "bg-[#D4AF37] text-[#0A0C10] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
              : "bg-white/[0.06] text-[#CED4DA] hover:bg-white/[0.1] border border-white/10"
          }`}
        >
          {isLooping ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isLooping ? "إيقاف التكرار" : "تكرار استماع البيت"}</span>
        </button>
      </div>

      {!verse.alignment && (
        <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 px-4 py-3 text-xs text-amber-200 leading-relaxed font-sans shadow-inner">
          هذا البيت غير محاذى بعد — استخدم زري الالتقاط لتحديد البداية والنهاية من موضع الصوت الحالي ثم احفظ.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs font-sans tracking-wide">
        <label className="space-y-2 block bg-black/40 p-4 rounded-2xl border border-white/[0.08]">
          <span className="text-[#A0AAB7] block text-center font-medium">البداية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(startMs)}
            onChange={(event) => setStartMs(Number(event.target.value))}
            className="w-full rounded-xl border border-white/10 bg-[#0A0C10] px-3 py-2 text-[#F3E19C] font-mono font-medium text-center focus:outline-none focus:border-[#D4AF37]/50 ltr-num"
          />
          <button type="button" onClick={captureStart} className="w-full mt-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] py-2 text-[11px] text-[#CED4DA] font-semibold transition-colors border border-white/10">
            التقاط من الصوت الآن
          </button>
        </label>

        <label className="space-y-2 block bg-black/40 p-4 rounded-2xl border border-white/[0.08]">
          <span className="text-[#A0AAB7] block text-center font-medium">النهاية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(endMs)}
            onChange={(event) => setEndMs(Number(event.target.value))}
            className="w-full rounded-xl border border-white/10 bg-[#0A0C10] px-3 py-2 text-[#F3E19C] font-mono font-medium text-center focus:outline-none focus:border-[#D4AF37]/50 ltr-num"
          />
          <button type="button" onClick={captureEnd} className="w-full mt-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] py-2 text-[11px] text-[#CED4DA] font-semibold transition-colors border border-white/10">
            التقاط من الصوت الآن
          </button>
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-[#A0AAB7] font-mono font-medium bg-black/30 px-4 py-2.5 rounded-xl border border-white/[0.06] ltr-num">
        <span className="text-[#F3E19C]">{formatTime(startMs, true)} → {formatTime(endMs, true)}</span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
          الموضع: {formatTime(currentTimeMs, true)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="grid grid-cols-4 gap-1.5">
          {([-200, -50, 50, 200] as const).map((amount) => (
            <button key={`s${amount}`} type="button" onClick={() => nudge("start", amount)} className="rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[11px] font-mono text-[#CED4DA] hover:text-[#F3E19C] hover:bg-white/[0.08] transition-colors">
              {amount > 0 ? "+" : ""}{amount}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([-200, -50, 50, 200] as const).map((amount) => (
            <button key={`e${amount}`} type="button" onClick={() => nudge("end", amount)} className="rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[11px] font-mono text-[#CED4DA] hover:text-[#F3E19C] hover:bg-white/[0.08] transition-colors">
              {amount > 0 ? "+" : ""}{amount}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSeek(startMs)}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] py-3 text-xs font-semibold text-[#F8F9FA] flex items-center justify-center gap-2 hover:bg-white/[0.1] transition-colors shadow-sm"
        >
          <TimerReset className="w-4 h-4 text-[#D4AF37]" /> الانتقال للبداية
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={saveBoundary}
          className="flex-[2] rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] py-3 text-xs font-bold text-[#0A0C10] disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          <Save className="w-4 h-4 stroke-[2.5]" /> {isSaving ? "جاري الحفظ..." : "حفظ التصحيح اليدوي"}
        </button>
      </div>

      {onApplyOffset && (
        <div className="border-t border-white/[0.08] pt-5 space-y-3">
          <span className="text-xs font-semibold text-[#F8F9FA] font-sans tracking-wide">تصحيح انزياح ثابت (Offset)</span>
          <div className="flex gap-2">
            <input
              type="number"
              value={offsetMs}
              onChange={(event) => setOffsetMs(Number(event.target.value))}
              placeholder="مثال: 350"
              className="w-32 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-[#F3E19C] font-mono font-medium focus:outline-none focus:border-[#D4AF37]/50 ltr-num"
            />
            <button type="button" onClick={applyOffset} className="rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-4 text-xs font-semibold text-[#F8F9FA] border border-white/10 transition-colors">
              تطبيق الانزياح
            </button>
            <label className="flex items-center gap-2 text-xs text-[#A0AAB7] mr-4 font-sans cursor-pointer select-none">
              <input type="checkbox" checked={includeFollowing} onChange={(event) => setIncludeFollowing(event.target.checked)} className="w-4 h-4 rounded border-white/20 text-[#D4AF37] focus:ring-[#D4AF37]/30 bg-black" />
              <span>تطبيق على الأبيات التالية</span>
            </label>
          </div>
        </div>
      )}

      {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-xs text-emerald-200 font-medium font-sans shadow-inner animate-in fade-in zoom-in-95">{message}</p>}
    </section>
  );
};
