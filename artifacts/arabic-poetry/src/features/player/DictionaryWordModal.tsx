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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div className="bg-paper-100 border-2 border-paper-500 rounded-none w-full max-w-lg overflow-hidden shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-paper-400 flex items-center justify-between bg-paper-200">
          <div className="flex items-center gap-2 text-ink-900">
            <BookOpen className="w-5 h-5 text-accent-700" />
            <h3 className="text-lg font-bold font-heading">معجم المعاني والشعر</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-ink-900 p-1.5 rounded-none hover:bg-paper-300 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="text-center py-2 border-b border-paper-300 pb-5">
            <h2 className="font-heading text-5xl font-bold text-accent-700">
              {word}
            </h2>
            {definition?.root && (
              <span className="inline-block mt-3 px-4 py-1 text-sm font-bold bg-paper-200 text-ink-800 border border-paper-400 font-ui shadow-sm rounded-none">
                الجذر: {definition.root}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-sm font-bold text-ink-600 font-ui">
              جاري البحث في المعجم المحلي...
            </div>
          ) : definition ? (
            <div className="bg-paper-200 p-6 rounded-none border border-paper-400 space-y-4 select-text shadow-sm">
              <span className="text-sm font-bold text-accent-700 block font-ui">المعنى والشرح:</span>
              <p className="text-lg text-ink-900 font-poetry leading-[2.2]">
                {definition.meaning}
              </p>
              <div className="pt-4 border-t border-paper-400 flex justify-between text-[13px] text-ink-600 font-ui font-bold mt-2">
                <span>المصدر المعجمي:</span>
                <span className="text-ink-900">{definition.source}</span>
              </div>
            </div>
          ) : (
            <div className="bg-paper-200 p-6 rounded-none border border-paper-400 text-center space-y-3 shadow-sm">
              <Sparkles className="w-6 h-6 text-ink-500 mx-auto" />
              <p className="text-md font-bold text-ink-800 font-ui">
                الكلمة «{word}» فصيحة من أبيات القصيدة.
              </p>
              <p className="text-[13px] font-bold text-ink-500 font-ui">
                المعجم المحلي يحتوي على المفردات النادرة والشواهد الشعرية.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-paper-400 bg-paper-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-transparent hover:bg-paper-300 text-ink-800 text-[14px] font-bold border border-paper-500 transition-colors rounded-none font-ui"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
