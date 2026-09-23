import React, { useState, useEffect, useMemo } from "react";
import { Poem, Recording } from "@/types";
import { VideoState, AspectRatio, BackgroundType, VideoTemplate } from "./types";
import { generateTimeline } from "./timelineUtils";
import { VideoPreview } from "./VideoPreview";
import { useVideoExport } from "./useVideoExport";
import { useMicrophoneRecorder } from "./useMicrophoneRecorder";
import { useLiveRecitationGuide } from "./useLiveRecitationGuide";
import { Film, Image as ImageIcon, Download, X, AlertCircle, CheckCircle2, Upload, Mic, Square, Settings2, Palette, PlaySquare, Music } from "lucide-react";
import { DiwanRepository } from "@/lib/db/repository";
import { pickAudioFile, resolveAudioSrcAsync } from "@/lib/audio/fileManager";
import { VideoStyle, DEFAULT_VIDEO_STYLE, loadVideoFonts } from "./videoStyles";
import { VideoStyleControls } from "./VideoStyleControls";
import { VideoStylePresets, VideoPreset } from "./VideoStylePresets";
import { VideoSidebarCard } from "./VideoSidebarCard";

interface VideoMakerViewProps {
  poems: Poem[];
  repository: DiwanRepository | null;
  initialPoemId?: string | null;
}

export const VideoMakerView: React.FC<VideoMakerViewProps> = ({
  poems,
  repository,
  initialPoemId,
}) => {
  const firstUsablePoem = poems.find((poem) =>
    poem.recordings.some((recording) => recording.audioPath.trim().length > 0)
  );
  const [selectedPoemId, setSelectedPoemId] = useState<string>(
    initialPoemId || firstUsablePoem?.id || poems[0]?.id || ""
  );
  const selectedPoem = useMemo(() => poems.find(p => p.id === selectedPoemId) || null, [poems, selectedPoemId]);
  const usableRecordings = useMemo(
    () => selectedPoem?.recordings.filter((recording) => recording.audioPath.trim().length > 0) || [],
    [selectedPoem]
  );
  
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>("");
  const [customRecording, setCustomRecording] = useState<Recording | null>(null);
  const [audioPickError, setAudioPickError] = useState<string | null>(null);
  const selectedRecording = useMemo(
    () =>
      customRecording?.id === selectedRecordingId
        ? customRecording
        : usableRecordings.find((recording) => recording.id === selectedRecordingId) || null,
    [customRecording, usableRecordings, selectedRecordingId]
  );

  useEffect(() => {
    if (initialPoemId && poems.some((poem) => poem.id === initialPoemId)) {
      setSelectedPoemId(initialPoemId);
    }
  }, [initialPoemId, poems]);

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

  useEffect(() => {
    setCustomRecording((current) => {
      if (current?.audioPath.startsWith("blob:")) {
        URL.revokeObjectURL(current.audioPath);
      }
      return null;
    });
    setAudioPickError(null);
  }, [selectedPoemId]);

  useEffect(() => {
    return () => {
      if (customRecording?.audioPath.startsWith("blob:")) {
        URL.revokeObjectURL(customRecording.audioPath);
      }
    };
  }, [customRecording]);

  const [template, setTemplate] = useState<VideoState["template"]>("classic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("gradient");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundImageElement, setBackgroundImageElement] = useState<HTMLImageElement | null>(null);
  const [fontScale, setFontScale] = useState(1.0);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  const [timelinePoem, setTimelinePoem] = useState<Poem | null>(selectedPoem);
  const [isLoadingAlignment, setIsLoadingAlignment] = useState(false);
  const [videoStyle, setVideoStyle] = useState<VideoStyle>(DEFAULT_VIDEO_STYLE);
  const [isPreparingExport, setIsPreparingExport] = useState(false);
  const [fontLoadError, setFontLoadError] = useState<string | null>(null);

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
    setTimelinePoem({
      ...selectedPoem,
      verses: selectedPoem.verses.map((verse) => ({
        ...verse,
        alignment: undefined,
      })),
    });
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

  const state = useMemo<VideoState>(() => ({
    poem: timelinePoem,
    recording: selectedRecording,
    template,
    aspectRatio,
    backgroundType,
    backgroundImageUrl,
    backgroundImageElement,
    fontScale,
    textColor: "#f7f4ec", // parchment-100
    overlayOpacity,
    events,
    style: videoStyle,
  }), [
    timelinePoem, selectedRecording, template, aspectRatio, backgroundType,
    backgroundImageUrl, backgroundImageElement, fontScale, overlayOpacity, events,
    videoStyle,
  ]);

  const {
    isExporting,
    progress,
    exportError,
    exportMessage,
    startExport,
    cancelExport,
    exportTimeMsRef,
    renderAtRef,
  } = useVideoExport();

  const handleApplyPreset = (preset: VideoPreset) => {
    setTemplate(preset.template);
    setAspectRatio(preset.aspectRatio);
    setBackgroundType(preset.backgroundType);
    setVideoStyle((current) => ({ ...current, ...preset.styleOverrides }));
  };

  const selectCapturedVoice = (captured: {
    audioPath: string;
    durationMs: number;
    fileName: string;
  }) => {
    if (!selectedPoem) {
      URL.revokeObjectURL(captured.audioPath);
      return;
    }
    const recording: Recording = {
      id: `video-voice-${Date.now()}`,
      poemId: selectedPoem.id,
      title: captured.fileName,
      reciter: "تسجيل بصوتي",
      audioPath: captured.audioPath,
      durationMs: captured.durationMs,
      createdAt: new Date().toISOString(),
    };
    setCustomRecording(recording);
    setSelectedRecordingId(recording.id);
  };

  const {
    isRecording,
    elapsedMs: recordingElapsedMs,
    recordingError,
    startRecording,
    stopRecording,
  } = useMicrophoneRecorder({ onComplete: selectCapturedVoice });
  const {
    highlightedWordCount,
    guideMode,
  } = useLiveRecitationGuide(selectedPoem, isRecording);

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

  const handlePickAudio = async () => {
    setAudioPickError(null);
    const picked = await pickAudioFile();
    if (!picked || !selectedPoem) return;

    if (picked.size && picked.size > 250 * 1024 * 1024) {
      if (picked.path.startsWith("blob:")) URL.revokeObjectURL(picked.path);
      setAudioPickError("حجم الملف الصوتي يجب ألا يتجاوز 250 ميجابايت.");
      return;
    }

    try {
      const durationMs = await readAudioDuration(picked.path);
      const recording: Recording = {
        id: `video-local-${Date.now()}`,
        poemId: selectedPoem.id,
        title: picked.name,
        reciter: "ملف صوتي محلي",
        audioPath: picked.path,
        durationMs,
        createdAt: new Date().toISOString(),
      };
      setCustomRecording(recording);
      setSelectedRecordingId(recording.id);
    } catch {
      if (picked.path.startsWith("blob:")) URL.revokeObjectURL(picked.path);
      setAudioPickError("تعذر قراءة الملف الصوتي. اختر MP3 أو WAV أو M4A أو OGG صالحاً.");
    }
  };

  const handleExport = async () => {
    if (!selectedRecording || isPreparingExport || isExporting) return;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="video-preview-canvas"]');
    if (!canvas) return;

    setIsPreparingExport(true);
    setFontLoadError(null);

    try {
      await loadVideoFonts(videoStyle);
    } catch (e) {
      console.error("Font loading failed", e);
      setFontLoadError("تعذر تحميل خطوط الفيديو. يرجى المحاولة مرة أخرى.");
      setIsPreparingExport(false);
      return;
    }

    // Use total duration which might extend past audio if we added an outro delay
    // Actually the video should just be the length of the audio, or max of audio and last event end
    const lastEventEnd = events.length > 0 ? events[events.length - 1].endMs : selectedRecording.durationMs;
    const durationMs = Math.max(selectedRecording.durationMs, lastEventEnd);

    try {
      await startExport(
        canvas,
        selectedRecording.audioPath,
        durationMs,
        renderAtRef,
        () => {},
        `${selectedPoem?.title || "فيديو قصيدة"}-${aspectRatio.replace(":", "x")}`
      );
    } catch (e) {
      console.log("Export failed/cancelled");
    } finally {
      setIsPreparingExport(false);
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

        <div className="p-4 flex flex-col gap-4 flex-1">
          <VideoSidebarCard title="القصيدة والصوت" icon={Music}>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-2">القصيدة</label>
                <select
                  className="w-full bg-charcoal-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-parchment-100 focus:border-accent-700 focus:outline-none"
                  value={selectedPoemId}
                  onChange={e => setSelectedPoemId(e.target.value)}
                  disabled={isExporting || isPreparingExport}
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
                    disabled={isExporting || isPreparingExport}
                  >
                    {usableRecordings.length === 0 && <option value="">لا توجد تسجيلات صالحة</option>}
                    {customRecording && (
                      <option value={customRecording.id}>
                        {customRecording.title} (ملف مختار)
                      </option>
                    )}
                    {usableRecordings.map(r => {
                      const hasAlign = selectedPoem.verses.every(v => v.alignment?.recordingId === r.id);
                      return (
                        <option key={r.id} value={r.id}>
                          {r.title} {hasAlign ? '(مُزامن)' : '(بدون مزامنة)'}
                        </option>
                      );
                    })}
                  </select>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePickAudio}
                      disabled={isExporting || isPreparingExport || isRecording}
                      data-testid="button-pick-video-audio"
                      className="rounded-xl border border-dashed border-accent-700/40 bg-accent-700/5 px-3 py-2.5 text-xs font-ui text-accent-500 hover:bg-accent-700/10 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      ملف صوتي
                    </button>
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isExporting || isPreparingExport}
                      data-testid="button-record-video-audio"
                      className={`rounded-xl border px-3 py-2.5 text-xs font-ui transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                        isRecording
                          ? "border-crimson-500/50 bg-crimson-500/15 text-crimson-500"
                          : "border-white/10 bg-white/5 text-parchment-100 hover:bg-white/10"
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          إيقاف {formatRecordingTime(recordingElapsedMs)}
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 text-accent-700" />
                          تسجيل صوتي
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-ink-600">
                    يمكنك تسجيل صوتك مباشرة لمدة تصل إلى 5 دقائق.
                  </p>
                  {(audioPickError || recordingError) && (
                    <p className="mt-2 text-[11px] text-crimson-500" role="alert">
                      {audioPickError || recordingError}
                    </p>
                  )}
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
            </div>
          </VideoSidebarCard>

          <VideoSidebarCard title="مظاهر جاهزة" icon={Palette} defaultOpen={false}>
            <VideoStylePresets onSelect={handleApplyPreset} disabled={isExporting || isPreparingExport} />
          </VideoSidebarCard>

          <VideoSidebarCard title="تنسيق الفيديو والمقاسات" icon={Settings2}>
            <div className="flex flex-col gap-5">
              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-3">أبعاد الفيديو</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["16:9", "9:16"] as AspectRatio[]).map(ratio => (
                    <button
                      key={ratio}
                      disabled={isExporting || isPreparingExport}
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
              </div>

              {/* Template */}
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-3">قالب الفيديو الأساسي</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "classic", name: "كلاسيكي", desc: "أنيق وهادئ" },
                    { id: "cinematic", name: "سينمائي", desc: "عمق ودراما" },
                    { id: "manuscript", name: "مخطوطة", desc: "طابع أثري" },
                    { id: "minimalist", name: "بسيط", desc: "نقي وحديث" },
                    { id: "calligraphy", name: "ديواني", desc: "حركة وخط" }
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      disabled={isExporting || isPreparingExport}
                      onClick={() => setTemplate(t.id)}
                      className={`px-3 py-2.5 rounded-xl text-right transition-all flex flex-col gap-1 border active:scale-[0.98] ${
                        template === t.id
                          ? "bg-accent-700/10 text-accent-500 border-accent-700/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                          : "bg-charcoal-950 text-ink-500 border-white/5 hover:bg-charcoal-900 hover:border-white/10 hover:text-parchment-100"
                      } ${t.id === "classic" ? "col-span-2" : ""}`}
                    >
                      <span className="text-sm font-bold font-poetry">{t.name}</span>
                      <span className="text-[10px] opacity-70 font-sans">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-3">الخلفية</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    disabled={isExporting || isPreparingExport}
                    onClick={() => setBackgroundType("gradient")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      backgroundType === "gradient" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                    }`}
                  >
                    تدرج لوني
                  </button>
                  <button
                    disabled={isExporting || isPreparingExport}
                    onClick={() => setBackgroundType("particles")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      backgroundType === "particles" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                    }`}
                  >
                    جزيئات
                  </button>
                  <button
                    disabled={isExporting || isPreparingExport}
                    onClick={() => setBackgroundType("solid")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      backgroundType === "solid" ? "bg-accent-700/10 text-accent-500 border-accent-700/30" : "bg-charcoal-950 text-ink-500 border-white/5"
                    }`}
                  >
                    لون صلب
                  </button>
                  <button
                    disabled={isExporting || isPreparingExport}
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
                      disabled={isExporting || isPreparingExport}
                      onClick={() => document.getElementById("video-bg-upload")?.click()}
                      className="text-xs text-accent-500 hover:text-accent-400"
                    >
                      تغيير الصورة
                    </button>
                  </div>
                )}
              </div>
            </div>
          </VideoSidebarCard>

          <VideoSidebarCard title="تخصيص العرض والخطوط" icon={PlaySquare}>
            <VideoStyleControls
              style={videoStyle}
              onChange={setVideoStyle}
              disabled={isExporting || isPreparingExport}
            />
            <hr className="border-white/5 my-4" />
            <div className="flex flex-col gap-4">
              <div>
                <label className="flex justify-between text-xs font-bold text-ink-500 mb-2">
                  <span>حجم النص الإضافي</span>
                  <span>{Math.round(fontScale * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.5" max="2.0" step="0.1"
                  value={fontScale}
                  onChange={e => setFontScale(parseFloat(e.target.value))}
                  disabled={isExporting || isPreparingExport}
                  className="w-full accent-accent-700 h-2 bg-charcoal-950 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-bold text-ink-500 mb-2">
                  <span>تعتيم الخلفية</span>
                  <span>{Math.round(overlayOpacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0" max="0.9" step="0.1"
                  value={overlayOpacity}
                  onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                  disabled={isExporting || isPreparingExport}
                  className="w-full accent-accent-700 h-2 bg-charcoal-950 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </VideoSidebarCard>
        </div>

        {/* Action Button */}
        <div className="p-6 border-t border-white/5 shrink-0 bg-charcoal-900/50 backdrop-blur-md">
          {(exportError || exportMessage || fontLoadError) && (
            <div
              className={`mb-3 rounded-xl border p-3 text-xs font-ui flex items-start gap-2 ${
                (exportError || fontLoadError)
                  ? "border-crimson-500/30 bg-crimson-500/10 text-crimson-500"
                  : "border-accent-700/30 bg-accent-700/10 text-accent-500"
              }`}
              role="status"
              data-testid="status-video-export"
            >
              {(exportError || fontLoadError) ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{fontLoadError || exportError || exportMessage}</span>
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
          ) : isPreparingExport ? (
            <button
              disabled
              className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-accent-700/50 text-charcoal-950/50 cursor-wait shadow-[0_0_20px_rgba(212,175,55,0.1)]"
            >
              <div className="w-5 h-5 border-2 border-charcoal-950/20 border-t-charcoal-950/80 rounded-full animate-spin" />
              جاري التجهيز...
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={!selectedRecording || !selectedPoem || isLoadingAlignment || isRecording}
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
        renderAtRef={renderAtRef}
        isExporting={isExporting}
        exportProgress={progress}
        isVoiceRecording={isRecording}
        recitationWordCount={highlightedWordCount}
        recitationGuideMode={guideMode}
      />
    </div>
  );
};

async function readAudioDuration(audioPath: string): Promise<number> {
  const playableSource = await resolveAudioSrcAsync(audioPath);
  return new Promise((resolve, reject) => {
    const audio = new Audio(playableSource);
    const timeout = window.setTimeout(() => {
      audio.src = "";
      reject(new Error("audio-timeout"));
    }, 15_000);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const durationMs = Math.round(audio.duration * 1000);
      audio.src = "";
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        reject(new Error("invalid-duration"));
        return;
      }
      resolve(durationMs);
    };
    audio.onerror = () => {
      window.clearTimeout(timeout);
      audio.src = "";
      reject(new Error("audio-load-failed"));
    };
  });
}

function formatRecordingTime(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
