import React, { useState } from "react";
import { Type, Cpu, ShieldCheck, Database, Trash2, AlertTriangle, Headphones, Radio } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

interface SettingsViewProps {
  poemsCount?: number;
  onDeleteAllPoems?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  poemsCount = 0,
  onDeleteAllPoems,
}) => {
  const {
    closeToTray,
    setCloseToTray,
    mediaSessionEnabled,
    setMediaSessionEnabled,
  } = useAudioPlayerContext();

  const [poetryFontSize, setPoetryFontSize] = useState("24px");
  const [asrModel, setAsrModel] = useState("small");
  const [computeDevice, setComputeDevice] = useState("cpu");
  const [autoScroll, setAutoScroll] = useState(true);

  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleExecuteDeleteAll = async () => {
    if (!onDeleteAllPoems) return;
    setIsDeletingAll(true);
    try {
      await onDeleteAllPoems();
      setShowConfirmDeleteAll(false);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 md:px-12 py-8 md:py-10 max-w-4xl mx-auto w-full select-none space-y-10 animate-fade-in scroll-smooth pb-24 md:pb-12">
      <div className="border-b border-white/5 pb-6">
        <h2 className="text-4xl md:text-5xl font-bold text-parchment-100 font-heading">
          إعدادات ديوان
        </h2>
        <p className="text-sm text-ink-500 mt-3 font-sans">
          تخصيص الخطوط والتشغيل في الخلفية ومعالج الصوتيات وإدارة بيانات المكتبة
        </p>
      </div>

      {/* Background Playback & System Tray (Like Telegram) */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Headphones className="w-5 h-5" />
          <span>التشغيل في الخلفية وشريط النظام (مثل تيليجرام)</span>
        </div>

        <div className="space-y-4 font-sans">
          {/* Close to Tray Toggle */}
          <div className="p-5 bg-charcoal-900 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-accent-500" />
                <h4 className="text-sm font-bold text-parchment-100">
                  التشغيل في الخلفية عند إغلاق النافذة (Close to Tray)
                </h4>
              </div>
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                عند النقر على زر الإغلاق (✕)، يستمر الصوت في العمل ويتم تصغير التطبيق إلى شريط النظام (System Tray) بدلاً من إيقافه.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCloseToTray(!closeToTray)}
              className={`px-5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                closeToTray
                  ? "bg-accent-700 text-charcoal-950 border-accent-700 shadow-md shadow-accent-700/20"
                  : "bg-white/5 text-ink-500 border-white/10 hover:text-parchment-100 hover:bg-white/10"
              }`}
            >
              <span>{closeToTray ? "مفعل (في الخلفية)" : "معطل (إغلاق كلي)"}</span>
            </button>
          </div>

          {/* Media Session API Toggle */}
          <div className="p-5 bg-charcoal-900 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-parchment-100">
                التكامل مع أزرار وسائط النظام (Media Session)
              </h4>
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                إظهار عنوان القصيدة والشاعر والتحكم بالتشغيل من شاشة القفل وإشعارات النظام وأزرار لوحة المفاتيح.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMediaSessionEnabled(!mediaSessionEnabled)}
              className={`px-5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                mediaSessionEnabled
                  ? "bg-accent-700 text-charcoal-950 border-accent-700 shadow-md shadow-accent-700/20"
                  : "bg-white/5 text-ink-500 border-white/10 hover:text-parchment-100 hover:bg-white/10"
              }`}
            >
              <span>{mediaSessionEnabled ? "مفعل" : "معطل"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Typography settings */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Type className="w-5 h-5" />
          <span>الخطوط والطباعة الشعرية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              حجم خط أبيات الشعر ({poetryFontSize})
            </label>
            <div className="flex items-center gap-2 bg-charcoal-900 p-1.5 border border-white/5 rounded-2xl shadow-inner">
              {["20px", "24px", "28px", "32px"].map((size) => (
                <button
                  key={size}
                  onClick={() => setPoetryFontSize(size)}
                  className={`flex-1 py-2 text-[14px] font-mono font-bold transition-all rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
                    poetryFontSize === size
                      ? "bg-accent-700 text-charcoal-950 border-accent-700 shadow-md shadow-accent-700/20"
                      : "bg-transparent text-ink-500 hover:text-parchment-100 hover:bg-white/5 border-transparent"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              التمرير التلقائي أثناء الاستماع
            </label>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`w-full py-3 px-5 text-[14px] font-bold transition-all flex items-center justify-between border shadow-sm rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
                autoScroll
                  ? "bg-accent-700/10 text-accent-500 border-accent-700/20"
                  : "bg-charcoal-900 text-ink-500 border-white/5 hover:bg-charcoal-800 hover:text-parchment-100"
              }`}
            >
              <span>متابعة البيت النشط تلقائياً</span>
              <span className={autoScroll ? "text-accent-500 font-bold" : "text-ink-600 font-bold"}>
                {autoScroll ? "مفعل" : "معطل"}
              </span>
            </button>
          </div>
        </div>

        {/* Sample text preview */}
        <div className="mt-8 p-6 md:p-8 bg-charcoal-900 border border-white/5 text-center shadow-inner relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-accent-700" />
          <p
            className="font-poetry text-parchment-100 font-bold transition-all duration-300 leading-[2.4]"
            style={{ fontSize: poetryFontSize }}
          >
            الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني ... وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ
          </p>
        </div>
      </section>

      {/* AI Speech Engine settings */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Cpu className="w-5 h-5" />
          <span>محرك التعرف على الصوت والمحاذاة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              نموذج Whisper المعتمد
            </label>
            <select
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              className="w-full bg-charcoal-900 text-parchment-100 border border-white/5 rounded-2xl px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-accent-700 transition-colors shadow-inner cursor-pointer"
            >
              <option value="tiny">Tiny (أسرع - دقة أساسية)</option>
              <option value="base">Base (سريع - دقة متوسطة)</option>
              <option value="small">Small (موصى به للتطوير والاستخدام العادي)</option>
              <option value="medium">Medium (دقة عالية)</option>
              <option value="large-v3">Large-v3 (أعلى دقة تشكيل)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              جهاز المعالجة (Compute Device)
            </label>
            <select
              value={computeDevice}
              onChange={(e) => setComputeDevice(e.target.value)}
              className="w-full bg-charcoal-900 text-parchment-100 border border-white/5 rounded-2xl px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-accent-700 transition-colors shadow-inner cursor-pointer"
            >
              <option value="cpu">معالج النظام (CPU - float32 / int8)</option>
              <option value="cuda">بطاقة الرسوميات (NVIDIA CUDA - float16)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Library Data Management */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Database className="w-5 h-5" />
          <span>إدارة بيانات المكتبة</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-charcoal-900 border border-white/5 rounded-2xl font-sans">
          <div>
            <h4 className="text-sm font-bold text-parchment-100">
              إجمالي القصائد المحفوظة
            </h4>
            <p className="text-xs text-ink-500 mt-1">
              يحتوي ديوانك حالياً على <strong className="text-accent-500">{toArabicDigits(poemsCount)}</strong> قصيدة
            </p>
          </div>

          {onDeleteAllPoems && (
            <button
              type="button"
              onClick={() => setShowConfirmDeleteAll(true)}
              disabled={poemsCount === 0}
              className="px-5 py-2.5 bg-crimson-600/15 hover:bg-crimson-600 text-crimson-400 hover:text-white border border-crimson-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 rounded-xl disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف جميع القصائد</span>
            </button>
          )}
        </div>
      </section>

      {/* Desktop Diagnostics */}
      <DiagnosticsPanel />

      {/* System diagnostics & privacy */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-5 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <ShieldCheck className="w-5 h-5" />
          <span>الخصوصية والعمل دون اتصال</span>
        </div>
        <p className="text-[15px] text-ink-500 leading-relaxed font-sans font-medium">
          يعمل ديوان بنسبة 100% محلياً على جهازك دون إرسال أي تسجيلات أو نصوص إلى خوادم سحابية خارجية.
          جميع قواعد البيانات والصوتيات محفوظة في مجلد التطبيق الآمن.
        </p>

        <div className="pt-5 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs md:text-[13px] text-ink-600 font-sans font-bold">
          <span>نظام التشغيل: Linux (Fedora)</span>
          <span className="font-mono ltr-num text-ink-700">Tauri v2.x | React 18</span>
        </div>
      </section>

      {/* Delete All Poems Confirmation Modal */}
      {showConfirmDeleteAll && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-charcoal-900 border border-crimson-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-crimson-500">
              <div className="p-3 bg-crimson-500/10 rounded-2xl border border-crimson-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-parchment-100 font-heading">
                  حذف جميع القصائد
                </h3>
                <p className="text-xs text-crimson-400 font-sans mt-0.5">
                  إجراء حاسم ومسح شامل للمكتبة
                </p>
              </div>
            </div>

            <p className="text-sm text-ink-400 font-sans leading-relaxed">
              هل أنت متأكد من رغبتك في حذف <strong className="text-crimson-400 font-bold">جميع القصائد ({toArabicDigits(poemsCount)})</strong> من التطبيق؟ سيتم مسح كافة الأبيات والتسجيلات والمحاذاة الصوتية نهائياً.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 font-sans">
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={() => setShowConfirmDeleteAll(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-ink-500 hover:text-parchment-100 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={handleExecuteDeleteAll}
                className="px-6 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-crimson-600/20 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAll ? "جاري الحذف..." : "تأكيد حذف كل القصائد"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
