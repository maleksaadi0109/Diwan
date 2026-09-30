import React, { useState } from "react";
import { X, ClipboardPaste, Upload } from "lucide-react";
import { parsePastedText } from "../../../lib/studio/parser";
import { StudioVerse } from "../../../lib/studio/types";
import { cn } from "../../../lib/utils";

interface ImportModalProps {
  onClose: () => void;
  onImport: (verses: StudioVerse[], mode: 'replace' | 'append') => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText((prev) => prev + (prev ? "\n" : "") + clipboardText);
    } catch (err) {
      setError("تعذر قراءة الحافظة. يرجى اللصق يدوياً.");
    }
  };

  const handleSubmit = (mode: 'replace' | 'append') => {
    const verses = parsePastedText(text);
    if (verses.length === 0) {
      setError("النص لا يحتوي على أبيات صالحة.");
      return;
    }
    onImport(verses, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-charcoal-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-charcoal-800/50">
          <h3 className="font-ui font-bold text-parchment-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent-700" />
            <span>استيراد نص</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          <p className="text-sm font-ui text-ink-400">
            ألصق نص القصيدة هنا. يفضل أن يكون كل بيت في سطر، ويفصل بين الشطرين بمسافات أو علامات.
          </p>
          
          <div className="relative flex-1 min-h-[200px]">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, 250_000));
                setError(null);
              }}
              maxLength={250000}
              placeholder="شطر أول   شطر ثان&#10;شطر أول   شطر ثان"
              dir="auto"
              className="w-full h-full bg-charcoal-950/50 border border-white/10 rounded-xl p-4 text-parchment-100 font-sans focus:outline-none focus:border-accent-700 transition-colors resize-none"
            />
            {text.length === 0 && (
              <button
                onClick={handlePaste}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 bg-charcoal-800 border border-white/10 rounded-lg flex items-center gap-2 text-ink-400 hover:text-parchment-100 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="font-ui text-sm">لصق من الحافظة</span>
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 bg-crimson-500/10 border border-crimson-500/20 text-crimson-500 text-sm font-ui rounded-xl text-center">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-charcoal-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-ui font-medium text-ink-400 hover:text-parchment-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            onClick={() => handleSubmit('append')}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl text-sm font-ui font-medium bg-charcoal-700 border border-white/10 text-parchment-100 hover:bg-charcoal-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            إضافة للمسودة
          </button>
          <button
            onClick={() => handleSubmit('replace')}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl text-sm font-ui font-bold bg-accent-700 text-charcoal-950 hover:bg-accent-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            استبدال المسودة
          </button>
        </div>
      </div>
    </div>
  );
};
