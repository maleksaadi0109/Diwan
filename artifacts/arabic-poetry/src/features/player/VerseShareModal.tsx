import React, { useMemo, useRef, useState } from "react";
import { Poem } from "@/types";
import { X, Download, ChevronUp, ChevronDown, Loader2, Feather, Share2, MessageCircle, Send } from "lucide-react";
import { exportCardNodeToPng, buildCardPngFile } from "@/lib/share/verseCardExport";
import { cn } from "@/lib/utils";

interface VerseShareModalProps {
  poem: Poem;
  initialVerseIndex: number;
  onClose: () => void;
}

const MAX_VERSES_IN_CARD = 6;

// Font choices for the exported card, reusing the same Arabic webfont
// families already loaded app-wide (see src/styles/globals.css tokens) so
// no extra font loading is needed.
const CARD_FONT_OPTIONS: { value: string; label: string; family: string }[] = [
  { value: "amiri", label: "أميري (تقليدي)", family: '"Amiri", "Traditional Arabic", serif' },
  { value: "scheherazade", label: "شهرزاد الجديد", family: '"Scheherazade New", serif' },
  { value: "naskh", label: "نسخ عثماني", family: '"Noto Naskh Arabic", serif' },
  { value: "cairo", label: "القاهرة (عصري)", family: '"Cairo", "Almarai", sans-serif' },
];

const MIN_CARD_FONT_SIZE = 14;
const MAX_CARD_FONT_SIZE = 34;

const CARD_THEMES = [
  {
    id: "ink",
    label: "حبر",
    background: "linear-gradient(135deg, #0f1117 0%, #151922 50%, #0f1117 100%)",
    swatch: "#151922",
    foreground: "#f5ebdd",
    accent: "#d3ad3d",
    border: "rgba(211, 173, 61, 0.38)",
    muted: "#8f8a82",
  },
  {
    id: "paper",
    label: "ورق",
    background: "linear-gradient(135deg, #f6ecd8 0%, #e8d4ad 50%, #f3e5ca 100%)",
    swatch: "#ead7b2",
    foreground: "#2b211b",
    accent: "#8b5e34",
    border: "rgba(139, 94, 52, 0.46)",
    muted: "#766451",
  },
  {
    id: "midnight",
    label: "ليل",
    background: "linear-gradient(135deg, #09111f 0%, #132139 50%, #0a1425 100%)",
    swatch: "#132139",
    foreground: "#f1e8d8",
    accent: "#d3a768",
    border: "rgba(211, 167, 104, 0.42)",
    muted: "#8794a8",
  },
  {
    id: "olive",
    label: "زيتون",
    background: "linear-gradient(135deg, #111a15 0%, #243328 50%, #151f19 100%)",
    swatch: "#243328",
    foreground: "#efe8d9",
    accent: "#c6a15b",
    border: "rgba(198, 161, 91, 0.42)",
    muted: "#94a093",
  },
] as const;

// Base sizes (px) mirroring the previous density-derived Tailwind classes,
// used as the default before the user drags the size slider.
function defaultCardFontSize(verseCount: number): number {
  if (verseCount <= 2) return 24;
  if (verseCount <= 4) return 19;
  return 15;
}

export const VerseShareModal: React.FC<VerseShareModalProps> = ({
  poem,
  initialVerseIndex,
  onClose,
}) => {
  const [rangeStart, setRangeStart] = useState(initialVerseIndex);
  const [rangeEnd, setRangeEnd] = useState(initialVerseIndex);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<"native" | "whatsapp" | "telegram" | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const verses = useMemo(
    () => poem.verses.slice(rangeStart, rangeEnd + 1),
    [poem.verses, rangeStart, rangeEnd]
  );

  const verseCount = rangeEnd - rangeStart + 1;
  const canExtendUp = rangeStart > 0 && verseCount < MAX_VERSES_IN_CARD;
  const canExtendDown = rangeEnd < poem.verses.length - 1 && verseCount < MAX_VERSES_IN_CARD;
  const canShrink = verseCount > 1;

  // User-adjustable typography for the exported card. The size resets to a
  // sensible default whenever the verse count changes (more verses -> a
  // smaller default so a 6-verse card still fits comfortably), but once the
  // user drags the slider for a given range, their choice sticks.
  const [cardFontSize, setCardFontSize] = useState(() => defaultCardFontSize(verseCount));
  const [cardFontOption, setCardFontOption] = useState(CARD_FONT_OPTIONS[0].value);
  const [cardThemeId, setCardThemeId] = useState<(typeof CARD_THEMES)[number]["id"]>("ink");
  const lastAutoVerseCount = useRef(verseCount);
  if (lastAutoVerseCount.current !== verseCount) {
    lastAutoVerseCount.current = verseCount;
    // Re-derive the default only on range-size changes, not on every render.
    // (Kept as a plain conditional instead of useEffect so the new size is
    // ready before the card re-renders with the new verse list.)
    const nextDefault = defaultCardFontSize(verseCount);
    if (cardFontSize !== nextDefault) setCardFontSize(nextDefault);
  }

  const cardFontFamily =
    CARD_FONT_OPTIONS.find((opt) => opt.value === cardFontOption)?.family ?? CARD_FONT_OPTIONS[0].family;
  const cardTheme = CARD_THEMES.find((theme) => theme.id === cardThemeId) ?? CARD_THEMES[0];

  const rowGapClass = verseCount <= 2 ? "gap-2" : verseCount <= 4 ? "gap-1.5" : "gap-1";
  const gapClass = verseCount <= 2 ? "gap-5 md:gap-6" : verseCount <= 4 ? "gap-3.5 md:gap-4" : "gap-2.5 md:gap-3";
  const leadingClass = verseCount <= 2 ? "leading-[1.9]" : verseCount <= 4 ? "leading-[1.7]" : "leading-[1.5]";

  const cardFilename = `${poem.title}-${poem.poet.name}`;
  const shareCaption = `${poem.title} - ${poem.poet.name}\n\n${verses
    .map((v) => `${v.firstHemistich} ${v.secondHemistich}`)
    .join("\n")}`;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportError(null);
    const result = await exportCardNodeToPng(cardRef.current, cardFilename);
    setIsExporting(false);
    if (!result.success && result.error !== "cancelled") {
      setExportError("تعذّر إنشاء الصورة. يرجى المحاولة مرة أخرى.");
    } else if (result.success) {
      onClose();
    }
  };

  // Native OS share sheet (WhatsApp, Telegram, Mail, AirDrop, etc. depending
  // on platform) with the actual rendered image attached, when supported.
  const canShareNatively =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const handleNativeShare = async () => {
    if (!cardRef.current) return;
    setIsSharing("native");
    setExportError(null);
    try {
      const file = await buildCardPngFile(cardRef.current, cardFilename);
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: poem.title, text: shareCaption });
      } else {
        await navigator.share({ title: poem.title, text: shareCaption });
      }
    } catch (err) {
      // AbortError just means the user closed the share sheet -- not a failure.
      if (!(err instanceof Error) || err.name !== "AbortError") {
        setExportError("تعذّرت المشاركة. يمكنك تنزيل الصورة ومشاركتها يدويًا.");
      }
    } finally {
      setIsSharing(null);
    }
  };

  // WhatsApp/Telegram web share only accept text (not raw image bytes) via
  // URL, so these open a pre-filled share dialog with the verse text; the
  // image itself is shared via the download or the native share sheet above.
  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareCaption)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleTelegramShare = () => {
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(shareCaption)}`;
    window.open(url, "_blank", "noopener,noreferrer");
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

        {/* Typography controls for the exported card */}
        <div className="px-6 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-charcoal-900 border border-white/5 rounded-xl px-3 py-2">
            <label className="text-[11px] font-bold text-ink-600 font-sans shrink-0">حجم الخط</label>
            <input
              type="range"
              min={MIN_CARD_FONT_SIZE}
              max={MAX_CARD_FONT_SIZE}
              step={1}
              value={cardFontSize}
              onChange={(e) => setCardFontSize(Number(e.target.value))}
              className="flex-1 accent-accent-700 cursor-pointer"
            />
            <span className="text-[11px] font-mono font-bold text-ink-500 w-7 text-center">{cardFontSize}</span>
          </div>
          <div className="flex items-center gap-2 bg-charcoal-900 border border-white/5 rounded-xl px-3 py-2">
            <label className="text-[11px] font-bold text-ink-600 font-sans shrink-0">نوع الخط</label>
            <select
              value={cardFontOption}
              onChange={(e) => setCardFontOption(e.target.value)}
              className="bg-transparent text-parchment-100 text-[12px] font-bold focus:outline-none cursor-pointer"
            >
              {CARD_FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-charcoal-900">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Card preview (this exact node is rasterized to PNG) */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            ref={cardRef}
            className="relative w-full min-h-[420px] rounded-3xl overflow-hidden border flex flex-col items-center justify-center px-8 py-10 text-center shadow-2xl"
            style={{
              fontFamily: cardFontFamily,
              background: cardTheme.background,
              borderColor: cardTheme.border,
            }}
          >
            {/* Decorative corner ornaments */}
            <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2 rounded-tl-xl" style={{ borderColor: cardTheme.accent }} />
            <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2 rounded-tr-xl" style={{ borderColor: cardTheme.accent }} />
            <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2 rounded-bl-xl" style={{ borderColor: cardTheme.accent }} />
            <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2 rounded-br-xl" style={{ borderColor: cardTheme.accent }} />

            <h2 className="text-xl md:text-2xl font-bold mb-1" style={{ fontFamily: cardFontFamily, color: cardTheme.accent }}>
              {poem.title}
            </h2>
            <span className="text-[11px] font-sans font-bold mb-8 tracking-wide" style={{ color: cardTheme.muted }}>
              {poem.poet.name}
            </span>

            <div className={cn("flex flex-col w-full", gapClass)}>
              {verses.map((verse) => (
                <div key={verse.id} className={cn("flex flex-col", rowGapClass)}>
                  <p
                    className={cn("text-center font-bold text-shadow-gold", leadingClass)}
                    style={{ fontFamily: cardFontFamily, fontSize: `${cardFontSize}px`, color: cardTheme.foreground }}
                  >
                    {verse.firstHemistich}
                  </p>
                  <p
                    className={cn("text-center font-bold text-shadow-gold", leadingClass)}
                    style={{ fontFamily: cardFontFamily, fontSize: `${cardFontSize}px`, color: cardTheme.foreground }}
                  >
                    {verse.secondHemistich}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-2" style={{ color: cardTheme.muted }}>
              <div className="w-8 h-px" style={{ backgroundColor: cardTheme.border }} />
              <span className="text-[10px] font-sans font-bold tracking-[0.2em]">ديوان</span>
              <div className="w-8 h-px" style={{ backgroundColor: cardTheme.border }} />
            </div>
          </div>
        </div>

        {/* Background is the final customization option before export */}
        <div className="px-6 pb-4 shrink-0">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3">
            <span className="text-[11px] font-bold text-ink-500 font-sans">الخلفية</span>
            <div className="flex items-center gap-3">
              {CARD_THEMES.map((theme) => {
                const selected = theme.id === cardTheme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setCardThemeId(theme.id)}
                    title={`خلفية ${theme.label}`}
                    aria-label={`خلفية ${theme.label}`}
                    className={cn(
                      "flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer",
                      selected ? "text-accent-700" : "text-ink-600 hover:text-parchment-100"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full border-2 transition-transform",
                        selected && "scale-110"
                      )}
                      style={{
                        backgroundColor: theme.swatch,
                        borderColor: selected ? theme.accent : "rgba(255,255,255,0.16)",
                      }}
                    >
                      {selected && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.accent }} />}
                    </span>
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-charcoal-850 flex flex-col gap-3 shrink-0">
          {exportError && (
            <span className="text-[12px] font-bold text-crimson-500 font-ui">{exportError}</span>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                title="مشاركة عبر واتساب"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-ink-500 hover:text-parchment-100 border border-white/10 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleTelegramShare}
                title="مشاركة عبر تيليجرام"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-ink-500 hover:text-parchment-100 border border-white/10 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
              {canShareNatively && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  disabled={isSharing === "native"}
                  title="مشاركة عبر تطبيقات أخرى"
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-ink-500 hover:text-parchment-100 border border-white/10 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSharing === "native" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
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
    </div>
  );
};
