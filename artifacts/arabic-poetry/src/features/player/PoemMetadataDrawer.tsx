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
    <aside className="w-80 bg-paper-100 border-r border-paper-400 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 select-none relative shadow-sm">
      <button 
        onClick={onToggle}
        className="absolute top-4 left-4 p-2 rounded-none text-ink-600 hover:text-ink-900 hover:bg-paper-200 transition-colors"
        title="إغلاق البيانات"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>

      {/* Cover Image Section */}
      {onChangeCoverImage && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
            <ImageIcon className="w-4 h-4" />
            <span>صورة القصيدة</span>
          </div>

          <div className="relative group bg-paper-200 border border-paper-400 rounded-none overflow-hidden shadow-sm h-36 flex items-center justify-center">
            {poem.coverImageUrl ? (
              <img src={poem.coverImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-ink-500 text-xs font-bold">لا توجد صورة بعد</span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingImage((v) => !v)}
                className="p-2 rounded-full bg-white/90 text-ink-900 hover:bg-white transition-colors"
                title="تغيير الصورة"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {poem.coverImageUrl && (
                <button
                  type="button"
                  onClick={() => onChangeCoverImage(null)}
                  className="p-2 rounded-full bg-white/90 text-rose-600 hover:bg-white transition-colors"
                  title="إزالة الصورة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {isEditingImage && (
            <div className="space-y-2 bg-paper-200 border border-paper-400 p-3 rounded-none">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="رابط الصورة (URL)"
                  dir="ltr"
                  className="flex-1 min-w-0 bg-white/80 border border-paper-400 rounded-none px-3 py-2 text-xs font-ui focus:outline-none focus:border-accent-700"
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
                  className="px-3 py-2 text-xs font-bold bg-accent-700 text-white rounded-none hover:bg-accent-800 transition-colors shrink-0"
                >
                  حفظ
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-600">
                <span>أو</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="underline font-bold text-accent-700 hover:text-accent-900"
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
        <div className="bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm relative overflow-hidden">
          <h4 className="font-heading text-3xl font-bold text-ink-900 leading-tight">
            {poem.poet.name}
          </h4>
          <div className="flex items-center gap-2 mt-3 mb-3">
            <Badge variant="charcoal" size="sm">
              العصر ال{poem.poet.era}
            </Badge>
            {poem.poet.birthYear && (
              <span className="text-[13px] text-ink-700 font-ui font-bold tracking-wide border-r border-paper-400 pr-2">
                {poem.poet.birthYear}
              </span>
            )}
          </div>
          {poem.poet.bio && (
            <p className="text-[14px] text-ink-800 leading-[2] mt-3 font-ui border-t border-paper-400 pt-3">
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
        <div className="bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm space-y-4 font-ui">
          <div>
            <span className="text-[12px] font-bold text-ink-600 block mb-1">بحر القصيدة</span>
            <span className="text-[18px] font-bold text-ink-900 font-heading">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="pt-3 border-t border-paper-400">
            <span className="text-[12px] font-bold text-ink-600 block mb-1">القافية والرويّ</span>
            <span className="text-[18px] font-bold text-ink-900 font-heading">
              {poem.rhyme}
            </span>
          </div>

          <div className="pt-3 border-t border-paper-400">
            <span className="text-[12px] font-bold text-ink-600 block mb-1">عدد الأبيات</span>
            <span className="text-sm font-bold text-ink-900 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">{toArabicDigits(poem.versesCount)}</span>
              <span className="text-sm text-ink-700">أبيات</span>
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
        <div className="bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm space-y-3 font-ui">
          {poem.recordings.length > 0 ? (
            poem.recordings.map((rec) => (
              <div key={rec.id} className="space-y-1.5 border-b border-paper-400 last:border-0 pb-3 last:pb-0">
                <p className="font-bold text-ink-900 text-[15px]">{rec.title}</p>
                <p className="text-ink-600 text-[13px] font-bold">بصوت: <span className="text-ink-900">{rec.reciter}</span></p>
                <div className="mt-2">
                  <Badge variant="success" size="sm" className="text-[11px]">
                    محاذاة كاملة
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[13px] font-bold text-ink-500 text-center py-2 border border-dashed border-paper-400 p-3">
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
                className="text-[12px] px-3 py-1 rounded-none bg-transparent text-ink-800 border border-paper-400 font-bold font-ui hover:bg-paper-200 transition-colors cursor-default"
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
