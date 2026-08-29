import React from "react";
import { WordDefinition } from "@/types";
import { BookOpen, X, Sparkles } from "lucide-react";

interface DictionaryWordModalProps {
  word: string | null;
  definition: WordDefinition | null;
  isLoading: boolean;
  onClose: () => void;
}

export const DictionaryWordModal: React.FC<DictionaryWordModalProps> = ({
  word,
  definition,
  isLoading,
  onClose,
}) => {
  if (!word) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none animate-fadeIn">
      <div className="bg-[#14171E] border border-[#D4AF37]/30 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2 text-[#F3E19C]">
            <BookOpen className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="text-sm font-bold font-poetry tracking-wide">معجم المعاني والشعر</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#A0AAB7] hover:text-[#F8F9FA] p-1.5 rounded-xl hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-center py-2">
            <h2 className="font-poetry text-4xl font-bold text-[#F3E19C] tracking-wide drop-shadow-sm">
              {word}
            </h2>
            {definition?.root && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#D4AF37]/15 text-[#F3E19C] border border-[#D4AF37]/30 shadow-sm">
                الجذر: {definition.root}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-6 text-xs text-[#A0AAB7]">
              جاري البحث في المعجم المحلي...
            </div>
          ) : definition ? (
            <div className="bg-black/30 p-5 rounded-2xl border border-white/[0.08] space-y-3 select-text">
              <span className="text-xs font-semibold text-[#D4AF37] block">المعنى والشرح:</span>
              <p className="text-base text-[#F8F9FA] font-poetry leading-[2]">
                {definition.meaning}
              </p>
              <div className="pt-3 border-t border-white/[0.08] flex justify-between text-[11px] text-[#A0AAB7]">
                <span>المصدر المعجمي:</span>
                <span className="text-[#F3E19C] font-semibold">{definition.source}</span>
              </div>
            </div>
          ) : (
            <div className="bg-black/30 p-5 rounded-2xl border border-white/[0.08] text-center space-y-2">
              <Sparkles className="w-6 h-6 text-[#D4AF37]/60 mx-auto" />
              <p className="text-xs text-[#E9ECEF]">
                الكلمة «{word}» فصيحة من أبيات القصيدة.
              </p>
              <p className="text-[11px] text-[#6C7A8C]">
                المعجم المحلي يحتوي على المفردات النادرة والشواهد الشعرية.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-black/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[#F8F9FA] text-xs font-medium border border-white/10 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
