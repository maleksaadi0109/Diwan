import React from "react";
import { useUndoHistory } from "@/contexts/UndoHistoryContext";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

/** Toast feedback for undo/redo actions, mounted once at the app root so it
 * stays visible regardless of which tab triggered the edit. */
export const UndoToastStack: React.FC = () => {
  const { notifications, dismissNotification } = useUndoHistory();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-1/2 translate-x-1/2 z-[75] flex flex-col gap-2 w-[92vw] max-w-sm pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl text-xs font-sans animate-in fade-in slide-in-from-top-3 duration-300 ${
            n.kind === "success"
              ? "bg-charcoal-850 border-accent-700/30 text-parchment-100"
              : "bg-crimson-500/15 border-crimson-500/30 text-crimson-200"
          }`}
        >
          {n.kind === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-accent-700" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-relaxed">{n.message}</span>
          <button onClick={() => dismissNotification(n.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
