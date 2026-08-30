import React, { useState } from "react";
import { Playlist, Poem } from "@/types";
import { X, ListMusic, Check, Plus } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface AddToPlaylistModalProps {
  poems: Poem[];
  playlists: Playlist[];
  onClose: () => void;
  onAddToExisting: (playlistId: string) => void;
  onCreateAndAdd: (name: string) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  poems,
  playlists,
  onClose,
  onAddToExisting,
  onCreateAndAdd,
}) => {
  const isBulk = poems.length > 1;
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(playlists.length === 0);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateAndAdd(trimmed);
    setNewName("");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#14171E] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h3 className="text-sm font-bold text-[#F8F9FA]">إضافة إلى قائمة تشغيل</h3>
              <p className="text-[11px] text-[#A0AAB7] truncate max-w-[260px]">
                {isBulk ? `${toArabicDigits(poems.length)} قصائد محددة` : poems[0]?.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6C7A8C] hover:text-[#F8F9FA] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-3">
          {playlists.length === 0 && (
            <p className="text-xs text-[#A0AAB7] text-center py-6 px-4">
              لا توجد قوائم تشغيل بعد. أنشئ أول قائمة لك بالأسفل.
            </p>
          )}

          {playlists.map((playlist) => {
            const alreadyIn = poems.every((p) => playlist.poemIds.includes(p.id));
            return (
              <button
                key={playlist.id}
                type="button"
                disabled={alreadyIn}
                onClick={() => onAddToExisting(playlist.id)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-right transition-all mb-1 ${
                  alreadyIn
                    ? "opacity-50 cursor-not-allowed bg-white/[0.02]"
                    : "hover:bg-white/[0.06] cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center shrink-0">
                    <ListMusic className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-sm font-bold text-[#F8F9FA] truncate">{playlist.name}</p>
                    <p className="text-[11px] text-[#A0AAB7]">
                      {toArabicDigits(playlist.poemIds.length)} قصائد
                    </p>
                  </div>
                </div>
                {alreadyIn && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20">
          {isCreating ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setIsCreating(playlists.length === 0);
                }}
                placeholder="اسم القائمة الجديدة..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F8F9FA] placeholder:text-[#6C7A8C] focus:outline-none focus:border-[#D4AF37]/50"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B89225] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0C10] font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                إنشاء وإضافة
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-white/15 hover:border-[#D4AF37]/40 text-[#A0AAB7] hover:text-[#D4AF37] text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>قائمة تشغيل جديدة</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
