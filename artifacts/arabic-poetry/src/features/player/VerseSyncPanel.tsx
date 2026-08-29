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
    <section className="rounded-2xl border border-sand-300 bg-sand-100 p-5 space-y-5 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-ink-900 tracking-wide font-sans">تصحيح مزامنة البيت</h3>
          <p className="text-xs text-ink-500 mt-1 font-sans">
            اسمع المقطع ثم التقط بداية البيت ونهايته من موضع الصوت الحالي.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleLoop}
          className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-300 flex items-center gap-2 ${
            isLooping
              ? "bg-crimson-800 text-sand-50 border-crimson-900 shadow-md"
              : "bg-white text-ink-800 border-sand-300 hover:bg-sand-200"
          }`}
        >
          {isLooping ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isLooping ? "إيقاف التكرار" : "تكرار المقطع"}
        </button>
      </div>

      {!verse.alignment && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed font-sans shadow-inner">
          هذا البيت غير محاذى بعد — لا تُعرض حدود زمنية مصطنعة. استخدم زري الالتقاط لتحديد
          البداية والنهاية من موضع الصوت الحالي ثم احفظ.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs font-sans tracking-wide">
        <label className="space-y-1.5 block bg-white p-3 rounded-xl border border-sand-300">
          <span className="text-ink-600 block text-center font-medium mb-2">البداية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(startMs)}
            onChange={(event) => setStartMs(Number(event.target.value))}
            className="w-full rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-ink-900 font-mono font-medium text-center focus:outline-none focus:ring-2 focus:ring-crimson-800/20 ltr-num"
          />
          <button type="button" onClick={captureStart} className="w-full mt-2 rounded-lg bg-sand-200 hover:bg-sand-300 py-2 text-[11px] text-ink-700 font-semibold transition-colors">
            التقاط من الصوت الآن
          </button>
        </label>
        <label className="space-y-1.5 block bg-white p-3 rounded-xl border border-sand-300">
          <span className="text-ink-600 block text-center font-medium mb-2">النهاية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(endMs)}
            onChange={(event) => setEndMs(Number(event.target.value))}
            className="w-full rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-ink-900 font-mono font-medium text-center focus:outline-none focus:ring-2 focus:ring-crimson-800/20 ltr-num"
          />
          <button type="button" onClick={captureEnd} className="w-full mt-2 rounded-lg bg-sand-200 hover:bg-sand-300 py-2 text-[11px] text-ink-700 font-semibold transition-colors">
            التقاط من الصوت الآن
          </button>
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-600 font-mono font-medium bg-sand-200/50 px-3 py-2 rounded-lg border border-sand-300/50 ltr-num">
        <span>{formatTime(startMs, true)} → {formatTime(endMs, true)}</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-crimson-800 animate-pulse"></span>
          الموضع: {formatTime(currentTimeMs, true)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="grid grid-cols-4 gap-1.5">
          {([-200, -50, 50, 200] as const).map((amount) => (
            <button key={`s${amount}`} type="button" onClick={() => nudge("start", amount)} className="rounded-md border border-sand-300 bg-white py-1.5 text-[11px] font-mono text-ink-600 hover:text-crimson-800 hover:bg-sand-50 transition-colors">
              {amount > 0 ? "+" : ""}{amount}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([-200, -50, 50, 200] as const).map((amount) => (
            <button key={`e${amount}`} type="button" onClick={() => nudge("end", amount)} className="rounded-md border border-sand-300 bg-white py-1.5 text-[11px] font-mono text-ink-600 hover:text-crimson-800 hover:bg-sand-50 transition-colors">
              {amount > 0 ? "+" : ""}{amount}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSeek(startMs)}
          className="flex-1 rounded-xl border border-sand-300 bg-white py-2.5 text-xs font-semibold text-ink-800 flex items-center justify-center gap-2 hover:bg-sand-50 transition-colors shadow-sm"
        >
          <TimerReset className="w-4 h-4 text-ink-500" /> الانتقال للبداية
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={saveBoundary}
          className="flex-[2] rounded-xl bg-crimson-800 hover:bg-crimson-700 py-2.5 text-xs font-bold text-sand-50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <Save className="w-4 h-4" /> {isSaving ? "جاري الحفظ..." : "حفظ التصحيح اليدوي"}
        </button>
      </div>

      {onApplyOffset && (
        <div className="border-t border-sand-300 pt-5 space-y-3">
          <span className="text-xs font-semibold text-ink-800 font-sans tracking-wide">تصحيح انزياح ثابت (Offset)</span>
          <div className="flex gap-2">
            <input
              type="number"
              value={offsetMs}
              onChange={(event) => setOffsetMs(Number(event.target.value))}
              placeholder="مثال: 350"
              className="w-32 rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs text-ink-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-crimson-800/20 ltr-num"
            />
            <button type="button" onClick={applyOffset} className="rounded-lg bg-sand-200 hover:bg-sand-300 px-4 text-xs font-semibold text-ink-800 border border-sand-300 transition-colors">
              تطبيق الانزياح
            </button>
            <label className="flex items-center gap-2 text-xs text-ink-600 mr-4 font-sans cursor-pointer select-none">
              <input type="checkbox" checked={includeFollowing} onChange={(event) => setIncludeFollowing(event.target.checked)} className="w-4 h-4 rounded border-sand-400 text-crimson-800 focus:ring-crimson-800/30" />
              <span>تطبيق على الأبيات التالية</span>
            </label>
          </div>
        </div>
      )}

      {message && <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 font-medium font-sans shadow-inner animate-in fade-in zoom-in-95">{message}</p>}
    </section>
  );
};
