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

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== playlist.name) {
      onRenamePlaylist(trimmed);
    }
    setIsRenaming(false);
  };

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    <div className="h-full flex flex-col overflow-y-auto px-8 md:px-14 py-10 max-w-5xl mx-auto w-full scroll-smooth select-none text-[#F8F9FA]">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-[#A0AAB7] hover:text-[#F8F9FA] mb-6 self-start px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-xl transition-all cursor-pointer w-fit"
      >
        <ChevronRight className="w-4 h-4 text-[#D4AF37]" strokeWidth={2.5} />
        <span>كل قوائم التشغيل</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8 bg-[#14171E]/90 border border-white/[0.08] rounded-3xl p-6 shadow-xl">
        <div className="w-20 h-20 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center shrink-0">
          <ListMusic className="w-9 h-9 text-[#D4AF37]" />
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
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xl font-poetry font-bold text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]/50"
              />
              <button onClick={commitRename} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer">
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsRenaming(false);
                  setRenameValue(playlist.name);
                }}
                className="p-2 text-[#6C7A8C] hover:bg-white/5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h2 className="text-3xl font-poetry font-bold text-[#F8F9FA] flex items-center gap-2.5 truncate group">
              <span className="truncate">{playlist.name}</span>
              <button
                onClick={() => setIsRenaming(true)}
                className="opacity-0 group-hover:opacity-100 text-[#6C7A8C] hover:text-[#D4AF37] p-1 rounded-lg transition-all cursor-pointer"
                title="إعادة تسمية القائمة"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </h2>
          )}
          <p className="text-xs text-[#A0AAB7] mt-1.5 font-sans">
            {toArabicDigits(poems.length)} قصائد
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleShuffle}
            title="تشغيل عشوائي"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              shuffle
                ? "bg-[#D4AF37]/15 text-[#F3E19C] border-[#D4AF37]/40"
                : "text-[#A0AAB7] border-white/10 hover:text-[#F8F9FA] hover:bg-white/[0.05]"
            }`}
          >
            <Shuffle className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onCycleRepeatMode}
            title={repeatMode === "off" ? "تكرار: متوقف" : repeatMode === "all" ? "تكرار: القائمة كاملة" : "تكرار: القصيدة الحالية"}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              repeatMode !== "off"
                ? "bg-[#D4AF37]/15 text-[#F3E19C] border-[#D4AF37]/40"
                : "text-[#A0AAB7] border-white/10 hover:text-[#F8F9FA] hover:bg-white/[0.05]"
            }`}
          >
            <RepeatIcon className="w-4.5 h-4.5" />
          </button>
          {poems.length > 0 && (
            <button
              onClick={() => (isPlayingThisPlaylist ? onTogglePlay() : onPlayFromIndex(0))}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#B89225] via-[#D4AF37] to-[#F3E19C] hover:from-[#C9A233] hover:to-[#FFF0B3] text-[#0A0C10] shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer border border-[#FFF0B3]/40"
              title={isPlayingThisPlaylist && isPlaying ? "إيقاف مؤقت" : "تشغيل القائمة"}
            >
              {isPlayingThisPlaylist && isPlaying ? (
                <Pause className="w-6 h-6 fill-current text-[#0A0C10]" />
              ) : (
                <Play className="w-6 h-6 fill-current text-[#0A0C10] ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Poems list */}
      {poems.length > 0 ? (
        <div className="flex flex-col gap-2 pb-20">
          {poems.map((poem, index) => {
            const isCurrent = currentPoemId === poem.id;
            return (
              <div
                key={poem.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                className={`group flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                  isCurrent
                    ? "bg-[#D4AF37]/10 border-[#D4AF37]/40"
                    : "bg-[#14171E]/80 border-white/[0.06] hover:border-white/15"
                } ${dragOverIndex === index && dragIndex !== null && dragIndex !== index ? "border-dashed border-[#D4AF37]/60" : ""}`}
              >
                <span
                  className="cursor-grab active:cursor-grabbing text-[#6C7A8C] hover:text-[#A0AAB7] p-1 shrink-0"
                  title="اسحب لإعادة الترتيب"
                >
                  <GripVertical className="w-4 h-4" />
                </span>

                <button
                  onClick={() => onPlayFromIndex(index)}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-[#D4AF37]/15 flex items-center justify-center shrink-0 text-[#A0AAB7] hover:text-[#D4AF37] transition-all cursor-pointer"
                  title="تشغيل من هذه القصيدة"
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                {poem.coverImageUrl ? (
                  <img
                    src={poem.coverImageUrl}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <span className="w-6 text-center text-xs font-mono text-[#6C7A8C] shrink-0">
                    {toArabicDigits(index + 1)}
                  </span>
                )}

                <div className="flex-1 min-w-0 text-right">
                  <p className={`text-sm font-bold truncate font-poetry ${isCurrent ? "text-[#F3E19C]" : "text-[#F8F9FA]"}`}>
                    {poem.title}
                  </p>
                  <p className="text-[11px] text-[#A0AAB7] truncate">{poem.poet.name}</p>
                </div>

                <button
                  onClick={() => onRemovePoem(poem.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-[#6C7A8C] hover:text-rose-400 hover:bg-rose-500/15 transition-all cursor-pointer shrink-0"
                  title="إزالة من القائمة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-[#14171E]/60 border border-white/[0.08] rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5 text-[#D4AF37] rounded-2xl shadow-inner">
            <ListMusic className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-poetry font-bold text-[#F8F9FA] mb-2">القائمة فارغة</h3>
          <p className="text-xs text-[#A0AAB7] max-w-md leading-relaxed font-sans">
            اذهب إلى المكتبة واضغط على أيقونة "إضافة إلى قائمة تشغيل" في أي قصيدة لإضافتها هنا.
          </p>
        </div>
      )}
    </div>
  );
};
