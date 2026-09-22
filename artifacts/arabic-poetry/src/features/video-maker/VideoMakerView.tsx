import React, { useState, useEffect, useMemo } from "react";
import { Poem } from "@/types";
import { VideoState, AspectRatio, BackgroundType } from "./types";
import { generateTimeline } from "./timelineUtils";
import { VideoPreview } from "./VideoPreview";
import { useVideoExport } from "./useVideoExport";
import { Film, Image as ImageIcon, Download, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { DiwanRepository } from "@/lib/db/repository";

interface VideoMakerViewProps {
  poems: Poem[];
  repository: DiwanRepository | null;
}

export const VideoMakerView: React.FC<VideoMakerViewProps> = ({ poems, repository }) => {
  const firstUsablePoem = poems.find((poem) =>
    poem.recordings.some((recording) => recording.audioPath.trim().length > 0)
  );
  const [selectedPoemId, setSelectedPoemId] = useState<string>(firstUsablePoem?.id || poems[0]?.id || "");
  const selectedPoem = useMemo(() => poems.find(p => p.id === selectedPoemId) || null, [poems, selectedPoemId]);
  const usableRecordings = useMemo(
    () => selectedPoem?.recordings.filter((recording) => recording.audioPath.trim().length > 0) || [],
    [selectedPoem]
  );
  
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>("");
  const selectedRecording = useMemo(
    () => usableRecordings.find((recording) => recording.id === selectedRecordingId) || null,
    [usableRecordings, selectedRecordingId]
  );

  useEffect(() => {
    if (!selectedPoemId && poems.length > 0) {
      const usablePoem = poems.find((poem) =>
        poem.recordings.some((recording) => recording.audioPath.trim().length > 0)
      );
      setSelectedPoemId(usablePoem?.id || poems[0].id);
    }
  }, [poems, selectedPoemId]);

  // Set default recording when poem changes
  useEffect(() => {
    if (selectedPoem) {
      const defaultRec = selectedPoem.defaultRecordingId 
        ? usableRecordings.find(r => r.id === selectedPoem.defaultRecordingId) 
        : usableRecordings[0];
      setSelectedRecordingId(defaultRec?.id || "");
    }
  }, [selectedPoem, usableRecordings]);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("gradient");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundImageElement, setBackgroundImageElement] = useState<HTMLImageElement | null>(null);
  const [fontScale, setFontScale] = useState(1.0);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  const [timelinePoem, setTimelinePoem] = useState<Poem | null>(selectedPoem);
  const [isLoadingAlignment, setIsLoadingAlignment] = useState(false);

  useEffect(() => {
    return () => {
      if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
    };
  }, [backgroundImageUrl]);

  useEffect(() => {
    let active = true;

    if (!selectedPoem || !selectedRecording || !repository) {
      setTimelinePoem(selectedPoem);
      setIsLoadingAlignment(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingAlignment(true);
    void Promise.all(
      selectedPoem.verses.map((verse) =>
        repository.getAlignmentByVerseId(verse.id, selectedRecording.id)
      )
    ).then((alignments) => {
      if (!active) return;
      setTimelinePoem({
        ...selectedPoem,
        verses: selectedPoem.verses.map((verse, index) => ({
          ...verse,
          alignment: alignments[index] || undefined,
        })),
      });
    }).catch((error) => {
      console.error("Failed to load recording-specific alignments", error);
      if (active) setTimelinePoem(selectedPoem);
    }).finally(() => {
      if (active) setIsLoadingAlignment(false);
    });

    return () => {
      active = false;
    };
  }, [repository, selectedPoem, selectedRecording]);

  // Generate timeline automatically
  const events = useMemo(() => {
    if (!timelinePoem) return [];
    if (!selectedRecording) {
      return [{ type: "intro" as const, startMs: 0, endMs: Number.MAX_SAFE_INTEGER }];
    }
    return generateTimeline(timelinePoem, selectedRecording);
  }, [timelinePoem, selectedRecording]);

  const state: VideoState = {
    poem: timelinePoem,
    recording: selectedRecording,
    aspectRatio,
    backgroundType,
    backgroundImageUrl,
    backgroundImageElement,
    fontScale,
    textColor: "#f7f4ec", // parchment-100
    overlayOpacity,
    events
  };

  const {
    isExporting,
    progress,
    exportError,
    exportMessage,
    startExport,
    cancelExport,
    exportTimeMsRef,
  } = useVideoExport();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("حجم الصورة يجب أن لا يتجاوز 5 ميجابايت");
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert("صيغة الصورة غير مدعومة");
      return;
    }

    if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
    
    const url = URL.createObjectURL(file);
    setBackgroundImageUrl(url);
    
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setBackgroundImageElement(img);
      setBackgroundType("image");
    };
  };

  const handleExport = async () => {
    if (!selectedRecording) return;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="video-preview-canvas"]');
    if (!canvas) return;

    // Use total duration which might extend past audio if we added an outro delay
    // Actually the video should just be the length of the audio, or max of audio and last event end
    const lastEventEnd = events.length > 0 ? events[events.length - 1].endMs : selectedRecording.durationMs;
    const durationMs = Math.max(selectedRecording.durationMs, lastEventEnd);

    try {
      await startExport(
        canvas,
        selectedRecording.audioPath,
        durationMs,
        () => {},
        `${selectedPoem?.title || "فيديو قصيدة"}-${aspectRatio.replace(":", "x")}`
      );
    } catch (e) {
      console.log("Export failed/cancelled");
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col md:flex-row overflow-hidden bg-charcoal-900">
      
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-l border-white/5 bg-charcoal-850 shrink-0 overflow-y-auto">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-bold font-poetry text-parchment-100 flex items-center gap-2">
            <Film className="w-5 h-5 text-accent-700" />
            صانع الفيديو
          </h2>
          <p className="text-xs text-ink-500 mt-2 font-sans">
            تصدير قصائدك كفيديو مع الخلفيات المتحركة والمحاذاة الصوتية
          </p>
        </div>

        <div className="p-6 flex flex-col gap-8 flex-1">
          {/* Poem & Recording Selection */}
          <section className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-ink-400 mb-2">القصيدة</label>
              <select 
                className="w-full bg-charcoal-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-parchment-100 focus:border-accent-700 focus:outline-none"
                value={selectedPoemId}
                onChange={e => setSelectedPoemId(e.target.value)}
                disabled={isExporting}
              >
                {poems.length === 0 && <option value="">لا توجد قصائد</option>}
                {poems.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} - {p.poet.name}
                    {p.recordings.some((recording) => recording.audioPath.trim().length > 0)
                      ? ""
                      : " (بدون تسجيل صالح)"}
                  </option>
                ))}
              </select>
            </div>

            {selectedPoem && (
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-2">التسجيل الصوتي</label>
                <select 
                  className="w-full bg-charcoal-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-parchment-100 focus:border-accent-700 focus:outline-none"
                  value={selectedRecordingId}
                  onChange={e => setSelectedRecordingId(e.target.value)}
                  disabled={isExporting}
                >
                  {usableRecordings.length === 0 && <option value="">لا توجد تسجيلات صالحة</option>}
                  {usableRecordings.map(r => {
                    const hasAlign = selectedPoem.verses.every(v => v.alignment?.recordingId === r.id);
                    return (
                      <option key={r.id} value={r.id}>
                        {r.title} {hasAlign ? '(مُزامن)' : '(بدون مزامنة)'}
                      </option>
                    );
                  })}
                </select>
                {selectedRecording && (
                  <p
                    className="mt-2 text-[11px] text-ink-500"
                    data-testid="status-video-timing"
                  >
                    {isLoadingAlignment
                      ? "جارٍ تحميل توقيت هذا التسجيل..."
                      : timelinePoem?.verses.every(
                      (verse) => verse.alignment?.recordingId === selectedRecording.id
                    )
                      ? "سيُستخدم توقيت الأبيات المتزامن مع هذا التسجيل."
                      : "لا توجد مزامنة كاملة لهذا التسجيل؛ سيُستخدم توقيت تقريبي متساوٍ."}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Aspect Ratio */}
          <section>
            <label className="block text-xs font-bold text-ink-400 mb-3">أبعاد الفيديو</label>
            <div className="grid grid-cols-2 gap-3">
              {(["16:9", "9:16"] as AspectRatio[]).map(ratio => (
                <button
                  key={ratio}
                  disabled={isExporting}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-3 rounded-xl text-sm font-sans font-bold flex items-center justify-center gap-2 border transition-all ${
                    aspectRatio === ratio 
                      ? "bg-accent-700/10 text-accent-500 border-accent-700/30" 
                      : "bg-charcoal-950 text-ink-500 border-white/5 hover:bg-white/5"
                  }`}
                >
                  {ratio === "16:9" ? "16:9 (يوتيوب)" : "9:16 (ريلز)"}
                </button>
              ))}
            </div>
          </section>

          {/* Background */}
          <section>
            <label className="block text-xs font-bold text-ink-400 mb-3">الخلفية</label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                disabled={isExporting}
                onClick={() => setBackgroundType("gradient")}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  backgroundType === "gradient" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                }`}
              >
                تدرج لوني
              </button>
              <button
                disabled={isExporting}
                onClick={() => setBackgroundType("particles")}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  backgroundType === "particles" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                }`}
              >
                جزيئات
              </button>
              <button
                disabled={isExporting}
                onClick={() => setBackgroundType("solid")}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  backgroundType === "solid" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                }`}
              >
                لون صلب
              </button>
              <button
                disabled={isExporting}
                onClick={() => {
                  if (backgroundImageElement) setBackgroundType("image");
                  else document.getElementById("video-bg-upload")?.click();
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  backgroundType === "image" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                صورة
              </button>
            </div>
            <input 
              type="file" 
              id="video-bg-upload" 
              accept="image/jpeg,image/png,image/webp"
              className="hidden" 
              onChange={handleImageUpload}
            />
            {backgroundImageUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={backgroundImageUrl} className="w-10 h-10 rounded-lg object-cover bg-black" />
                <button 
                  onClick={() => document.getElementById("video-bg-upload")?.click()}
                  className="text-xs text-accent-500 hover:text-accent-400"
                >
                  تغيير الصورة
                </button>
              </div>
            )}
          </section>

          {/* Typography */}
          <section>
            <label className="block text-xs font-bold text-ink-400 mb-3">حجم النص ({Math.round(fontScale * 100)}%)</label>
            <input 
              type="range" 
              min="0.5" max="2.0" step="0.1"
              value={fontScale}
              onChange={e => setFontScale(parseFloat(e.target.value))}
              disabled={isExporting}
              className="w-full accent-accent-700 h-2 bg-charcoal-950 rounded-lg appearance-none cursor-pointer"
            />
            
            <label className="block text-xs font-bold text-ink-400 mt-4 mb-3">تعتيم الخلفية ({Math.round(overlayOpacity * 100)}%)</label>
            <input 
              type="range" 
              min="0" max="0.9" step="0.1"
              value={overlayOpacity}
              onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
              disabled={isExporting}
              className="w-full accent-accent-700 h-2 bg-charcoal-950 rounded-lg appearance-none cursor-pointer"
            />
          </section>
        </div>

        {/* Action Button */}
        <div className="p-6 border-t border-white/5 shrink-0 bg-charcoal-900/50 backdrop-blur-md">
          {(exportError || exportMessage) && (
            <div
              className={`mb-3 rounded-xl border p-3 text-xs font-ui flex items-start gap-2 ${
                exportError
                  ? "border-crimson-500/30 bg-crimson-500/10 text-crimson-500"
                  : "border-accent-700/30 bg-accent-700/10 text-accent-500"
              }`}
              role="status"
              data-testid="status-video-export"
            >
              {exportError ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{exportError || exportMessage}</span>
            </div>
          )}
          {isExporting ? (
            <button
              onClick={cancelExport}
              className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-crimson-500 hover:bg-crimson-600 text-white shadow-lg"
            >
              <X className="w-5 h-5" />
              إلغاء التصدير
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={!selectedRecording || !selectedPoem || isLoadingAlignment}
              className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-accent-700 hover:bg-accent-600 text-charcoal-950 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              <Download className="w-5 h-5" />
              تصدير الفيديو
            </button>
          )}
        </div>
      </div>

      {/* Main Preview Area */}
      <VideoPreview 
        state={state} 
        exportTimeMsRef={exportTimeMsRef}
        isExporting={isExporting}
        exportProgress={progress}
      />
    </div>
  );
};
