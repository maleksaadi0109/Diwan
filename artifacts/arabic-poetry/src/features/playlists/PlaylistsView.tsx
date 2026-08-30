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
    <div className="h-full flex flex-col overflow-y-auto px-4 md:px-14 py-8 md:py-10 max-w-7xl mx-auto w-full scroll-smooth select-none pb-24 md:pb-12 text-parchment-100">
      {/* Hero / Header Section */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-accent-700 flex items-center gap-1.5 font-sans bg-accent-700/10 px-3 py-1 rounded-full border border-accent-700/20 shadow-md shadow-accent-700/10">
              <ListMusic className="w-3.5 h-3.5" />
              <span>مجموعاتك المختارة من القصائد</span>
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-poetry font-bold text-parchment-100 tracking-wide mt-2 flex items-center gap-3">
            <span>قوائم التشغيل</span>
            <Sparkles className="w-6 h-6 text-accent-700" />
          </h2>
          <p className="text-sm text-ink-500 mt-2 font-sans max-w-lg">
            أنشئ قوائم تشغيل خاصة بك، رتّبها كما تحب، وشغّلها بالتتابع أو عشوائيًا
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold font-sans text-xs transition-all shadow-lg shadow-accent-700/20 rounded-xl flex items-center justify-center gap-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>قائمة تشغيل جديدة</span>
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-8 flex flex-col md:flex-row md:items-center gap-3 bg-charcoal-850 p-4 rounded-2xl border border-white/5 shadow-md animate-fade-in">
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
            className="flex-1 bg-charcoal-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none focus:border-accent-700 transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 md:flex-none px-6 py-2.5 bg-accent-700 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-950 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            >
              إنشاء
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewName("");
              }}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-ink-500 hover:text-parchment-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {playlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 animate-fade-in">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="group bg-charcoal-850 hover:bg-charcoal-800 border border-white/5 hover:border-accent-700/30 rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl flex flex-col relative backdrop-blur-xl"
            >
              {/* Standalone delete button -- a sibling of the open button below,
                  never nested inside it, so it stays independently focusable
                  and keyboard-activatable without also opening the playlist. */}
              <button
                type="button"
                onClick={() => setConfirmDeleteId(playlist.id)}
                className="absolute top-6 end-6 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 rounded-xl text-ink-500 hover:text-crimson-400 hover:bg-crimson-500/10 border border-transparent transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crimson-500 focus-visible:outline-none bg-charcoal-850"
                title="حذف قائمة التشغيل"
                aria-label="حذف قائمة التشغيل"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onOpenPlaylist(playlist)}
                className="flex-1 flex flex-col justify-between text-start p-6 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 rounded-3xl"
                aria-label={`قائمة تشغيل ${playlist.name}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4 pe-10">
                    <div className="w-12 h-12 rounded-2xl bg-accent-700/10 border border-accent-700/20 flex items-center justify-center">
                      <ListMusic className="w-5.5 h-5.5 text-accent-700" />
                    </div>
                  </div>
                  <h3 className="font-poetry text-xl md:text-2xl font-bold text-parchment-100 group-hover:text-accent-400 transition-colors mb-2 line-clamp-1">
                    {playlist.name}
                  </h3>
                  <p className="text-xs font-medium text-ink-500 font-sans">
                    {toArabicDigits(playlist.poemIds.length)} قصائد
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-end text-xs font-sans">
                  <span className="flex items-center gap-1.5 text-accent-600 font-bold group-hover:text-accent-500 transition-colors">
                    <span>فتح</span>
                    <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                  </span>
                </div>
              </button>

              {confirmDeleteId === playlist.id && (
                <div className="absolute inset-0 z-20 bg-charcoal-900/95 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between animate-fade-in border border-crimson-500/30 shadow-2xl cursor-default">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-crimson-500">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-bold text-sm">تأكيد الحذف</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setConfirmDeleteId(null)} 
                      className="text-ink-500 hover:text-parchment-100 p-1.5 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-ink-500 leading-relaxed my-3 font-sans">
                    هل تريد حذف قائمة <strong className="text-parchment-100">"{playlist.name}"</strong>؟ لن يتم حذف القصائد نفسها من الديوان.
                  </p>
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-ink-500 hover:text-parchment-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeletePlaylist(playlist.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold transition-all shadow-md shadow-crimson-600/20 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-500"
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 md:p-16 bg-charcoal-850/50 border border-white/5 rounded-3xl shadow-sm animate-fade-in">
            <div className="w-16 h-16 bg-charcoal-800 border border-white/5 flex items-center justify-center mb-5 text-accent-700 rounded-2xl shadow-inner">
              <ListMusic className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-poetry font-bold text-parchment-100 mb-2">لا توجد قوائم تشغيل بعد</h3>
            <p className="text-sm text-ink-500 max-w-md mb-6 leading-relaxed font-sans">
              أنشئ أول قائمة تشغيل لك، ثم أضف إليها القصائد المفضلة من المكتبة.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-2.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold font-sans text-xs transition-colors rounded-xl cursor-pointer flex items-center gap-2 shadow-lg shadow-accent-700/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700"
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
