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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-100/70 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div className="bg-sand-50 border border-sand-300 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-sand-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-crimson-700">
            <BookOpen className="w-5 h-5" />
            <h3 className="text-sm font-bold font-poetry">معجم المعاني والشعر</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-ink-800 p-1 rounded-lg hover:bg-sand-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-center py-2">
            <h2 className="font-poetry text-3xl font-bold text-crimson-600">
              {word}
            </h2>
            {definition?.root && (
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-crimson-800/15 text-crimson-700 border border-crimson-800/30">
                الجذر: {definition.root}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-6 text-xs text-ink-600">
              جاري البحث في المعجم المحلي...
            </div>
          ) : definition ? (
            <div className="bg-sand-100 p-4 rounded-xl border border-sand-300 space-y-2 select-text">
              <span className="text-xs font-semibold text-crimson-700 block">المعنى والشرح:</span>
              <p className="text-sm text-ink-900 font-poetry leading-relaxed">
                {definition.meaning}
              </p>
              <div className="pt-2 border-t border-sand-300 flex justify-between text-[11px] text-ink-600">
                <span>المصدر المعجمي:</span>
                <span className="text-crimson-600 font-semibold">{definition.source}</span>
              </div>
            </div>
          ) : (
            <div className="bg-sand-100 p-4 rounded-xl border border-sand-300 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-crimson-700/50 mx-auto" />
              <p className="text-xs text-ink-700">
                الكلمة «{word}» فصيحة من أبيات القصيدة.
              </p>
              <p className="text-[11px] text-ink-600">
                المعجم المحلي يحتوي على المفردات النادرة والشواهد الشعرية.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-sand-300 bg-white/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sand-200 hover:bg-sand-300 text-ink-700 text-xs font-medium border border-sand-400 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
