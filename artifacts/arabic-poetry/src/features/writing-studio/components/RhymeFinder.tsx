import React from "react";
import { RHYME_DICTIONARY, ARABIC_LETTERS } from "../../../lib/studio/rhymes";
import { X, Search } from "lucide-react";
import { cn } from "../../../lib/utils";

interface RhymeFinderProps {
  onClose: () => void;
  targetRhyme?: string;
  onSetTargetRhyme: (letter: string | undefined) => void;
}

export const RhymeFinder: React.FC<RhymeFinderProps> = ({ onClose, targetRhyme, onSetTargetRhyme }) => {
  const [selectedLetter, setSelectedLetter] = React.useState<string | null>(targetRhyme || null);

  const handleLetterClick = (letter: string) => {
    setSelectedLetter(letter);
  };

  const currentWords = selectedLetter ? RHYME_DICTIONARY[selectedLetter] : [];

  return (
    <div className="w-72 flex flex-col bg-charcoal-900/50 border-l border-white/5 h-full shrink-0">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-ui font-bold text-parchment-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-accent-700" />
          <span>قاموس القوافي</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-white/5">
        <p className="text-xs text-ink-500 mb-2 font-ui">اختر حرف الروي (القافية):</p>
        <div className="flex flex-wrap gap-1.5" dir="rtl">
          {ARABIC_LETTERS.map(letter => (
            <button
              key={letter}
              onClick={() => handleLetterClick(letter)}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded text-sm font-bold font-ui cursor-pointer transition-colors border border-transparent",
                selectedLetter === letter 
                  ? "bg-accent-700 text-charcoal-950" 
                  : "bg-charcoal-800 text-ink-400 hover:border-white/10 hover:text-parchment-100"
              )}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedLetter ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-ui font-bold text-accent-500">كلمات تنتهي بحرف {selectedLetter}</h4>
              <button
                onClick={() => {
                  const val = targetRhyme === selectedLetter ? undefined : selectedLetter;
                  onSetTargetRhyme(val);
                }}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full border transition-colors cursor-pointer font-ui",
                  targetRhyme === selectedLetter
                    ? "bg-accent-700/20 border-accent-700 text-accent-500"
                    : "bg-transparent border-white/10 text-ink-500 hover:border-white/20 hover:text-parchment-100"
                )}
              >
                {targetRhyme === selectedLetter ? 'إلغاء التثبيت' : 'تثبيت كقافية للمسودة'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentWords.map(word => (
                <span 
                  key={word}
                  className="px-3 py-1.5 bg-charcoal-800 border border-white/5 rounded-lg text-sm text-parchment-100 font-poetry"
                >
                  {word}
                </span>
              ))}
            </div>
            <p className="text-xs text-ink-600 mt-6 font-ui">
              ملاحظة: هذا قاموس مصغر لمساعدتك في الاستلهام.
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-ink-600 space-y-3">
            <Search className="w-8 h-8 opacity-20" />
            <p className="text-sm font-ui text-center">اختر حرفاً لعرض<br/>قائمة بالكلمات المقترحة</p>
          </div>
        )}
      </div>
    </div>
  );
};
