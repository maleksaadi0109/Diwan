import React, { useRef, useState } from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { User, Music, Mic, Sparkles, X, Feather, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PoemMetadataDrawerProps {
  poem: Poem;
  isOpen: boolean;
  onToggle: () => void;
  onChangeCoverImage?: (coverImageUrl: string | null) => void | Promise<void>;
}

export const PoemMetadataDrawer: React.FC<PoemMetadataDrawerProps> = ({
  poem,
  isOpen,
  onToggle,
  onChangeCoverImage,
}) => {
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && onChangeCoverImage) {
        onChangeCoverImage(reader.result);
      }
      setIsEditingImage(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside className="absolute md:relative top-0 right-0 h-full w-full sm:w-80 md:w-80 lg:w-96 bg-charcoal-900 border-l border-white/5 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 select-none shadow-xl z-30 transform transition-transform duration-300 pb-20 md:pb-6">
      <button 
        onClick={onToggle}
        className="absolute top-4 left-4 p-2 rounded-xl text-ink-500 hover:text-parchment-100 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
        title="إغلاق البيانات"
      >
        <X className="w-5 h-5" strokeWidth={2.5} />
      </button>

      {/* Cover Image Section */}
      {onChangeCoverImage && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
            <ImageIcon className="w-4 h-4" />
            <span>صورة القصيدة</span>
          </div>

          <div className="relative group bg-charcoal-850 border border-white/5 rounded-2xl overflow-hidden shadow-sm h-40 flex items-center justify-center">
            {poem.coverImageUrl ? (
              <img src={poem.coverImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-ink-600 text-xs font-bold font-sans">لا توجد صورة بعد</span>
            )}
            <div className="absolute inset-0 bg-charcoal-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditingImage((v) => !v)}
                className="p-2.5 rounded-xl bg-white/10 text-parchment-100 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
                title="تغيير الصورة"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {poem.coverImageUrl && (
                <button
                  type="button"
                  onClick={() => onChangeCoverImage(null)}
                  className="p-2.5 rounded-xl bg-crimson-500/20 text-crimson-400 hover:bg-crimson-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-500"
                  title="إزالة الصورة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {isEditingImage && (
            <div className="space-y-3 bg-charcoal-850 border border-white/5 p-4 rounded-2xl animate-fade-in">
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="رابط الصورة (URL)"
                  dir="ltr"
                  className="flex-1 min-w-0 bg-charcoal-950/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-sans focus:outline-none focus:border-accent-700 text-parchment-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = imageUrlInput.trim();
                    if (trimmed) {
                      onChangeCoverImage(trimmed);
                      setImageUrlInput("");
                      setIsEditingImage(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-accent-700 text-charcoal-950 rounded-xl hover:bg-accent-600 transition-colors shrink-0"
                >
                  حفظ
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-500 font-sans justify-center">
                <span>أو</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-bold text-accent-700 hover:text-accent-500 transition-colors"
                >
                  اختر صورة من جهازك
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Poet Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
          <Feather className="w-4 h-4" />
          <span>عن الشاعر</span>
        </div>
        <div className="bg-charcoal-850 p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden">
          <h4 className="font-heading text-2xl font-bold text-parchment-100 leading-tight">
            {poem.poet.name}
          </h4>
          <div className="flex items-center gap-2 mt-3 mb-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent-700/10 text-accent-500 border border-accent-700/20">
              العصر ال{poem.poet.era}
            </span>
            {poem.poet.birthYear && (
              <span className="text-[11px] text-ink-500 font-sans font-bold tracking-wide border-r border-white/10 pr-2">
                {poem.poet.birthYear}
              </span>
            )}
          </div>
          {poem.poet.bio && (
            <p className="text-[13px] text-ink-500 leading-loose mt-3 font-sans border-t border-white/5 pt-3">
              {poem.poet.bio}
            </p>
          )}
        </div>
      </div>

      {/* Meter & Rhyme Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
          <Music className="w-4 h-4" />
          <span>العروض والوزن</span>
        </div>
        <div className="bg-charcoal-850 p-5 rounded-2xl border border-white/5 shadow-sm space-y-4 font-sans">
          <div>
            <span className="text-[11px] font-bold text-ink-600 block mb-1">بحر القصيدة</span>
            <span className="text-base font-bold text-parchment-100 font-heading">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="pt-3 border-t border-white/5">
            <span className="text-[11px] font-bold text-ink-600 block mb-1">القافية والرويّ</span>
            <span className="text-base font-bold text-parchment-100 font-heading">
              {poem.rhyme}
            </span>
          </div>

          <div className="pt-3 border-t border-white/5">
            <span className="text-[11px] font-bold text-ink-600 block mb-1">عدد الأبيات</span>
            <span className="text-sm font-bold text-parchment-100 flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono">{toArabicDigits(poem.versesCount)}</span>
              <span className="text-xs text-ink-500">أبيات</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recordings Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
          <Mic className="w-4 h-4" />
          <span>التسجيل والمحاذاة</span>
        </div>
        <div className="bg-charcoal-850 p-5 rounded-2xl border border-white/5 shadow-sm space-y-4 font-sans">
          {poem.recordings.length > 0 ? (
            poem.recordings.map((rec) => (
              <div key={rec.id} className="space-y-2 border-b border-white/5 last:border-0 pb-3 last:pb-0">
                <p className="font-bold text-parchment-100 text-sm leading-relaxed">{rec.title}</p>
                <p className="text-ink-600 text-xs font-medium">بصوت: <span className="text-ink-400 font-bold">{rec.reciter}</span></p>
                <div className="mt-2">
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    محاذاة كاملة
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs font-medium text-ink-600 text-center py-4 border border-dashed border-white/10 rounded-xl">
              <p>لا يوجد تسجيل صوتي مرتبط بعد.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {poem.tags.length > 0 && (
        <div className="space-y-3 pb-4">
          <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
            <Sparkles className="w-4 h-4" />
            <span>تصنيفات الموضوع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {poem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-3 py-1 rounded-full bg-charcoal-850 text-ink-500 border border-white/5 font-bold font-sans hover:bg-white/5 hover:text-parchment-100 transition-colors cursor-default"
              >
                # {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
