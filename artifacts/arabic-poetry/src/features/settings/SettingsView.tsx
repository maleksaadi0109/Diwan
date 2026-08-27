import React, { useState } from "react";
import { Type, Cpu, ShieldCheck, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { checkWorkerHealth, WorkerHealthData } from "@/lib/worker/workerClient";

export const SettingsView: React.FC = () => {
  const [poetryFontSize, setPoetryFontSize] = useState("24px");
  const [asrModel, setAsrModel] = useState("small");
  const [computeDevice, setComputeDevice] = useState("cpu");
  const [autoScroll, setAutoScroll] = useState(true);

  const [healthStatus, setHealthStatus] = useState<WorkerHealthData | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    setHealthError(null);
    try {
      const data = await checkWorkerHealth();
      setHealthStatus(data);
    } catch (err: unknown) {
      const error = err as Error;
      setHealthError(error.message || "فشل الاتصال بمعالج الصوت");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full select-none space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-parchment-100 font-poetry">
          إعدادات ديوان
        </h2>
        <p className="text-sm text-parchment-400 mt-1">
          تخصيص الخطوط والتشغيل ومعالج الصوتيات والذكاء الاصطناعي
        </p>
      </div>

      {/* Typography settings */}
      <section className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-gold-400 font-semibold text-sm">
          <Type className="w-4 h-4" />
          <span>الخطوط والطباعة الشعرية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-parchment-300 mb-2">
              حجم خط أبيات الشعر ({poetryFontSize})
            </label>
            <div className="flex items-center gap-2">
              {["20px", "24px", "28px", "32px"].map((size) => (
                <button
                  key={size}
                  onClick={() => setPoetryFontSize(size)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                    poetryFontSize === size
                      ? "bg-gold-500/20 text-gold-300 border-gold-500/40 font-bold"
                      : "bg-charcoal-850 text-parchment-400 border-charcoal-750 hover:text-parchment-200"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-parchment-300 mb-2">
              التمرير التلقائي أثناء الاستماع
            </label>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                autoScroll
                  ? "bg-gold-500/15 text-gold-300 border-gold-500/30"
                  : "bg-charcoal-850 text-parchment-400 border-charcoal-750"
              }`}
            >
              <span>متابعة البيت النشط تلقائياً</span>
              <span>{autoScroll ? "مفعل" : "معطل"}</span>
            </button>
          </div>
        </div>

        {/* Sample text preview */}
        <div className="mt-4 p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 text-center">
          <p
            className="font-poetry text-gold-300 transition-all"
            style={{ fontSize: poetryFontSize }}
          >
            الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني ... وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ
          </p>
        </div>
      </section>

      {/* AI Speech Engine settings */}
      <section className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-gold-400 font-semibold text-sm">
          <Cpu className="w-4 h-4" />
          <span>محرك التعرف على الصوت والمحاذاة (Faster-Whisper / Silero)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-parchment-300 mb-2">
              نموذج Whisper المعتمد
            </label>
            <select
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              className="w-full bg-charcoal-850 text-parchment-100 border border-charcoal-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold-500"
            >
              <option value="tiny">Tiny (أسرع - دقة أساسية)</option>
              <option value="base">Base (سريع - دقة متوسطة)</option>
              <option value="small">Small (موصى به للتطوير والاستخدام العادي)</option>
              <option value="medium">Medium (دقة عالية في الكلمات النادرة)</option>
              <option value="large-v3">Large-v3 (أعلى دقة تشكيل وإعراب)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-parchment-300 mb-2">
              جهاز المعالجة (Compute Device)
            </label>
            <select
              value={computeDevice}
              onChange={(e) => setComputeDevice(e.target.value)}
              className="w-full bg-charcoal-850 text-parchment-100 border border-charcoal-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold-500"
            >
              <option value="cpu">معالج النظام (CPU - float32 / int8)</option>
              <option value="cuda">بطاقة الرسوميات (NVIDIA CUDA - float16)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Python Worker Diagnostics */}
      <section className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gold-400 font-semibold text-sm">
            <Activity className="w-4 h-4" />
            <span>فحص صحة معالج الصوتيات (Python Worker Health)</span>
          </div>
          <button
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="px-3.5 py-1.5 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-gold-300 border border-gold-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span>{isCheckingHealth ? "جاري الفحص..." : "تشغيل فحص الصحة"}</span>
          </button>
        </div>

        {healthStatus && (
          <div className="p-4 rounded-xl bg-charcoal-950 border border-charcoal-800 text-xs space-y-2 select-text">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>معالج بايثون متصل وجاهز للعمل</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-parchment-300 pt-2 font-mono text-[11px]">
              <div>إصدار المعالج: {healthStatus.worker_version}</div>
              <div>إصدار بايثون: {healthStatus.python_version}</div>
              <div className="col-span-2 text-parchment-400 truncate">
                FFmpeg: {healthStatus.ffmpeg}
              </div>
            </div>
          </div>
        )}

        {healthError && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{healthError}</span>
          </div>
        )}
      </section>

      {/* System diagnostics & privacy */}
      <section className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-gold-400 font-semibold text-sm">
          <ShieldCheck className="w-4 h-4" />
          <span>الخصوصية والعمل دون اتصال</span>
        </div>
        <p className="text-xs text-parchment-400 leading-relaxed">
          يعمل ديوان بنسبة 100% محلياً على جهازك دون إرسال أي تسجيلات أو نصوص إلى خوادم سحابية خارجية.
          جميع قواعد البيانات والصوتيات محفوظة في مجلد التطبيق الآمن.
        </p>

        <div className="pt-2 border-t border-charcoal-800/80 flex items-center justify-between text-xs text-parchment-400">
          <span>نظام التشغيل: Linux (Fedora)</span>
          <span className="font-mono ltr-num">Tauri v2.x | React 18</span>
        </div>
      </section>
    </div>
  );
};
