import React, { useState } from "react";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeAudio,
  cancelYoutubeDownload,
  WorkerYouTubeInfoData,
  WorkerYouTubeDownloadData,
} from "@/lib/worker/workerClient";
import { getPoemRecordingDirectory } from "@/lib/audio/fileManager";
import { formatTime } from "@/lib/utils";
import { Search, CheckCircle2, AlertCircle, RefreshCw, X, Download, ShieldCheck, Clock, User } from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";

interface YouTubeImportViewProps {
  onAudioDownloaded?: (result: WorkerYouTubeDownloadData, videoInfo: WorkerYouTubeInfoData) => void;
}

const ERROR_MAP: Record<string, string> = {
  YTDLP_NOT_INSTALLED: "مكوّن تنزيل YouTube غير مثبت.",
  FFMPEG_NOT_FOUND: "برنامج FFmpeg غير متوفر أو لم يتم العثور على مساره.",
  VIDEO_UNAVAILABLE: "المقطع غير متاح أو تم حذفه.",
  PRIVATE_VIDEO: "المقطع خاص ولا يمكن تنزيله.",
  LOGIN_REQUIRED: "يتطلب هذا المقطع تسجيل الدخول، وهو غير مدعوم حاليًا.",
  LIVE_STREAM_NOT_SUPPORTED: "تنزيل البث المباشر غير مدعوم.",
  NO_AUDIO_FORMAT: "لم يتم العثور على مسار صوتي مناسب.",
  DOWNLOAD_FAILED: "فشل تنزيل الصوت. افتح تفاصيل الخطأ للمزيد.",
  CONVERSION_FAILED: "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
  OUTPUT_MISSING: "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
  NETWORK_TIMEOUT: "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
  FILESYSTEM_ERROR: "تعذر حفظ الصوت في مجلد التطبيق.",
};

function formatErrorMessage(err: unknown): string {
  if (!err) return "فشلت عملية تنزيل الصوت";
  const msg = (err as Error).message || String(err);
  for (const [code, arabicText] of Object.entries(ERROR_MAP)) {
    if (msg.includes(code)) {
      return arabicText;
    }
  }
  return msg;
}

export const YouTubeImportView: React.FC<YouTubeImportViewProps> = ({ onAudioDownloaded }) => {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<WorkerYouTubeInfoData | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Download state
  const [isPermitted, setIsPermitted] = useState(false);
  const [audioQuality, setAudioQuality] = useState<"128k" | "192k">("192k");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<WorkerYouTubeDownloadData | null>(null);

  const handleFetchInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoadingInfo(true);
    setInfoError(null);
    setVideoInfo(null);
    setDownloadResult(null);
    setDownloadError(null);

    try {
      const info = await fetchYoutubeVideoInfo(url.trim());
      setVideoInfo(info);
    } catch (err: unknown) {
      setInfoError(formatErrorMessage(err));
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleStartDownload = async () => {
    if (!videoInfo || !isPermitted) return;

    setIsDownloading(true);
    setDownloadProgress(0.05);
    setDownloadStage("جاري بدء التنزيل بأمان عبر معالج الصوت...");
    setDownloadError(null);
    const jobId = `yt-${Date.now()}`;
    setCurrentJobId(jobId);

    try {
      const poemUuid = `poem-${Date.now()}`;
      const recUuid = `rec-${Date.now()}`;
      const targetDir = await getPoemRecordingDirectory(poemUuid, recUuid);

      setDownloadProgress(0.2);
      setDownloadStage("جاري تنزيل المسار الصوتي الأصلي...");

      const res = await downloadYoutubeAudio(
        videoInfo.webpage_url,
        targetDir,
        audioQuality,
        jobId
      );

      setDownloadProgress(1.0);
      const removedMs = res.leading_silence_removed_ms || 0;
      setDownloadStage(
        removedMs > 0
          ? `اكتمل التجهيز؛ حُذف ${removedMs} مللي ثانية من الصمت قبل بداية الإلقاء.`
          : "اكتمل التنزيل والتحويل؛ يبدأ التسجيل من أول إلقاء مكتشف."
      );
      setDownloadResult(res);

      if (onAudioDownloaded) {
        onAudioDownloaded(res, videoInfo);
      }
    } catch (err: unknown) {
      setDownloadError(formatErrorMessage(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = async () => {
    if (currentJobId) {
      await cancelYoutubeDownload(currentJobId);
    }
    setIsDownloading(false);
    setDownloadStage("تم إلغاء التنزيل");
  };

  return (
    <div className="p-6 bg-charcoal-900 border border-charcoal-800 rounded-2xl space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
          <YoutubeIcon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-parchment-100 font-poetry">
            استيراد تسجيل صوتي من YouTube
          </h3>
          <p className="text-xs text-parchment-400">
            تنزيل التسجيلات الشعرية المصرح بها وتحويلها إلى MP3 للتشغيل و WAV 16kHz للمحاذاة
          </p>
        </div>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleFetchInfo} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... أو https://youtu.be/..."
            className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500 ltr-num"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || isLoadingInfo || isDownloading}
          className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-charcoal-950 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          {isLoadingInfo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>قراءة بيانات المقطع</span>
        </button>
      </form>

      {/* Info Error */}
      {infoError && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2 select-text">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{infoError}</span>
        </div>
      )}

      {/* Video Preview Card */}
      {videoInfo && (
        <div className="p-4 bg-charcoal-950/80 rounded-xl border border-charcoal-800 space-y-4 animate-fadeIn select-text">
          <div className="flex flex-col sm:flex-row gap-4">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-full sm:w-44 h-28 object-cover rounded-lg border border-charcoal-800 shadow-md"
              />
            )}
            <div className="flex-1 space-y-1.5">
              <h4 className="font-poetry text-base font-bold text-parchment-100 leading-snug">
                {videoInfo.title}
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-parchment-400">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gold-400" />
                  <span>{videoInfo.channel}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gold-400" />
                  <span className="font-mono ltr-num">{formatTime(videoInfo.duration_ms)}</span>
                </span>
              </div>
              {videoInfo.description && (
                <p className="text-[11px] text-parchment-400 line-clamp-2 leading-normal">
                  {videoInfo.description}
                </p>
              )}
            </div>
          </div>

          {/* Download Options */}
          <div className="pt-3 border-t border-charcoal-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Audio Quality Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-parchment-400">جودة الصوت:</span>
              <div className="flex gap-1 bg-charcoal-850 p-1 rounded-lg border border-charcoal-700">
                <button
                  type="button"
                  onClick={() => setAudioQuality("192k")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    audioQuality === "192k"
                      ? "bg-gold-500 text-charcoal-950 font-bold"
                      : "text-parchment-400 hover:text-parchment-200"
                  }`}
                >
                  عالية (192 kbps)
                </button>
                <button
                  type="button"
                  onClick={() => setAudioQuality("128k")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    audioQuality === "128k"
                      ? "bg-gold-500 text-charcoal-950 font-bold"
                      : "text-parchment-400 hover:text-parchment-200"
                  }`}
                >
                  قياسية (128 kbps)
                </button>
              </div>
            </div>

            {/* Legal Confirmation Checkbox */}
            <label className="flex items-center gap-2 text-xs text-parchment-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPermitted}
                onChange={(e) => setIsPermitted(e.target.checked)}
                className="rounded border-charcoal-700 text-gold-500 focus:ring-gold-500/40 bg-charcoal-800"
              />
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>أؤكد أن لدي الإذن لتنزيل واستخدام هذا التسجيل الصوتي</span>
              </span>
            </label>
          </div>

          {/* Download Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {isDownloading && (
              <button
                type="button"
                onClick={handleCancelDownload}
                className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>إلغاء التنزيل</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartDownload}
              disabled={!isPermitted || isDownloading}
              className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md"
            >
              {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isDownloading ? "جاري التنزيل..." : "بدء تنزيل الصوت ومعالجته"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Download Progress */}
      {isDownloading && (
        <div className="p-4 bg-charcoal-950 rounded-xl border border-charcoal-800 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs">
            <span className="text-parchment-200 font-semibold">{downloadStage}</span>
            <span className="text-gold-400 font-mono ltr-num">{Math.round(downloadProgress * 100)}%</span>
          </div>
          <div className="w-full bg-charcoal-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gold-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, downloadProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Download Error */}
      {downloadError && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between gap-2 select-text">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{downloadError}</span>
          </div>
          <button
            onClick={handleStartDownload}
            className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold text-rose-200"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Download Success */}
      {downloadResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-1.5 select-text animate-fadeIn">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>تم تنزيل ومعالجة التسجيل الصوتي بنجاح!</span>
          </div>
          <div className="text-[11px] text-parchment-300 font-mono ltr-num space-y-0.5">
            <p>المدة: {formatTime(downloadResult.duration_ms)} • الصيغة الأصلية: {downloadResult.raw_format}</p>
            <p className="text-parchment-400 truncate">ملف التشغيل: {downloadResult.playback_audio_path}</p>
            <p className="text-parchment-400 truncate">ملف المعالجة: {downloadResult.processing_audio_path}</p>
          </div>
        </div>
      )}
    </div>
  );
};
