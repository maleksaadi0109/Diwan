// Canonical reference data for every keyboard shortcut in the app, used to
// render the searchable shortcuts modal (ShortcutsReferenceModal). This is
// documentation only -- it does not wire up the actual key bindings, which
// live where the behavior they trigger lives (usePoemPlayback, PoemPlayerView,
// VerseItem, UndoHistoryContext). When adding or changing a shortcut in any
// of those places, update the matching entry here too so the reference
// never drifts from what's actually bound.

export interface ShortcutEntry {
  id: string;
  /** Key combo(s) shown as kbd chips, e.g. ["Space"] or ["Ctrl", "Enter"]. */
  keys: string[];
  description: string;
  category: "تشغيل" | "تنقّل" | "تحرير" | "عام";
}

export const SHORTCUT_ENTRIES: ShortcutEntry[] = [
  // Playback (bound in usePoemPlayback.ts)
  { id: "toggle-play", keys: ["Space"], description: "تشغيل أو إيقاف القراءة", category: "تشغيل" },
  { id: "toggle-play-k", keys: ["K"], description: "تشغيل أو إيقاف القراءة", category: "تشغيل" },
  { id: "seek-forward", keys: ["L"], description: "تقديم ٥ ثوانٍ", category: "تشغيل" },
  { id: "seek-back", keys: ["J"], description: "إرجاع ٥ ثوانٍ", category: "تشغيل" },
  { id: "verse-seek-next", keys: ["←"], description: "الانتقال بالتشغيل إلى البيت التالي", category: "تشغيل" },
  { id: "verse-seek-prev", keys: ["→"], description: "الانتقال بالتشغيل إلى البيت السابق", category: "تشغيل" },

  // Row navigation / selection (bound in PoemPlayerView.tsx) -- moves the
  // selected verse row without touching playback position.
  {
    id: "row-select-next",
    keys: ["↓"],
    description: "تحديد البيت التالي في القائمة (دون تغيير التشغيل)",
    category: "تنقّل",
  },
  {
    id: "row-select-prev",
    keys: ["↑"],
    description: "تحديد البيت السابق في القائمة (دون تغيير التشغيل)",
    category: "تنقّل",
  },

  // Editing (bound in VerseItem.tsx and PoemPlayerView.tsx)
  {
    id: "save-edit",
    keys: ["Ctrl", "Enter"],
    description: "حفظ تعديل نص البيت الجاري تحريره",
    category: "تحرير",
  },
  { id: "cancel-edit", keys: ["Esc"], description: "إلغاء تعديل نص البيت الجاري تحريره", category: "تحرير" },
  {
    id: "mark-boundary",
    keys: ["B"],
    description: "وضع علامة حد زمني عند نقطة التشغيل الحالية بين البيت النشط والبيت التالي",
    category: "تحرير",
  },
  { id: "undo", keys: ["Ctrl", "Z"], description: "تراجع عن آخر تعديل", category: "تحرير" },
  { id: "redo", keys: ["Ctrl", "Shift", "Z"], description: "إعادة تنفيذ آخر تراجع", category: "تحرير" },
  { id: "redo-y", keys: ["Ctrl", "Y"], description: "إعادة تنفيذ آخر تراجع", category: "تحرير" },

  // General (bound in App.tsx)
  { id: "open-shortcuts", keys: ["؟"], description: "فتح لائحة اختصارات لوحة المفاتيح", category: "عام" },
];
