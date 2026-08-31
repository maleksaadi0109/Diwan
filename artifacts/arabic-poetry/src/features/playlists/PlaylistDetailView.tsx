import React, { useState } from "react";
import { Playlist, Poem, RepeatMode } from "@/types";
import {
  ChevronRight,
  Play,
  Pause,
  ListMusic,
  Trash2,
  GripVertical,
  Shuffle,
  Repeat,
  Repeat1,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PlaylistDetailViewProps {
  playlist: Playlist;
  poems: Poem[]; // hydrated, already ordered per playlist.poemIds
  isPlayingThisPlaylist: boolean;
  isPlaying: boolean;
  currentPoemId?: string | null;
  shuffle: boolean;
  repeatMode: RepeatMode;
  onBack: () => void;
  onPlayFromIndex: (index: number) => void;
  onTogglePlay: () => void;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  onRemovePoem: (poemId: string) => void;
  onReorder: (orderedPoemIds: string[]) => void;
  onRenamePlaylist: (name: string) => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  poems,
  isPlayingThisPlaylist,
  isPlaying,
  currentPoemId,
  shuffle,
  repeatMode,
  onBack,
  onPlayFromIndex,
  onTogglePlay,
  onToggleShuffle,
  onCycleRepeatMode,
  onRemovePoem,
  onReorder,
  onRenamePlaylist,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(playlist.name);

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...poems];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorder(reordered.map((p) => p.id));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Pointer-based reordering. Native HTML5 drag-and-drop (draggable +
  // onDragStart/onDragOver/onDrop) is unreliable inside Tauri's WebKitGTK
  // desktop webview, so the grip handle drives a manual drag using the
  // Pointer Events API instead (works identically for mouse and touch).
  const handleGripPointerDown = (index: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
    setDragOverIndex(index);
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (dragIndex === null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const row = target?.closest<HTMLElement>("[data-playlist-row]");
    if (row) {
      const idx = Number(row.dataset.playlistRow);
      if (!Number.isNaN(idx)) setDragOverIndex(idx);
    }
  };

  const endGripDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (dragIndex === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragOverIndex !== null) {
      handleDrop(dragOverIndex);
    } else {
      setDragIndex(null);
      setDragOverIndex(null);
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== playlist.name) {
      onRenamePlaylist(trimmed);
    }
    setIsRenaming(false);
  };

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 md:px-14 py-8 md:py-10 max-w-5xl mx-auto w-full scroll-smooth select-none text-parchment-100 animate-fade-in pb-24 md:pb-12">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-ink-500 hover:text-parchment-100 mb-6 self-start px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
      >
        <ChevronRight className="w-4 h-4 text-accent-700" strokeWidth={2.5} />
        <span>كل قوائم التشغيل</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8 bg-charcoal-850/90 border border-white/5 rounded-3xl p-6 shadow-md backdrop-blur-sm">
        <div className="w-20 h-20 rounded-2xl bg-accent-700/10 border border-accent-700/20 flex items-center justify-center shrink-0">
          <ListMusic className="w-9 h-9 text-accent-700" />
        </div>

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setIsRenaming(false);
                    setRenameValue(playlist.name);
                  }
                }}
                className="flex-1 bg-charcoal-950/50 border border-white/10 rounded-xl px-3.5 py-2 text-xl font-poetry font-bold text-parchment-100 focus:outline-none focus:border-accent-700"
              />
              <button onClick={commitRename} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsRenaming(false);
                  setRenameValue(playlist.name);
                }}
                className="p-2 text-ink-500 hover:bg-white/5 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h2 className="text-3xl font-poetry font-bold text-parchment-100 flex items-center gap-2.5 group">
              <span className="truncate">{playlist.name}</span>
              <button
                onClick={() => setIsRenaming(true)}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-ink-500 hover:text-accent-500 p-1 rounded-lg transition-all cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
                title="إعادة تسمية القائمة"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </h2>
          )}
          <p className="text-xs text-ink-500 mt-1.5 font-sans">
            {toArabicDigits(poems.length)} قصائد
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleShuffle}
            title="تشغيل عشوائي"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
              shuffle
                ? "bg-accent-700/15 text-accent-500 border-accent-700/40"
                : "text-ink-500 border-white/10 hover:text-parchment-100 hover:bg-white/5"
            }`}
          >
            <Shuffle className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onCycleRepeatMode}
            title={repeatMode === "off" ? "تكرار: متوقف" : repeatMode === "all" ? "تكرار: القائمة كاملة" : "تكرار: القصيدة الحالية"}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
              repeatMode !== "off"
                ? "bg-accent-700/15 text-accent-500 border-accent-700/40"
                : "text-ink-500 border-white/10 hover:text-parchment-100 hover:bg-white/5"
            }`}
          >
            <RepeatIcon className="w-4.5 h-4.5" />
          </button>
          {poems.length > 0 && (
            <button
              onClick={() => (isPlayingThisPlaylist ? onTogglePlay() : onPlayFromIndex(0))}
              className="w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-accent-700 hover:bg-accent-600 text-charcoal-950 shadow-lg shadow-accent-700/20 transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700"
              title={isPlayingThisPlaylist && isPlaying ? "إيقاف مؤقت" : "تشغيل القائمة"}
            >
              {isPlayingThisPlaylist && isPlaying ? (
                <Pause className="w-5 h-5 md:w-6 md:h-6 fill-current" />
              ) : (
                <Play className="w-5 h-5 md:w-6 md:h-6 fill-current ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Poems list */}
      {poems.length > 0 ? (
        <div className="flex flex-col gap-2 relative">
          {poems.map((poem, index) => {
            const isCurrent = currentPoemId === poem.id;
            return (
              <div
                key={poem.id}
                data-playlist-row={index}
                className={`group flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl border transition-all ${
                  isCurrent
                    ? "bg-accent-700/10 border-accent-700/40 shadow-sm"
                    : "bg-charcoal-850/80 border-white/5 hover:border-white/10 hover:bg-charcoal-800"
                } ${dragIndex === index ? "opacity-60" : ""} ${dragOverIndex === index && dragIndex !== null && dragIndex !== index ? "border-dashed border-accent-700/60 bg-accent-700/5" : ""}`}
              >
                <span
                  onPointerDown={handleGripPointerDown(index)}
                  onPointerMove={handleGripPointerMove}
                  onPointerUp={endGripDrag}
                  onPointerCancel={endGripDrag}
                  className="touch-none cursor-grab active:cursor-grabbing text-ink-600 hover:text-ink-400 p-1.5 -m-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                  title="اسحب لإعادة الترتيب"
                >
                  <GripVertical className="w-4 h-4" />
                </span>

                <button
                  onClick={() => onPlayFromIndex(index)}
                  className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
                    isCurrent ? "bg-accent-700/20 text-accent-500" : "bg-white/5 hover:bg-accent-700/15 text-ink-500 hover:text-accent-500"
                  }`}
                  title="تشغيل من هذه القصيدة"
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>

                {poem.coverImageUrl ? (
                  <img
                    src={poem.coverImageUrl}
                    alt=""
                    className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-cover border border-white/10 shrink-0 shadow-sm"
                  />
                ) : (
                  <span className="w-6 text-center text-xs font-mono text-ink-600 shrink-0">
                    {toArabicDigits(index + 1)}
                  </span>
                )}

                <div className="flex-1 min-w-0 text-right">
                  <p className={`text-sm md:text-base font-bold truncate font-poetry ${isCurrent ? "text-accent-500" : "text-parchment-100"}`}>
                    {poem.title}
                  </p>
                  <p className="text-[10px] md:text-[11px] text-ink-500 truncate">{poem.poet.name}</p>
                </div>

                <button
                  onClick={() => onRemovePoem(poem.id)}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 rounded-lg text-ink-600 hover:text-crimson-400 hover:bg-crimson-500/10 transition-all cursor-pointer shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-500"
                  title="إزالة من القائمة"
                >
                  <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-charcoal-850/50 border border-white/5 rounded-3xl shadow-sm mt-4">
          <div className="w-16 h-16 bg-charcoal-800 border border-white/5 flex items-center justify-center mb-5 text-accent-700 rounded-2xl shadow-inner">
            <ListMusic className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl md:text-2xl font-poetry font-bold text-parchment-100 mb-2">القائمة فارغة</h3>
          <p className="text-xs md:text-sm text-ink-500 max-w-md leading-relaxed font-sans">
            اذهب إلى المكتبة واضغط على أيقونة "إضافة إلى قائمة تشغيل" في أي قصيدة لإضافتها هنا.
          </p>
        </div>
      )}
    </div>
  );
};
