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
  // No fabricated timing: an unaligned verse starts from empty (0/0) values
  // that the user must fill in manually, with an explicit notice shown.
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
        await onSave(verse.alignment.id, Math.round(startMs), Math.round(endMs), "manual");
      } else {
        await onCreate!(verse.id, Math.round(startMs), Math.round(endMs));
      }
      showMessage("تم حفظ تصحيح توقيت البيت.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "تعذر حفظ التصحيح.");
    } finally {
      setIsSaving(false);
    }
  };

  const captureStart = () => setStartMs(Math.max(0, Math.min(currentTimeMs, endMs - 301)));
  const captureEnd = () => setEndMs(Math.max(startMs + 301, currentTimeMs));
  const nudge = (field: "start" | "end", amount: number) => {
    if (field === "start") setStartMs((value) => Math.max(0, value + amount));
    else setEndMs((value) => value + amount);
  };

  const toggleLoop = () => {
    if (isLooping) {
      setIsLooping(false);
      if (isPlaying) onTogglePlay();
      return;
    }
    const error = validateBoundary();
    if (error) {
      showMessage(error);
      return;
    }
    setIsLooping(true);
    onSeek(startMs);
    if (!isPlaying) onTogglePlay();
  };

  const applyOffset = async () => {
    if (!onApplyOffset || !Number.isFinite(offsetMs) || offsetMs === 0) {
      showMessage("أدخل مقدار تصحيح مختلفًا عن الصفر.");
      return;
    }
    try {
      await onApplyOffset(Math.round(offsetMs), includeFollowing);
      showMessage(includeFollowing ? "تم تطبيق التصحيح على هذا البيت وما يليه." : "تم تطبيق التصحيح على هذا البيت.");
      setOffsetMs(0);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "تعذر تطبيق التصحيح.");
    }
  };

  return (
    <section className="rounded-2xl border border-gold-500/30 bg-charcoal-900/80 p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gold-300">تصحيح مزامنة البيت</h3>
          <p className="text-[11px] text-parchment-400 mt-1">
            اسمع المقطع ثم التقط بداية البيت ونهايته من موضع الصوت الحالي.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleLoop}
          className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 ${
            isLooping
              ? "bg-amber-500 text-charcoal-950 border-amber-400"
              : "bg-gold-500/15 text-gold-300 border-gold-500/30"
          }`}
        >
          {isLooping ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isLooping ? "إيقاف التكرار" : "تكرار البيت"}
        </button>
      </div>

      {!verse.alignment && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-[11px] text-rose-300 leading-relaxed">
          هذا البيت غير محاذى بعد — لا تُعرض حدود زمنية مصطنعة. استخدم زري الالتقاط لتحديد
          البداية والنهاية من موضع الصوت الحالي ثم احفظ.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="text-parchment-400">البداية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(startMs)}
            onChange={(event) => setStartMs(Number(event.target.value))}
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-950 px-2 py-2 text-gold-300 font-mono ltr-num"
          />
          <button type="button" onClick={captureStart} className="w-full rounded-lg bg-charcoal-850 py-1.5 text-[10px] text-parchment-300 hover:text-gold-300">
            التقاط من الصوت الآن
          </button>
        </label>
        <label className="space-y-1">
          <span className="text-parchment-400">النهاية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(endMs)}
            onChange={(event) => setEndMs(Number(event.target.value))}
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-950 px-2 py-2 text-gold-300 font-mono ltr-num"
          />
          <button type="button" onClick={captureEnd} className="w-full rounded-lg bg-charcoal-850 py-1.5 text-[10px] text-parchment-300 hover:text-gold-300">
            التقاط من الصوت الآن
          </button>
        </label>
      </div>

      <div className="flex items-center justify-between text-[11px] text-parchment-400 font-mono ltr-num">
        <span>{formatTime(startMs, true)} → {formatTime(endMs, true)}</span>
        <span>الموضع الحالي: {formatTime(currentTimeMs, true)}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {([-200, -50, 50, 200] as const).map((amount) => (
          <button key={`s${amount}`} type="button" onClick={() => nudge("start", amount)} className="rounded-lg border border-charcoal-700 bg-charcoal-850 py-1.5 text-[10px] text-parchment-300 hover:text-gold-300">
            {amount > 0 ? "+" : ""}{amount} بداية
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {([-200, -50, 50, 200] as const).map((amount) => (
          <button key={`e${amount}`} type="button" onClick={() => nudge("end", amount)} className="rounded-lg border border-charcoal-700 bg-charcoal-850 py-1.5 text-[10px] text-parchment-300 hover:text-gold-300">
            {amount > 0 ? "+" : ""}{amount} نهاية
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSeek(startMs)}
        className="w-full rounded-xl border border-charcoal-700 bg-charcoal-850 py-2 text-xs text-parchment-200 flex items-center justify-center gap-2"
      >
        <TimerReset className="w-3.5 h-3.5" /> الانتقال إلى بداية البيت
      </button>

      <button
        type="button"
        disabled={isSaving}
        onClick={saveBoundary}
        className="w-full rounded-xl bg-gold-500 py-2.5 text-xs font-bold text-charcoal-950 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Save className="w-3.5 h-3.5" /> {isSaving ? "جاري الحفظ..." : "حفظ التصحيح اليدوي"}
      </button>

      {onApplyOffset && (
        <div className="border-t border-charcoal-800 pt-3 space-y-2">
          <span className="text-[11px] font-semibold text-parchment-300">تصحيح انزياح ثابت</span>
          <div className="flex gap-2">
            <input
              type="number"
              value={offsetMs}
              onChange={(event) => setOffsetMs(Number(event.target.value))}
              placeholder="مثال: 350"
              className="min-w-0 flex-1 rounded-lg border border-charcoal-700 bg-charcoal-950 px-2 py-2 text-xs text-gold-300 font-mono ltr-num"
            />
            <button type="button" onClick={applyOffset} className="rounded-lg bg-charcoal-800 px-3 text-[11px] text-gold-300 border border-charcoal-700">
              تطبيق
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-parchment-400">
            <input type="checkbox" checked={includeFollowing} onChange={(event) => setIncludeFollowing(event.target.checked)} />
            تطبيق على الأبيات التالية
          </label>
        </div>
      )}

      {message && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">{message}</p>}
    </section>
  );
};