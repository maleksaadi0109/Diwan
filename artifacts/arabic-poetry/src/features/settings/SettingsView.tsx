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
    <div className="h-full overflow-y-auto px-8 md:px-12 py-10 max-w-4xl mx-auto w-full select-none space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 scroll-smooth text-ink-900">
      <div className="border-b-2 border-paper-400 pb-6">
        <h2 className="text-5xl font-bold text-ink-900 font-heading">
          إعدادات ديوان
        </h2>
        <p className="text-[16px] text-ink-600 mt-3 font-ui font-bold">
          تخصيص الخطوط والتشغيل ومعالج الصوتيات والذكاء الاصطناعي
        </p>
      </div>

      {/* Typography settings */}
      <section className="bg-paper-100 border border-paper-400 rounded-none p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-ui text-[15px]">
          <Type className="w-5 h-5" />
          <span>الخطوط والطباعة الشعرية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-ui">
          <div>
            <label className="block text-[14px] font-bold text-ink-800 mb-3">
              حجم خط أبيات الشعر ({poetryFontSize})
            </label>
            <div className="flex items-center gap-2 bg-paper-200 p-1.5 border border-paper-400 rounded-none shadow-sm">
              {["20px", "24px", "28px", "32px"].map((size) => (
                <button
                  key={size}
                  onClick={() => setPoetryFontSize(size)}
                  className={`flex-1 py-2 text-[14px] font-mono font-bold transition-colors rounded-none border ${
                    poetryFontSize === size
                      ? "bg-accent-700 text-paper-100 border-accent-700 shadow-sm"
                      : "bg-transparent text-ink-700 hover:text-ink-900 hover:bg-paper-300 border-transparent"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-bold text-ink-800 mb-3">
              التمرير التلقائي أثناء الاستماع
            </label>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`w-full py-3 px-5 text-[14px] font-bold transition-colors flex items-center justify-between border shadow-sm rounded-none ${
                autoScroll
                  ? "bg-paper-300 text-accent-700 border-paper-400"
                  : "bg-paper-200 text-ink-600 border-paper-400 hover:bg-paper-300 hover:text-ink-800"
              }`}
            >
              <span>متابعة البيت النشط تلقائياً</span>
              <span className={autoScroll ? "text-accent-700 font-bold" : "text-ink-600 font-bold"}>
                {autoScroll ? "مفعل" : "معطل"}
              </span>
            </button>
          </div>
        </div>

        {/* Sample text preview */}
        <div className="mt-8 p-8 bg-paper-200 border border-paper-400 text-center shadow-sm relative overflow-hidden rounded-none">
          <div className="absolute top-0 right-0 w-2 h-full bg-accent-700" />
          <p
            className="font-poetry text-ink-900 font-bold transition-all duration-300 leading-[2.4]"
            style={{ fontSize: poetryFontSize }}
          >
            الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني ... وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ
          </p>
        </div>
      </section>

      {/* AI Speech Engine settings */}
      <section className="bg-paper-100 border border-paper-400 rounded-none p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-ui text-[15px]">
          <Cpu className="w-5 h-5" />
          <span>محرك التعرف على الصوت والمحاذاة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-ui">
          <div>
            <label className="block text-[14px] font-bold text-ink-800 mb-3">
              نموذج Whisper المعتمد
            </label>
            <select
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              className="w-full bg-paper-200 text-ink-900 border border-paper-400 rounded-none px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-accent-700 transition-colors shadow-sm cursor-pointer"
            >
              <option value="tiny">Tiny (أسرع - دقة أساسية)</option>
              <option value="base">Base (سريع - دقة متوسطة)</option>
              <option value="small">Small (موصى به للتطوير والاستخدام العادي)</option>
              <option value="medium">Medium (دقة عالية)</option>
              <option value="large-v3">Large-v3 (أعلى دقة تشكيل)</option>
            </select>
          </div>

          <div>
            <label className="block text-[14px] font-bold text-ink-800 mb-3">
              جهاز المعالجة (Compute Device)
            </label>
            <select
              value={computeDevice}
              onChange={(e) => setComputeDevice(e.target.value)}
              className="w-full bg-paper-200 text-ink-900 border border-paper-400 rounded-none px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-accent-700 transition-colors shadow-sm cursor-pointer"
            >
              <option value="cpu">معالج النظام (CPU - float32 / int8)</option>
              <option value="cuda">بطاقة الرسوميات (NVIDIA CUDA - float16)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Python Worker Diagnostics */}
      <section className="bg-paper-100 border border-paper-400 rounded-none p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-accent-700 font-bold font-ui text-[15px]">
            <Activity className="w-5 h-5" />
            <span>فحص صحة معالج الصوتيات</span>
          </div>
          <button
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="px-6 py-3 bg-transparent hover:bg-paper-200 text-ink-800 border border-paper-500 text-[14px] font-bold transition-colors flex items-center justify-center gap-2 font-ui shadow-sm rounded-none"
          >
            <span>{isCheckingHealth ? "جاري الفحص..." : "تشغيل فحص الصحة"}</span>
          </button>
        </div>

        {healthStatus && (
          <div className="p-6 bg-green-50 border border-green-800 text-[14px] space-y-4 select-text font-ui shadow-sm rounded-none">
            <div className="flex items-center gap-3 text-green-800 font-bold">
              <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
              <span>معالج بايثون متصل وجاهز للعمل</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-green-800 pt-4 border-t border-green-800/20 font-mono text-[13px] font-bold">
              <div>إصدار المعالج: <span className="text-green-900">{healthStatus.worker_version}</span></div>
              <div>إصدار بايثون: <span className="text-green-900">{healthStatus.python_version}</span></div>
              <div className="col-span-2 truncate">
                FFmpeg: <span className="text-green-900">{healthStatus.ffmpeg}</span>
              </div>
            </div>
          </div>
        )}

        {healthError && (
          <div className="p-5 bg-red-50 border border-red-800 text-red-800 text-[14px] flex items-center gap-3 font-ui font-bold shadow-sm rounded-none">
            <AlertCircle className="w-5 h-5" />
            <span>{healthError}</span>
          </div>
        )}
      </section>

      {/* System diagnostics & privacy */}
      <section className="bg-paper-100 border border-paper-400 rounded-none p-8 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-ui text-[15px]">
          <ShieldCheck className="w-5 h-5" />
          <span>الخصوصية والعمل دون اتصال</span>
        </div>
        <p className="text-[15px] text-ink-700 leading-relaxed font-ui font-bold">
          يعمل ديوان بنسبة 100% محلياً على جهازك دون إرسال أي تسجيلات أو نصوص إلى خوادم سحابية خارجية.
          جميع قواعد البيانات والصوتيات محفوظة في مجلد التطبيق الآمن.
        </p>

        <div className="pt-5 border-t border-paper-400 flex items-center justify-between text-[13px] text-ink-600 font-ui font-bold">
          <span>نظام التشغيل: Linux (Fedora)</span>
          <span className="font-mono ltr-num text-ink-800">Tauri v2.x | React 18</span>
        </div>
      </section>
    </div>
  );
};
