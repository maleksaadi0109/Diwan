import React, { useState } from "react";
import { Playlist } from "@/types";
import { ListMusic, Plus, Trash2, ChevronLeft, Sparkles, AlertTriangle, X } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PlaylistsViewProps {
  playlists: Playlist[];
  onOpenPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  playlists,
  onOpenPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreatePlaylist(trimmed);
    setNewName("");
    setIsCreating(false);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto px-8 md:px-14 py-10 max-w-7xl mx-auto w-full scroll-smooth select-none text-[#F8F9FA]">
      {/* Hero / Header Section */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5 font-sans bg-[#D4AF37]/10 px-3 py-1 rounded-xl border border-[#D4AF37]/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]">
              <ListMusic className="w-3.5 h-3.5" />
              <span>مجموعاتك المختارة من القصائد</span>
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-poetry font-bold text-[#F8F9FA] tracking-wide mt-2 flex items-center gap-3">
            <span>قوائم التشغيل</span>
            <Sparkles className="w-6 h-6 text-[#D4AF37]" />
          </h2>
          <p className="text-xs md:text-sm text-[#A0AAB7] mt-2 font-sans">
            أنشئ قوائم تشغيل خاصة بك، رتّبها كما تحب، وشغّلها بالتتابع أو عشوائيًا
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] text-[#0A0C10] font-bold font-sans text-xs transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] rounded-2xl flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>قائمة تشغيل جديدة</span>
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-8 flex items-center gap-2 bg-[#14171E]/90 p-3 rounded-2xl border border-white/[0.08] shadow-xl">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewName("");
              }
            }}
            placeholder="اسم قائمة التشغيل..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F8F9FA] placeholder:text-[#6C7A8C] focus:outline-none focus:border-[#D4AF37]/50"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B89225] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0C10] font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            إنشاء
          </button>
          <button
            onClick={() => {
              setIsCreating(false);
              setNewName("");
            }}
            className="px-3 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-[#CED4DA] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      )}

      {playlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => onOpenPlaylist(playlist)}
              className="group bg-[#14171E]/90 hover:bg-[#181C25] border border-white/[0.08] hover:border-[#D4AF37]/50 rounded-3xl p-6 cursor-pointer transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] flex flex-col justify-between relative backdrop-blur-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center">
                    <ListMusic className="w-5.5 h-5.5 text-[#D4AF37]" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(playlist.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl text-[#6C7A8C] hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                    title="حذف قائمة التشغيل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-poetry text-xl md:text-2xl font-bold text-[#F8F9FA] group-hover:text-[#F3E19C] transition-colors mb-1.5 line-clamp-1">
                  {playlist.name}
                </h3>
                <p className="text-xs font-medium text-[#A0AAB7] font-sans">
                  {toArabicDigits(playlist.poemIds.length)} قصائد
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-end text-xs text-[#A0AAB7] font-sans">
                <span className="flex items-center gap-1.5 text-[#D4AF37] font-bold">
                  <span>فتح</span>
                  <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                </span>
              </div>

              {confirmDeleteId === playlist.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-10 bg-[#0E1015]/95 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between animate-in fade-in duration-200 border border-rose-500/40 shadow-2xl"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-bold text-sm">تأكيد حذف القائمة</span>
                    </div>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[#6C7A8C] hover:text-[#F8F9FA] p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[#CED4DA] leading-relaxed my-3 font-sans">
                    هل تريد حذف قائمة <strong className="text-[#F8F9FA]">"{playlist.name}"</strong>؟ لن يتم حذف القصائد نفسها من الديوان.
                  </p>
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-[#CED4DA] transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => {
                        onDeletePlaylist(playlist.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-[#F8F9FA] text-xs font-bold transition-all shadow-[0_0_12px_rgba(225,29,72,0.4)] flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف نهائي</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !isCreating && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-[#14171E]/60 border border-white/[0.08] rounded-3xl shadow-xl">
            <div className="w-16 h-16 bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5 text-[#D4AF37] rounded-2xl shadow-inner">
              <ListMusic className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-poetry font-bold text-[#F8F9FA] mb-2">لا توجد قوائم تشغيل بعد</h3>
            <p className="text-xs text-[#A0AAB7] max-w-md mb-6 leading-relaxed font-sans">
              أنشئ أول قائمة تشغيل لك، ثم أضف إليها القصائد المفضلة من المكتبة.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B89225] text-[#0A0C10] font-bold font-sans text-xs transition-colors rounded-xl cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إنشاء قائمة تشغيل</span>
            </button>
          </div>
        )
      )}
    </div>
  );
};
