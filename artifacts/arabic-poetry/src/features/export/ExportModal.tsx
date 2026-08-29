import React, { useState } from "react";
import { Poem } from "@/types";
import {
  exportLrc,
  exportSrt,
  exportDiwanJson,
  downloadFile,
} from "@/lib/export/exportManager";
import { Download, FileText, Music, CheckCircle2, X } from "lucide-react";

interface ExportModalProps {
  poem: Poem;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  poem,
  isOpen,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"lrc" | "srt" | "json">("lrc");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const cleanTitle = poem.title.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");

    if (selectedFormat === "lrc") {
      const content = exportLrc(poem);
      downloadFile(content, `${cleanTitle}.lrc`, "text/plain");
    } else if (selectedFormat === "srt") {
      const content = exportSrt(poem);
      downloadFile(content, `${cleanTitle}.srt`, "text/plain");
    } else if (selectedFormat === "json") {
      const content = exportDiwanJson(poem);
      downloadFile(content, `${cleanTitle}_diwan.json`, "application/json");
    }

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1500);
  };

  const getPreview = () => {
    if (selectedFormat === "lrc") return exportLrc(poem);
    if (selectedFormat === "srt") return exportSrt(poem);
    return exportDiwanJson(poem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4 select-none animate-fadeIn font-ui">
      <div className="bg-paper-100 border-2 border-paper-400 rounded-none w-full max-w-xl overflow-hidden shadow-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-paper-400 bg-paper-200 flex items-center justify-between">
          <div className="flex items-center gap-3 text-accent-700">
            <Download className="w-5 h-5" />
            <div>
              <h3 className="text-xl font-bold font-heading text-ink-900">
                تصدير القصيدة والكلمات المتزامنة
              </h3>
              <p className="text-[13px] font-bold text-ink-600 font-ui mt-0.5">
                تصدير بتنسيقات LRC و SRT و Diwan JSON
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-ink-900 p-1.5 rounded-none hover:bg-paper-300 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-paper-100">
          {/* Format selection cards */}
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setSelectedFormat("lrc")}
              className={`p-4 border text-center transition-colors rounded-none shadow-sm ${
                selectedFormat === "lrc"
                  ? "bg-paper-300 border-accent-700 text-accent-700"
                  : "bg-paper-200 border-paper-400 text-ink-700 hover:text-ink-900 hover:bg-paper-300"
              }`}
            >
              <Music className="w-6 h-6 mx-auto mb-2" />
              <div className="text-[14px] font-bold font-mono">LRC</div>
              <div className="text-[12px] opacity-75 font-bold mt-1">كلمات متزامنة</div>
            </button>

            <button
              onClick={() => setSelectedFormat("srt")}
              className={`p-4 border text-center transition-colors rounded-none shadow-sm ${
                selectedFormat === "srt"
                  ? "bg-paper-300 border-accent-700 text-accent-700"
                  : "bg-paper-200 border-paper-400 text-ink-700 hover:text-ink-900 hover:bg-paper-300"
              }`}
            >
              <FileText className="w-6 h-6 mx-auto mb-2" />
              <div className="text-[14px] font-bold font-mono">SRT</div>
              <div className="text-[12px] opacity-75 font-bold mt-1">ترجمة وتسميات</div>
            </button>

            <button
              onClick={() => setSelectedFormat("json")}
              className={`p-4 border text-center transition-colors rounded-none shadow-sm ${
                selectedFormat === "json"
                  ? "bg-paper-300 border-accent-700 text-accent-700"
                  : "bg-paper-200 border-paper-400 text-ink-700 hover:text-ink-900 hover:bg-paper-300"
              }`}
            >
              <Download className="w-6 h-6 mx-auto mb-2" />
              <div className="text-[14px] font-bold font-mono">JSON</div>
              <div className="text-[12px] opacity-75 font-bold mt-1">حزمة ديوان الشاملة</div>
            </button>
          </div>

          {/* Code Preview */}
          <div className="space-y-3">
            <span className="text-[14px] font-bold text-ink-800 block">
              معاينة الملف المصدّر:
            </span>
            <pre className="p-4 bg-paper-200 rounded-none border border-paper-400 font-mono text-[13px] text-ink-900 max-h-56 overflow-y-auto leading-[2] select-text ltr-num text-left shadow-inner font-bold">
              {getPreview()}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-paper-400 bg-paper-200 flex items-center justify-between">
          <div>
            {downloadSuccess && (
              <span className="text-[14px] font-bold text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                <span>تم تنزيل الملف بنجاح!</span>
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-none bg-transparent hover:bg-paper-300 text-ink-800 text-[14px] font-bold border border-paper-500 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2.5 rounded-none bg-accent-700 hover:bg-accent-600 text-paper-100 text-[14px] font-bold transition-colors shadow-sm flex items-center gap-2 border border-accent-700"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل الملف</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
