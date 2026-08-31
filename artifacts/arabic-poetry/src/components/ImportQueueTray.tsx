import React, { useState } from "react";
import { useImportQueueContext } from "@/contexts/ImportQueueContext";
import { toArabicDigits } from "@/lib/utils";
import {
  ListChecks,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Ban,
  Trash2,
} from "lucide-react";

/** Floating background-queue tray + toast notification stack, mounted once
 * at the app root so it stays visible across every tab (library, player,
 * import, etc.) and survives navigating away from the screen that started
 * a job. */
export const ImportQueueTray: React.FC = () => {
  const { jobs, isProcessing, retryJob, cancelJob, dismissJob, notifications, dismissNotification } =
    useImportQueueContext();
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = jobs.filter((j) => j.status === "pending" || j.status === "processing").length;
  const sortedJobs = [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (jobs.length === 0 && notifications.length === 0) return null;

  return (
    <>
      {/* Toast notifications: visible from any tab */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 w-[92vw] max-w-sm pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl text-xs font-sans animate-in fade-in slide-in-from-top-3 duration-300 ${
              n.kind === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                : "bg-crimson-500/15 border-crimson-500/30 text-crimson-200"
            }`}
          >
            {n.kind === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
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

      {/* Floating tray toggle */}
      {jobs.length > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-4 z-[65]">
          {isOpen && (
            <div className="mb-3 w-[85vw] max-w-sm max-h-[60vh] overflow-y-auto bg-charcoal-850 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-3 space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-white/5">
                <h4 className="text-xs font-bold text-parchment-100 font-sans">طابور المعالجة في الخلفية</h4>
                <button onClick={() => setIsOpen(false)} className="text-ink-500 hover:text-parchment-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {sortedJobs.length === 0 && (
                <p className="text-[11px] text-ink-600 py-4 text-center">لا توجد مهام حالياً</p>
              )}

              {sortedJobs.map((job) => (
                <div key={job.id} className="p-2.5 bg-charcoal-900 rounded-xl border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-parchment-100 truncate">{job.title}</span>
                    {(job.status === "completed" || job.status === "failed" || job.status === "cancelled") && (
                      <button
                        onClick={() => dismissJob(job.id)}
                        className="shrink-0 text-ink-600 hover:text-ink-400"
                        title="إخفاء"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-ink-500">{job.stageLabel || job.stage}</p>

                  {(job.status === "pending" || job.status === "processing") && (
                    <div className="w-full bg-charcoal-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-accent-700 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, Math.min(100, job.progress * 100))}%` }}
                      />
                    </div>
                  )}

                  {job.status === "failed" && job.errorMessage && (
                    <p className="text-[10px] text-crimson-400">{job.errorMessage}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-ink-600 ltr-num">
                      {job.status === "pending" && "بانتظار الدور"}
                      {job.status === "processing" && `${toArabicDigits(Math.round(job.progress * 100))}%`}
                      {job.status === "completed" && "اكتمل"}
                      {job.status === "cancelled" && "أُلغي"}
                      {job.status === "failed" && "فشل"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(job.status === "pending" || job.status === "processing") && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-ink-400"
                          title="إلغاء"
                        >
                          <Ban className="w-3 h-3" />
                        </button>
                      )}
                      {(job.status === "failed" || job.status === "cancelled") && (
                        <button
                          onClick={() => retryJob(job.id)}
                          className="p-1 rounded-lg bg-accent-700/20 hover:bg-accent-700/30 text-accent-700"
                          title="إعادة المحاولة"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setIsOpen((v) => !v)}
            className="relative w-12 h-12 rounded-full bg-charcoal-850 border border-white/10 shadow-2xl flex items-center justify-center text-accent-700 hover:bg-charcoal-800 transition-colors"
            title="طابور المعالجة"
          >
            <ListChecks className={`w-5 h-5 ${isProcessing ? "animate-pulse" : ""}`} />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-700 text-charcoal-950 text-[10px] font-bold flex items-center justify-center ltr-num">
                {toArabicDigits(activeCount)}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
};
