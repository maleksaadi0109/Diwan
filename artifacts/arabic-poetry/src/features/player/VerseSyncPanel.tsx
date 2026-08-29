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
    <section className="bg-paper-100 border-2 border-accent-700 rounded-none p-6 md:p-8 space-y-6 shadow-sm relative overflow-hidden font-ui">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-400 pb-5">
        <div>
          <span className="text-[13px] font-bold text-accent-700 block mb-1">
            تدقيق الحدود والمزامنة
          </span>
          <h3 className="font-heading text-2xl font-bold text-ink-900">
            البيت رقم {verse.orderIndex}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsLooping(!isLooping);
            if (!isPlaying) onTogglePlay();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-none text-[14px] font-bold transition-colors border ${
            isLooping
              ? "bg-accent-700 text-paper-100 border-accent-700"
              : "bg-paper-200 text-ink-700 border-ink-500 hover:bg-paper-300 hover:text-ink-900"
          }`}
        >
          {isLooping ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isLooping ? "إيقاف التكرار" : "تكرار استماع البيت"}</span>
        </button>
      </div>

      {!verse.alignment && (
        <div className="bg-amber-50 border border-amber-800 px-5 py-4 text-[14px] text-amber-800 font-bold shadow-sm rounded-none">
          هذا البيت غير محاذى بعد — استخدم زري الالتقاط لتحديد البداية والنهاية من موضع الصوت الحالي ثم احفظ.
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 text-[14px] font-bold">
        <label className="space-y-3 block bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm">
          <span className="text-ink-700 block text-center">البداية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(startMs)}
            onChange={(event) => setStartMs(Number(event.target.value))}
            className="w-full bg-paper-100 text-ink-900 border border-paper-500 rounded-none px-4 py-2 font-mono text-center focus:outline-none focus:border-accent-700 focus:ring-1 focus:ring-accent-700 ltr-num"
          />
          <button type="button" onClick={captureStart} className="w-full mt-3 bg-transparent border border-paper-500 hover:bg-paper-300 py-2.5 text-[13px] text-ink-700 font-bold transition-colors rounded-none">
            التقاط من الصوت الآن
          </button>
        </label>

        <label className="space-y-3 block bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm">
          <span className="text-ink-700 block text-center">النهاية (ms)</span>
          <input
            type="number"
            min={0}
            value={Math.round(endMs)}
            onChange={(event) => setEndMs(Number(event.target.value))}
            className="w-full bg-paper-100 text-ink-900 border border-paper-500 rounded-none px-4 py-2 font-mono text-center focus:outline-none focus:border-accent-700 focus:ring-1 focus:ring-accent-700 ltr-num"
          />
          <button type="button" onClick={captureEnd} className="w-full mt-3 bg-transparent border border-paper-500 hover:bg-paper-300 py-2.5 text-[13px] text-ink-700 font-bold transition-colors rounded-none">
            التقاط من الصوت الآن
          </button>
        </label>
      </div>

      <div className="flex items-center justify-between text-[14px] text-ink-900 font-mono font-bold bg-paper-200 px-5 py-3 rounded-none border border-paper-400 ltr-num shadow-sm">
        <span>{formatTime(startMs, true)} → {formatTime(endMs, true)}</span>
        <span className="flex items-center gap-2 text-ink-700 font-ui font-bold">
          <span className="w-2.5 h-2.5 rounded-none bg-accent-700 border border-ink-900 animate-pulse" />
          الموضع: {formatTime(currentTimeMs, true)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
         <div className="grid grid-cols-4 gap-2">
          {([-200, -50, 50, 200] as const).map((amount) => (
            <button key={`s${amount}`} type="button" onClick={() => nudge("start", amount)} className="border border-paper-400 bg-paper-200 py-2 text-[12px] font-mono text-ink-700 font-bold hover:text-ink-900 hover:bg-paper-300 transition-colors rounded-none shadow-sm">
              {amount > 0 ? "+" : ""}{amount}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {([-200, -50, 50, 200] as const).map((amount) => (
            <button key={`e${amount}`} type="button" onClick={() => nudge("end", amount)} className="border border-paper-400 bg-paper-200 py-2 text-[12px] font-mono text-ink-700 font-bold hover:text-ink-900 hover:bg-paper-300 transition-colors rounded-none shadow-sm">
              {amount > 0 ? "+" : ""}{amount}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          type="button"
          onClick={() => onSeek(startMs)}
          className="flex-1 border-2 border-ink-700 bg-transparent py-3.5 text-[14px] font-bold text-ink-800 flex items-center justify-center gap-2 hover:bg-ink-100 transition-colors rounded-none shadow-sm"
        >
          <TimerReset className="w-5 h-5 text-ink-700" /> الانتقال للبداية
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={saveBoundary}
          className="flex-[2] bg-accent-700 hover:bg-accent-600 border-2 border-accent-700 py-3.5 text-[15px] font-bold text-paper-100 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm rounded-none"
        >
          <Save className="w-5 h-5" /> {isSaving ? "جاري الحفظ..." : "حفظ التصحيح اليدوي"}
        </button>
      </div>

      {onApplyOffset && (
        <div className="border-t border-paper-400 pt-6 mt-4 space-y-4">
          <span className="text-[14px] font-bold text-ink-900 block">تصحيح انزياح ثابت (Offset)</span>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={offsetMs}
              onChange={(event) => setOffsetMs(Number(event.target.value))}
              placeholder="مثال: 350"
              className="w-32 bg-paper-200 border border-paper-400 px-4 py-2.5 text-[14px] text-ink-900 font-mono font-bold focus:outline-none focus:border-accent-700 focus:ring-1 focus:ring-accent-700 ltr-num rounded-none"
            />
            <button type="button" onClick={applyOffset} className="bg-ink-800 hover:bg-ink-900 px-6 py-2.5 text-[14px] font-bold text-paper-100 border border-ink-900 transition-colors rounded-none shadow-sm">
              تطبيق الانزياح
            </button>
            <label className="flex items-center gap-3 text-[14px] text-ink-700 mr-4 font-bold cursor-pointer select-none">
              <input type="checkbox" checked={includeFollowing} onChange={(event) => setIncludeFollowing(event.target.checked)} className="w-4 h-4 border-ink-400 text-accent-700 focus:ring-accent-700 rounded-none bg-paper-100" />
              <span>تطبيق على الأبيات التالية</span>
            </label>
          </div>
        </div>
      )}

      {message && <p className="bg-green-50 border border-green-800 px-5 py-4 text-[14px] text-green-800 font-bold shadow-sm rounded-none animate-in fade-in zoom-in-95">{message}</p>}
    </section>
  );
};
