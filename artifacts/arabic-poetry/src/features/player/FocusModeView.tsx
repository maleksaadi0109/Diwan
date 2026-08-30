import React, { useEffect } from "react";
import { Poem, Verse } from "@/types";
import { cn } from "@/lib/utils";
import { X, Play, Pause } from "lucide-react";

interface FocusModeViewProps {
  poem: Poem;
  activeVerseIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekToVerse: (verse: Verse) => void;
  onExit: () => void;
}

/**
 * شاشة كاملة للقراءة المركّزة (Focus Mode): تعرض أبيات القصيدة فقط،
 * بلا شرح، بلا بيانات توقيت أو ثقة، وبلا أي أدوات تحكم أو شريط جانبي.
 * الهدف تفريغ الشاشة من كل عنصر يشتّت القارئ عن النص نفسه.
 */
export const FocusModeView: React.FC<FocusModeViewProps> = ({
  poem,
  activeVerseIndex,
  isPlaying,
  onTogglePlay,
  onSeekToVerse,
  onExit,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  useEffect(() => {
    if (activeVerseIndex < 0) return;
    const el = document.getElementById(`focus-verse-${activeVerseIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeVerseIndex]);

  return (
    <div className="fixed inset-0 z-50 bg-charcoal-950 text-parchment-100 flex flex-col">
      {/* Minimal exit affordance */}
      <button
        type="button"
        onClick={onExit}
        title="الخروج من وضع التركيز (Esc)"
        className="absolute top-6 left-6 md:top-8 md:left-8 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-ink-500 hover:text-parchment-100 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
      >
        <X className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      <div className="flex-1 overflow-y-auto px-4 md:px-16 py-20 md:py-24 scroll-smooth">
        <div className="max-w-3xl mx-auto w-full space-y-12 md:space-y-16">
          <h1 className="font-poetry text-2xl md:text-4xl text-center text-accent-700/80 select-none mb-4 md:mb-8 font-bold">
            {poem.title}
          </h1>

          {poem.verses.map((verse, index) => (
            <div
              key={verse.id}
              id={`focus-verse-${index}`}
              onClick={() => onSeekToVerse(verse)}
              className="flex flex-col items-center justify-center gap-3 md:gap-4 cursor-pointer select-text py-2"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeekToVerse(verse);
                }
              }}
            >
              <p
                className={cn(
                  "font-poetry text-2xl md:text-[40px] leading-[2.6] text-center transition-all duration-500",
                  index === activeVerseIndex
                    ? "text-parchment-100 font-bold text-shadow-gold scale-105"
                    : "text-ink-600 hover:text-ink-400"
                )}
              >
                {verse.firstHemistich}
              </p>
              <p
                className={cn(
                  "font-poetry text-2xl md:text-[40px] leading-[2.6] text-center transition-all duration-500",
                  index === activeVerseIndex
                    ? "text-parchment-100 font-bold text-shadow-gold scale-105"
                    : "text-ink-600 hover:text-ink-400"
                )}
              >
                {verse.secondHemistich}
              </p>
            </div>
          ))}
          
          <div className="h-32" /> {/* Bottom padding to allow last verse to scroll to center */}
        </div>
      </div>

      {/* Single, unobtrusive playback affordance */}
      <button
        type="button"
        onClick={onTogglePlay}
        title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-14 h-14 md:w-16 md:h-16 rounded-full bg-charcoal-900/60 hover:bg-charcoal-800/80 border border-white/10 backdrop-blur-xl flex items-center justify-center text-accent-700 transition-all cursor-pointer shadow-[0_0_30px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 hover:scale-110 active:scale-95"
      >
        {isPlaying ? <Pause className="w-6 h-6 md:w-7 md:h-7" /> : <Play className="w-6 h-6 md:w-7 md:h-7 mr-[-2px]" />}
      </button>
    </div>
  );
};
