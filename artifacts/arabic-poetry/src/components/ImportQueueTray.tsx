import React, { useState, useRef, useEffect } from "react";
import { useImportQueueContext, TrayCorner } from "@/contexts/ImportQueueContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { toArabicDigits } from "@/lib/utils";
import {
  ListChecks,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Ban,
  Trash2,
  EyeOff,
  Move,
  RotateCcw,
} from "lucide-react";

/** Floating background-queue tray + toast notification stack, mounted once
 * at the app root so it stays visible across every tab (library, player,
 * import, etc.) and survives navigating away from the screen that started
 * a job. */
export const ImportQueueTray: React.FC = () => {
  const {
    jobs,
    isProcessing,
    retryJob,
    cancelJob,
    dismissJob,
    dismissAllFinishedJobs,
    notifications,
    dismissNotification,
    isTrayHidden,
    setIsTrayHidden,
    autoHideWhenIdle,
    trayCorner,
    setTrayCorner,
    customCoordinates,
    setCustomCoordinates,
    resetTrayPosition,
  } = useImportQueueContext();

  const { currentPoem } = useAudioPlayerContext();
  const [isOpen, setIsOpen] = useState(false);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; startCoords: { x: number; y: number } } | null>(null);
  const [liveCoords, setLiveCoords] = useState<{ x: number; y: number } | null>(customCoordinates);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLiveCoords(customCoordinates);
  }, [customCoordinates]);

  const activeCount = jobs.filter((j) => j.status === "pending" || j.status === "processing").length;
  const finishedCount = jobs.filter((j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled").length;
  const sortedJobs = [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Cycle through corners: bottom-left -> bottom-right -> top-right -> top-left -> bottom-left
  const handleCycleCorner = () => {
    const cycle: Record<TrayCorner, TrayCorner> = {
      "bottom-left": "bottom-right",
      "bottom-right": "top-right",
      "top-right": "top-left",
      "top-left": "bottom-left",
    };
    setTrayCorner(cycle[trayCorner]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    isDraggingRef.current = false;

    const rect = containerRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : 16;
    const currentY = rect ? rect.top : window.innerHeight - 80;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startCoords: { x: currentX, y: currentY },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 6) {
      isDraggingRef.current = true;
      const nextX = Math.max(12, Math.min(window.innerWidth - 60, dragStartRef.current.startCoords.x + dx));
      const nextY = Math.max(12, Math.min(window.innerHeight - 60, dragStartRef.current.startCoords.y + dy));
      setLiveCoords({ x: nextX, y: nextY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const hadDrag = isDraggingRef.current;
    dragStartRef.current = null;
    if (hadDrag && liveCoords) {
      setCustomCoordinates(liveCoords);
    }
  };

  const handleClickToggle = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    setIsOpen((v) => !v);
  };

  // Determine whether the tray should be visible
  const shouldShowTray =
    jobs.length > 0 &&
    !isTrayHidden &&
    (!autoHideWhenIdle || activeCount > 0 || isOpen);

  // Position classes when not using custom dragged coordinates
  const getCornerClasses = () => {
    switch (trayCorner) {
      case "bottom-right":
        return currentPoem
          ? "bottom-28 md:bottom-20 right-4"
          : "bottom-24 md:bottom-6 right-4";
      case "top-left":
        return "top-4 left-4";
      case "top-right":
        return "top-4 right-4";
      case "bottom-left":
      default:
        return currentPoem
          ? "bottom-28 md:bottom-20 left-4"
          : "bottom-24 md:bottom-6 left-4";
    }
  };

  // Popup placement alignment relative to button
  const getPopupPlacementClasses = () => {
    if (liveCoords) {
      const isTopHalf = liveCoords.y < window.innerHeight / 2;
      const isRightHalf = liveCoords.x > window.innerWidth / 2;
      return `${isTopHalf ? "top-full mt-2" : "bottom-full mb-2"} ${isRightHalf ? "right-0" : "left-0"}`;
    }
    switch (trayCorner) {
      case "bottom-right":
        return "bottom-full mb-2 right-0";
      case "top-left":
        return "top-full mt-2 left-0";
      case "top-right":
        return "top-full mt-2 right-0";
      case "bottom-left":
      default:
        return "bottom-full mb-2 left-0";
    }
  };

  if (notifications.length === 0 && !shouldShowTray) {
    return null;
  }

  return (
    <>
      {/* Toast notifications: visible from any tab */}
      {notifications.length > 0 && (
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
      )}

      {/* Floating tray toggle */}
      {shouldShowTray && (
        <div
          ref={containerRef}
          className={`fixed z-[65] ${liveCoords ? "" : getCornerClasses()}`}
          style={liveCoords ? { left: `${liveCoords.x}px`, top: `${liveCoords.y}px` } : undefined}
        >
          {isOpen && (
            <div
              className={`absolute ${getPopupPlacementClasses()} w-[85vw] max-w-sm max-h-[60vh] overflow-y-auto bg-charcoal-850 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-3 space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-200`}
            >
              {/* Header with Title and Control Buttons */}
              <div className="flex items-center justify-between px-1 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-parchment-100 font-sans">طابور المعالجة في الخلفية</h4>
                  {activeCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-700/20 text-accent-700 font-bold">
                      {toArabicDigits(activeCount)} جارية
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {finishedCount > 0 && (
                    <button
                      onClick={dismissAllFinishedJobs}
                      className="p-1 rounded-lg hover:bg-white/10 text-ink-500 hover:text-parchment-100 transition-colors"
                      title="مسح جميع المهام المنتهية"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={handleCycleCorner}
                    className="p-1 rounded-lg hover:bg-white/10 text-ink-500 hover:text-parchment-100 transition-colors"
                    title="نقل الزاوية (تغيير الموضع)"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </button>

                  {liveCoords && (
                    <button
                      onClick={resetTrayPosition}
                      className="p-1 rounded-lg hover:bg-white/10 text-ink-500 hover:text-parchment-100 transition-colors"
                      title="إعادة ضبط الموضع"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsTrayHidden(true);
                      setIsOpen(false);
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 text-ink-500 hover:text-crimson-400 transition-colors"
                    title="إخفاء هذا الزر تماماً (يمكنك إعادة إظهاره من الإعدادات)"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-ink-500 hover:text-parchment-100 transition-colors"
                    title="إغلاق القائمة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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

          {/* Floating Bubble Button */}
          <div className="relative group">
            {/* Quick Hide Button (Top-Corner Badge) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsTrayHidden(true);
              }}
              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-charcoal-800 border border-white/20 text-ink-500 hover:text-crimson-400 hover:bg-charcoal-700 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10 shadow-md cursor-pointer"
              title="إخفاء طابور المعالجة (يمكنك إعادة تفعيله من الإعدادات)"
            >
              <X className="w-3 h-3" />
            </button>

            <button
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleClickToggle}
              className="relative w-12 h-12 rounded-full bg-charcoal-850 border border-white/10 shadow-2xl flex items-center justify-center text-accent-700 hover:bg-charcoal-800 transition-colors cursor-grab active:cursor-grabbing touch-none select-none"
              title="طابور المعالجة (يمكنك سحبه لتحريكه أو النقر عليه لفتحه)"
            >
              <ListChecks className={`w-5 h-5 pointer-events-none ${isProcessing ? "animate-pulse" : ""}`} />
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-700 text-charcoal-950 text-[10px] font-bold flex items-center justify-center ltr-num pointer-events-none">
                  {toArabicDigits(activeCount)}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
