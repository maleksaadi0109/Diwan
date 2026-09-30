import React, { useState } from "react";
import { Upload, Copy, Type, EyeOff, CheckCheck, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatDraftAsText } from "../../../lib/studio/parser";
import { StudioVerse } from "../../../lib/studio/types";

interface ToolbarProps {
  verses: StudioVerse[];
  hideDiacritics: boolean;
  onToggleDiacritics: () => void;
  onOpenImport: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  verses,
  hideDiacritics,
  onToggleDiacritics,
  onOpenImport
}) => {
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    setCopying(true);
    setCopyError(false);
    try {
      const text = formatDraftAsText(verses);
      await navigator.clipboard.writeText(text);
      setTimeout(() => setCopying(false), 2000);
    } catch (err) {
      setCopyError(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-charcoal-800/50 border border-white/5 rounded-2xl shrink-0">
      <button
        onClick={onOpenImport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-colors font-ui text-sm cursor-pointer"
        title="استيراد نص"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">استيراد</span>
      </button>

      <button
        onClick={handleCopy}
        disabled={verses.length === 0}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors font-ui text-sm cursor-pointer disabled:opacity-50",
          copying && !copyError ? "text-accent-500 bg-accent-700/10" : "text-ink-500 hover:text-parchment-100 hover:bg-white/10",
          copyError && "text-crimson-500 bg-crimson-500/10"
        )}
        title="نسخ القصيدة"
      >
        {copying && !copyError ? <CheckCheck className="w-4 h-4" /> : copyError ? <X className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <span className="hidden sm:inline">{copying && !copyError ? "تم النسخ" : "نسخ النص"}</span>
      </button>

      <div className="w-px h-4 bg-white/10 mx-1" />

      <button
        onClick={onToggleDiacritics}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors font-ui text-sm cursor-pointer",
          hideDiacritics ? "bg-accent-700/10 text-accent-500" : "text-ink-500 hover:text-parchment-100 hover:bg-white/10"
        )}
        title="إخفاء التشكيل مؤقتاً"
      >
        {hideDiacritics ? <EyeOff className="w-4 h-4" /> : <Type className="w-4 h-4" />}
        <span className="hidden sm:inline">إخفاء التشكيل</span>
      </button>
    </div>
  );
};
