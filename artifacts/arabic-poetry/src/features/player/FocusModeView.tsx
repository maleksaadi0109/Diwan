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
    <div className="fixed inset-0 z-50 bg-[#05060A] text-[#F8F9FA] flex flex-col">
      {/* Minimal exit affordance */}
      <button
        type="button"
        onClick={onExit}
        title="الخروج من وضع التركيز (Esc)"
        className="absolute top-6 left-6 z-10 w-10 h-10 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-[#A0AAB7] hover:text-[#F8F9FA] transition-all cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 overflow-y-auto px-6 md:px-16 py-20 md:py-24">
        <div className="max-w-3xl mx-auto w-full space-y-14">
          <h1 className="font-poetry text-2xl md:text-3xl text-center text-[#D4AF37]/90 select-none mb-4">
            {poem.title}
          </h1>

          {poem.verses.map((verse, index) => (
            <div
              key={verse.id}
              id={`focus-verse-${index}`}
              onClick={() => onSeekToVerse(verse)}
              className="flex flex-col items-center justify-center gap-3 cursor-pointer select-text py-2"
            >
              <p
                className={cn(
                  "font-poetry text-2xl md:text-4xl leading-[2.6] text-center transition-all duration-300",
                  index === activeVerseIndex
                    ? "text-[#F8F9FA] font-bold text-shadow-gold"
                    : "text-[#5C6470] hover:text-[#9AA2AD]"
                )}
              >
                {verse.firstHemistich}
              </p>
              <p
                className={cn(
                  "font-poetry text-2xl md:text-4xl leading-[2.6] text-center transition-all duration-300",
                  index === activeVerseIndex
                    ? "text-[#F8F9FA] font-bold text-shadow-gold"
                    : "text-[#5C6470] hover:text-[#9AA2AD]"
                )}
              >
                {verse.secondHemistich}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Single, unobtrusive playback affordance */}
      <button
        type="button"
        onClick={onTogglePlay}
        title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 backdrop-blur-xl flex items-center justify-center text-[#D4AF37] transition-all cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.4)]"
      >
        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 mr-[-2px]" />}
      </button>
    </div>
  );
};
