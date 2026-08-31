import React, { useMemo, useState } from "react";
import { X, Search, Keyboard } from "lucide-react";
import { SHORTCUT_ENTRIES } from "@/lib/shortcuts";

interface ShortcutsReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsReferenceModal: React.FC<ShortcutsReferenceModalProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUT_ENTRIES;
    return SHORTCUT_ENTRIES.filter(
      (entry) =>
        entry.description.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.keys.some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof SHORTCUT_ENTRIES>();
    for (const entry of filtered) {
      const list = groups.get(entry.category) || [];
      list.push(entry);
      groups.set(entry.category, list);
    }
    return groups;
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="اختصارات لوحة المفاتيح"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[80vh] bg-charcoal-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-accent-700" />
            <h2 className="font-poetry text-xl font-bold text-parchment-100">اختصارات لوحة المفاتيح</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-600 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن اختصار..."
              dir="rtl"
              className="w-full bg-charcoal-950/50 text-parchment-100 placeholder-ink-600 border border-white/10 focus:border-accent-700 focus:outline-none rounded-xl pr-9 pl-4 py-2.5 text-sm font-sans transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 font-sans">
          {filtered.length === 0 && (
            <p className="text-center text-ink-600 text-sm py-8">لا توجد اختصارات مطابقة</p>
          )}
          {Array.from(grouped.entries()).map(([category, entries]) => (
            <div key={category}>
              <h3 className="text-[11px] font-bold text-accent-700 uppercase tracking-widest mb-2.5">{category}</h3>
              <div className="space-y-1.5">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-xs text-ink-500 flex-1">{entry.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.keys.map((key, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-ink-700 text-[10px]">+</span>}
                          <kbd className="font-mono font-bold text-[10px] text-accent-500 border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg shadow-sm min-w-[24px] text-center">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
