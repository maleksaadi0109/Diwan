import React from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { StudioVerse } from "../../../lib/studio/types";
import { calculateBalanceRatio, countWords, extractRhymeLetter } from "../../../lib/studio/analysis";
import { cn } from "../../../lib/utils";

interface VerseRowProps {
  verse: StudioVerse;
  index: number;
  totalVerses: number;
  targetRhyme?: string;
  hideDiacritics: boolean;
  onChange: (id: string, updates: Partial<StudioVerse>) => void;
  onDelete: (id: string) => void;
  onAddAfter: (index: number) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
}

export const VerseRow: React.FC<VerseRowProps> = ({
  verse,
  index,
  totalVerses,
  targetRhyme,
  hideDiacritics,
  onChange,
  onDelete,
  onAddAfter,
  onReorder
}) => {
  const balance = calculateBalanceRatio(verse.firstHemistich, verse.secondHemistich);
  const detectedRhyme = extractRhymeLetter(verse.secondHemistich || verse.firstHemistich);
  
  const isRhymeMatch = targetRhyme && detectedRhyme === targetRhyme;
  const showRhymeWarning = targetRhyme && detectedRhyme && !isRhymeMatch;

  const styleInput = (val: string) => hideDiacritics ? val.replace(/[\u064B-\u065F\u0670]/g, '') : val;

  return (
    <div className="flex items-start gap-3 group relative w-full mb-4">
      {/* Controls */}
      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2 shrink-0">
        <button
          onClick={() => onReorder(verse.id, 'up')}
          disabled={index === 0}
          className="p-1 rounded text-ink-500 hover:text-parchment-100 hover:bg-white/10 disabled:opacity-30"
          title="أعلى"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-ink-600">{index + 1}</span>
        <button
          onClick={() => onReorder(verse.id, 'down')}
          disabled={index === totalVerses - 1}
          className="p-1 rounded text-ink-500 hover:text-parchment-100 hover:bg-white/10 disabled:opacity-30"
          title="أسفل"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editor Fields */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <input
            type="text"
            value={styleInput(verse.firstHemistich)}
            onChange={(e) => onChange(verse.id, { firstHemistich: e.target.value.slice(0, 500) })}
            maxLength={500}
            placeholder="الشطر الأول"
            dir="rtl"
            data-testid={`input-first-hemistich-${index}`}
            className="w-full bg-transparent border-b border-white/10 px-3 py-3 text-lg md:text-xl font-poetry text-center text-parchment-100 focus:outline-none focus:border-accent-700 transition-colors placeholder:text-ink-700/50"
          />
          <div className="absolute -bottom-5 right-2 text-[10px] text-ink-600 font-ui opacity-0 group-hover:opacity-100 transition-opacity">
            {countWords(verse.firstHemistich)} كلمات
          </div>
        </div>

        {/* Balance Indicator */}
        <div className="hidden md:flex shrink-0 w-8 h-8 items-center justify-center relative tooltip-trigger cursor-help">
          {balance !== null ? (
            <div 
              className="w-4 h-4 rounded-full border-2 transition-all duration-300"
              style={{
                borderColor: Math.abs(1 - balance) < 0.2 ? 'var(--color-accent-700)' : 'var(--color-ink-600)',
                transform: `rotate(${(balance - 1) * 45}deg)`,
                opacity: Math.abs(1 - balance) < 0.2 ? 1 : 0.4
              }}
              title={`مؤشر توازن الشطرين: ${balance.toFixed(2)}`}
            >
              <div className="w-full h-0.5 bg-current absolute top-1/2 -translate-y-1/2 left-0" />
            </div>
          ) : (
            <div className="w-1 h-1 bg-white/10 rounded-full" />
          )}
        </div>

        <div className="flex-1 w-full relative">
          <input
            type="text"
            value={styleInput(verse.secondHemistich)}
            onChange={(e) => onChange(verse.id, { secondHemistich: e.target.value.slice(0, 500) })}
            maxLength={500}
            placeholder="الشطر الثاني"
            dir="rtl"
            data-testid={`input-second-hemistich-${index}`}
            className={cn(
              "w-full bg-transparent border-b px-3 py-3 text-lg md:text-xl font-poetry text-center text-parchment-100 focus:outline-none transition-colors placeholder:text-ink-700/50",
              showRhymeWarning ? "border-crimson-500/50 focus:border-crimson-500" : "border-white/10 focus:border-accent-700"
            )}
          />
          <div className="absolute -bottom-5 left-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {detectedRhyme && (
              <span className={cn(
                "text-[10px] font-ui px-1.5 py-0.5 rounded",
                showRhymeWarning ? "bg-crimson-500/10 text-crimson-500" : "bg-white/5 text-ink-500"
              )}>
                الروي: {detectedRhyme}
              </span>
            )}
            <span className="text-[10px] text-ink-600 font-ui">
              {countWords(verse.secondHemistich)} كلمات
            </span>
          </div>
        </div>
      </div>

      {/* Row Actions */}
      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2 shrink-0">
        <button
          onClick={() => onDelete(verse.id)}
          className="p-1.5 rounded text-ink-500 hover:text-crimson-500 hover:bg-crimson-500/10 transition-colors"
          title="حذف البيت"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onAddAfter(index)}
          className="p-1.5 rounded text-ink-500 hover:text-accent-500 hover:bg-accent-700/10 transition-colors"
          title="إضافة بيت بعده"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
