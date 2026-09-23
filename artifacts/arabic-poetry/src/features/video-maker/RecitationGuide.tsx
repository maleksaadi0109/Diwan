import React, { useEffect, useMemo, useRef } from "react";
import { Poem } from "@/types";
import { Mic } from "lucide-react";

interface RecitationGuideProps {
  poem: Poem;
  highlightedWordCount: number;
  mode: "speech" | "unavailable";
}

export const RecitationGuide: React.FC<RecitationGuideProps> = ({
  poem,
  highlightedWordCount,
  mode,
}) => {
  const currentWordRef = useRef<HTMLSpanElement | null>(null);
  const verseOffsets = useMemo(() => {
    let offset = 0;
    return poem.verses.map((verse) => {
      const start = offset;
      offset += verse.text.trim().split(/\s+/).length;
      return start;
    });
  }, [poem]);

  useEffect(() => {
    currentWordRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedWordCount]);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-charcoal-950/95 backdrop-blur-md p-5 md:p-10"
      data-testid="video-recitation-guide"
      dir="rtl"
    >
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-parchment-100">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson-500 opacity-70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-crimson-500" />
            </span>
            جارٍ تسجيل صوتك
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {mode === "speech"
              ? "اقرأ باتجاه الكلمة الذهبية؛ الكلمات التي يتعرّف عليها النظام تتحول إلى الأخضر."
              : "يمكنك متابعة النص أثناء التسجيل، لكن التعرّف المباشر على الكلمات غير متاح على هذا الجهاز."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-ink-400">
          <Mic className="h-3.5 w-3.5 text-accent-700" />
          {mode === "speech" ? "تعرّف مباشر على الكلمات" : "دليل قراءة ثابت"}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 md:px-8">
        <h3 className="mb-8 text-center font-poetry text-2xl font-bold text-parchment-100 md:text-3xl">
          {poem.title}
        </h3>
        <div className="mx-auto max-w-4xl space-y-7 pb-24 text-center font-poetry text-2xl leading-[2.2] md:text-4xl">
          {poem.verses.map((verse, verseIndex) => {
            const words = verse.text.trim().split(/\s+/);
            const offset = verseOffsets[verseIndex];
            return (
              <p key={verse.id}>
                {words.map((word, wordIndex) => {
                  const globalIndex = offset + wordIndex;
                  const isComplete = globalIndex < highlightedWordCount;
                  const isCurrent = globalIndex === highlightedWordCount;
                  return (
                    <span
                      key={`${verse.id}-${wordIndex}`}
                      ref={isCurrent ? currentWordRef : undefined}
                      className={`mx-1 inline-block rounded-lg px-1.5 transition-all duration-200 ${
                        isComplete
                          ? "text-emerald-400"
                          : isCurrent
                            ? "bg-accent-700/15 text-accent-500 ring-1 ring-accent-700/30"
                            : "text-parchment-100/80"
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
};