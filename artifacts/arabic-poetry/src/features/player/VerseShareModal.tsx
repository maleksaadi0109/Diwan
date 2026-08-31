import React, { useMemo, useRef, useState } from "react";
import { Poem } from "@/types";
import { X, Download, ChevronUp, ChevronDown, Loader2, Feather } from "lucide-react";
import { exportCardNodeToPng } from "@/lib/share/verseCardExport";
import { cn } from "@/lib/utils";

interface VerseShareModalProps {
  poem: Poem;
  initialVerseIndex: number;
  onClose: () => void;
}

const MAX_VERSES_IN_CARD = 6;

export const VerseShareModal: React.FC<VerseShareModalProps> = ({
  poem,
  initialVerseIndex,
  onClose,
}) => {
  const [rangeStart, setRangeStart] = useState(initialVerseIndex);
  const [rangeEnd, setRangeEnd] = useState(initialVerseIndex);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const verses = useMemo(
    () => poem.verses.slice(rangeStart, rangeEnd + 1),
    [poem.verses, rangeStart, rangeEnd]
  );

  const verseCount = rangeEnd - rangeStart + 1;
  const canExtendUp = rangeStart > 0 && verseCount < MAX_VERSES_IN_CARD;
  const canExtendDown = rangeEnd < poem.verses.length - 1 && verseCount < MAX_VERSES_IN_CARD;
  const canShrink = verseCount > 1;

  // Verse typography/spacing scale down as more verses are added so a
  // full 6-verse range still fits comfortably without being clipped by a
  // fixed card height. The card's height is intrinsic (not a fixed aspect
  // ratio), so it grows with content -- this scaling just keeps larger
  // selections visually balanced rather than absurdly tall.
  const density =
    verseCount <= 2
      ? { textClass: "text-lg md:text-2xl", leadingClass: "leading-[1.9]", gapClass: "gap-5 md:gap-6", rowGapClass: "gap-2" }
      : verseCount <= 4
      ? { textClass: "text-base md:text-xl", leadingClass: "leading-[1.7]", gapClass: "gap-3.5 md:gap-4", rowGapClass: "gap-1.5" }
      : { textClass: "text-sm md:text-base", leadingClass: "leading-[1.5]", gapClass: "gap-2.5 md:gap-3", rowGapClass: "gap-1" };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportError(null);
    const filename = `${poem.title}-${poem.poet.name}`;
    const result = await exportCardNodeToPng(cardRef.current, filename);
    setIsExporting(false);
    if (!result.success && result.error !== "cancelled") {
      setExportError("تعذّر إنشاء الصورة. يرجى المحاولة مرة أخرى.");
    } else if (result.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div className="bg-charcoal-900 border-2 border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-charcoal-850 shrink-0">
          <div className="flex items-center gap-2 text-parchment-100">
            <Feather className="w-5 h-5 text-accent-700" />
            <h3 className="text-lg font-bold font-heading">مشاركة كصورة</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-parchment-100 p-1.5 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Range controls */}
        <div className="px-6 pt-5 flex items-center justify-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRangeStart((i) => Math.max(0, i - 1))}
            disabled={!canExtendUp}
            title="إضافة البيت السابق"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-ink-500 hover:bg-white/10 hover:text-parchment-100 disabled:opacity-30 disabled:hover:bg-white/5 transition-all cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            بيت سابق
          </button>
          <span className="text-[11px] font-bold text-ink-500 font-sans px-2">
            {verseCount === 1 ? "بيت واحد" : `${verseCount} أبيات`}
          </span>
          <button
            type="button"
            onClick={() => setRangeEnd((i) => Math.min(poem.verses.length - 1, i + 1))}
            disabled={!canExtendDown}
            title="إضافة البيت التالي"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-ink-500 hover:bg-white/10 hover:text-parchment-100 disabled:opacity-30 disabled:hover:bg-white/5 transition-all cursor-pointer"
          >
            بيت تالٍ
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {canShrink && (
            <button
              type="button"
              onClick={() => {
                setRangeStart(initialVerseIndex);
                setRangeEnd(initialVerseIndex);
              }}
              title="إعادة الضبط إلى بيت واحد"
              className="text-[11px] font-bold text-ink-600 hover:text-parchment-100 underline underline-offset-2 cursor-pointer"
            >
              إعادة ضبط
            </button>
          )}
        </div>

        {/* Card preview (this exact node is rasterized to PNG) */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            ref={cardRef}
            className="relative w-full min-h-[420px] rounded-3xl overflow-hidden bg-gradient-to-br from-charcoal-950 via-charcoal-900 to-charcoal-950 border border-accent-700/30 flex flex-col items-center justify-center px-8 py-10 text-center shadow-2xl"
          >
            {/* Decorative corner ornaments */}
            <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2 border-accent-700/50 rounded-tl-xl" />
            <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2 border-accent-700/50 rounded-tr-xl" />
            <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2 border-accent-700/50 rounded-bl-xl" />
            <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2 border-accent-700/50 rounded-br-xl" />

            <h2 className="font-poetry text-xl md:text-2xl font-bold text-accent-700/90 mb-1">
              {poem.title}
            </h2>
            <span className="text-[11px] font-sans font-bold text-ink-500 mb-8 tracking-wide">
              {poem.poet.name}
            </span>

            <div className={cn("flex flex-col w-full", density.gapClass)}>
              {verses.map((verse) => (
                <div key={verse.id} className={cn("flex flex-col", density.rowGapClass)}>
                  <p
                    className={cn(
                      "font-poetry text-center text-parchment-100 font-bold text-shadow-gold",
                      density.textClass,
                      density.leadingClass
                    )}
                  >
                    {verse.firstHemistich}
                  </p>
                  <p
                    className={cn(
                      "font-poetry text-center text-parchment-100 font-bold text-shadow-gold",
                      density.textClass,
                      density.leadingClass
                    )}
                  >
                    {verse.secondHemistich}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-2 text-ink-600">
              <div className="w-8 h-px bg-ink-600/50" />
              <span className="text-[10px] font-sans font-bold tracking-[0.2em]">ديوان</span>
              <div className="w-8 h-px bg-ink-600/50" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-charcoal-850 flex items-center justify-between gap-3 shrink-0">
          {exportError ? (
            <span className="text-[12px] font-bold text-crimson-500 font-ui">{exportError}</span>
          ) : (
            <span className="text-[12px] font-bold text-ink-600 font-ui">صورة بجودة عالية جاهزة للمشاركة</span>
          )}
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 text-[14px] font-bold transition-colors rounded-2xl font-ui disabled:opacity-60 cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            تنزيل الصورة
          </button>
        </div>
      </div>
    </div>
  );
};
