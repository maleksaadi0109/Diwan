import { useEffect } from 'react';
import { VideoState } from './types';
import { wrapArabicText } from './textLayoutUtils';
import { DEFAULT_VIDEO_STYLE, getVideoFont, getVideoPalette } from './videoStyles';

export function useVideoRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  state: VideoState,
  audioElement: HTMLAudioElement | null,
  exportTimeMsRef: React.MutableRefObject<number | null>,
  previewPlaying: boolean
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = 0;

    const render = (now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const videoStyle = state.style || DEFAULT_VIDEO_STYLE;
      const palette = getVideoPalette(videoStyle);
      let timeMs = 0;
      
      if (exportTimeMsRef.current !== null) {
        timeMs = exportTimeMsRef.current;
      } else if (audioElement) {
        timeMs = audioElement.currentTime * 1000;
        // if paused and not exporting, just use the current fixed time
      } else {
        timeMs = 0; // fallback if no audio selected
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Background
      if (state.backgroundType === 'solid') {
        ctx.fillStyle = palette.background;
        ctx.fillRect(0, 0, width, height);
      } else if (state.backgroundType === 'gradient') {
        const pan = (timeMs / 10000) % (Math.PI * 2);
        const x1 = width/2 + Math.cos(pan) * width;
        const y1 = height/2 + Math.sin(pan) * height;
        const x2 = width/2 - Math.cos(pan) * width;
        const y2 = height/2 - Math.sin(pan) * height;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, palette.background);
        grad.addColorStop(1, palette.secondary);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (state.backgroundType === 'particles') {
        ctx.fillStyle = palette.background;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = palette.accent;
        for(let i=0; i<80; i++) {
          const px = ((i * 137 + timeMs/50) % width);
          const py = ((i * 193 + timeMs/70) % height);
          ctx.beginPath();
          ctx.arc(px, py, (i%3)+1, 0, Math.PI*2);
          ctx.globalAlpha = 0.5 + (Math.sin(timeMs/500 + i) * 0.5);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      } else if (state.backgroundType === 'image' && state.backgroundImageElement) {
        // Ken burns effect
        const scale = 1.0 + (timeMs / 120000); 
        const imgAspect = state.backgroundImageElement.width / state.backgroundImageElement.height;
        const canvasAspect = width / height;
        
        let sWidth = width;
        let sHeight = height;
        
        if (imgAspect > canvasAspect) {
          sWidth = height * imgAspect;
        } else {
          sHeight = width / imgAspect;
        }
        
        const sdw = sWidth * scale;
        const sdh = sHeight * scale;
        const sdx = (width - sdw) / 2;
        const sdy = (height - sdh) / 2;

        ctx.drawImage(state.backgroundImageElement, sdx, sdy, sdw, sdh);
      }

      drawTemplateBackdrop(ctx, state.template, width, height, timeMs);

      // Overlay
      ctx.fillStyle = `rgba(10, 11, 14, ${state.overlayOpacity})`;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Text
      if (state.poem && state.events.length > 0) {
        const currentEvent = state.events.find(e => timeMs >= e.startMs && timeMs < e.endMs);
        
        if (currentEvent) {
          const eventTime = timeMs - currentEvent.startMs;
          const fadeDuration = 800;
          const shouldAnimateText = previewPlaying || exportTimeMsRef.current !== null;
          const opacity = shouldAnimateText ? Math.min(1, eventTime / fadeDuration) : 1;

          const timeRemaining = currentEvent.endMs - timeMs;
          const fadeOut = shouldAnimateText ? Math.min(1, timeRemaining / fadeDuration) : 1;

          ctx.globalAlpha = opacity * fadeOut;

          // Template-specific configuration
          const is169 = state.aspectRatio === '16:9';
          let baseFontSize = (is169 ? 64 : 72) * state.fontScale;
          let titleFamily: string = getVideoFont(videoStyle).family;
          let bodyFamily: string = titleFamily;
          let titleColor: string = palette.text;
          let bodyColor: string = palette.text;
          let templateScale = 1.0;
          let templateX = 0;
          let templateY = 0;
          let templateShadowBlur = 0;
          let templateShadowColor = 'transparent';

          const eventDuration = currentEvent.endMs - currentEvent.startMs;
          const progress = eventDuration > 0 ? (eventTime / eventDuration) : 0;

          if (shouldAnimateText) {
            if (videoStyle.motion === "rise") {
              templateY += (1 - opacity) * 56;
            } else if (videoStyle.motion === "zoom") {
              templateScale *= 0.9 + opacity * 0.1;
            }
          }

          if (state.template === 'cinematic') {
            templateScale = 1.0 + (progress * 0.15);
            templateShadowBlur = 40;
            templateShadowColor = 'rgba(0, 0, 0, 0.9)';
            titleColor = palette.text;
            bodyColor = palette.text;
          } else if (state.template === 'manuscript') {
            titleColor = palette.text;
            bodyColor = palette.text;
            templateShadowBlur = 10;
            templateShadowColor = 'rgba(20, 10, 0, 0.8)';
            templateY = Math.sin(progress * Math.PI) * -20;
          } else if (state.template === 'minimalist') {
            titleFamily = getVideoFont(videoStyle).family;
            bodyFamily = getVideoFont(videoStyle).family;
            titleColor = palette.text;
            bodyColor = palette.text;
            if (eventTime < fadeDuration) {
              templateY = (1 - opacity) * 40;
            } else if (timeRemaining < fadeDuration) {
              templateY = -(1 - fadeOut) * 40;
            }
          } else if (state.template === 'calligraphy') {
            titleColor = palette.accent;
            bodyColor = palette.accent;
            templateScale = 1.05 + (progress * 0.08);
            templateX = (progress - 0.5) * 50;
            baseFontSize *= 1.15;
            templateShadowBlur = 15;
            templateShadowColor = 'rgba(0,0,0,0.5)';
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.direction = 'rtl';

          ctx.save();
          ctx.translate(width / 2, height / 2);
          ctx.scale(templateScale, templateScale);
          ctx.translate(-width / 2 + templateX, -height / 2 + templateY);

          ctx.shadowBlur = templateShadowBlur;
          ctx.shadowColor = templateShadowColor;

          if (currentEvent.type === 'intro') {
            const titleLayout = fitTextBlock(
              ctx,
              state.poem.title,
              width * (videoStyle.safeArea && !is169 ? 0.7 : 0.82),
              height * (videoStyle.safeArea && !is169 ? 0.26 : 0.32),
              baseFontSize * 1.5,
              baseFontSize * 0.65,
              "bold",
              titleFamily,
              videoStyle.lineHeight
            );

            ctx.fillStyle = titleColor;
            drawCenteredLines(
              ctx,
              titleLayout.lines,
              width / 2,
              height / 2 - baseFontSize,
              titleLayout.lineHeight
            );

            if (state.template === 'manuscript' || state.template === 'calligraphy') {
               ctx.fillStyle = titleColor;
               const yLine = height / 2 - baseFontSize + (titleLayout.lines.length * titleLayout.lineHeight * 0.5);
               ctx.fillRect(width/2 - 120, yLine + 20, 240, 3);
            }

            ctx.font = `${Math.max(baseFontSize * 0.75, 34)}px ${getVideoFont(videoStyle).family}`;
            ctx.fillStyle = state.template === 'minimalist' ? palette.text : palette.accent;
            ctx.fillText(
              state.poem.poet.name,
              width / 2,
              height / 2 + titleLayout.lines.length * titleLayout.lineHeight * 0.55 + baseFontSize
            );
          } else if (currentEvent.type === 'verse' && currentEvent.verse) {
            const verseLayout = fitTextBlock(
              ctx,
              currentEvent.verse.text,
              width * (videoStyle.safeArea && !is169 ? 0.68 : 0.85),
              height * (videoStyle.safeArea && !is169 ? 0.46 : 0.58),
              baseFontSize,
              Math.max(30, baseFontSize * 0.48),
              "bold",
              bodyFamily,
              videoStyle.lineHeight
            );
            ctx.fillStyle = bodyColor;
            drawCenteredLines(
              ctx,
              verseLayout.lines,
              width / 2,
              height / 2,
              verseLayout.lineHeight
            );
          } else if (currentEvent.type === 'outro') {
            ctx.font = `bold ${baseFontSize * 1.8}px ${titleFamily}`;
            ctx.fillStyle = titleColor;
            ctx.fillText("دِيـــوَان", width/2, height/2);
            ctx.font = `${baseFontSize * 0.6}px "Cairo", sans-serif`;
            ctx.fillStyle = state.template === 'minimalist' ? palette.text : palette.accent;
            ctx.fillText("شعر عربي ومحاذاة صوتية", width/2, height/2 + (baseFontSize * 1.5));
          }
          
          ctx.restore();
          ctx.globalAlpha = 1.0;

          if (videoStyle.signature.trim()) {
            const signature = videoStyle.signature.trim();
            ctx.save();
            ctx.direction = /^[\s@A-Za-z0-9_.-]+$/.test(signature) ? "ltr" : "rtl";
            ctx.textAlign = "center";
            ctx.font = `700 ${Math.max(28, width * 0.028)}px "Diwan Cairo", sans-serif`;
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = 0.88;
            ctx.fillText(signature, width / 2, height * (is169 ? 0.92 : 0.86));
            ctx.restore();
          }

          if (videoStyle.showProgress && state.recording?.durationMs) {
            const totalProgress = Math.max(0, Math.min(1, timeMs / state.recording.durationMs));
            const barWidth = width * (is169 ? 0.72 : 0.58);
            const barHeight = Math.max(5, height * 0.004);
            const barX = (width - barWidth) / 2;
            const barY = height * (is169 ? 0.965 : 0.91);
            ctx.save();
            ctx.fillStyle = "rgba(255,255,255,0.16)";
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth, barHeight, barHeight / 2);
            ctx.fill();
            ctx.fillStyle = palette.accent;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth * totalProgress, barHeight, barHeight / 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Continue loop if exporting or playing
      // (Even if paused, running the loop at 60fps is fine for preview updates when changing styles)
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationId);
  }, [canvasRef, state, audioElement, exportTimeMsRef, previewPlaying]);
}

function drawTemplateBackdrop(
  ctx: CanvasRenderingContext2D,
  template: VideoState["template"],
  width: number,
  height: number,
  timeMs: number
) {
  const phase = timeMs / 1000;
  ctx.save();

  if (template === "classic") {
    const glowX = width * (0.5 + Math.sin(phase * 0.18) * 0.22);
    const glowY = height * (0.42 + Math.cos(phase * 0.14) * 0.12);
    const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, width * 0.52);
    glow.addColorStop(0, "rgba(212, 175, 55, 0.13)");
    glow.addColorStop(1, "rgba(212, 175, 55, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  } else if (template === "cinematic") {
    const sweepX = ((phase * 90) % (width * 1.6)) - width * 0.3;
    const sweep = ctx.createLinearGradient(sweepX - width * 0.25, 0, sweepX + width * 0.25, height);
    sweep.addColorStop(0, "rgba(0,0,0,0)");
    sweep.addColorStop(0.5, "rgba(77, 116, 168, 0.22)");
    sweep.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, width, height * 0.055);
    ctx.fillRect(0, height * 0.945, width, height * 0.055);
  } else if (template === "manuscript") {
    ctx.fillStyle = "rgba(112, 74, 31, 0.18)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(232, 213, 165, 0.12)";
    ctx.lineWidth = 2;
    const offset = (phase * 18) % 70;
    for (let y = -70 + offset; y < height + 70; y += 70) {
      ctx.beginPath();
      ctx.moveTo(width * 0.08, y);
      ctx.quadraticCurveTo(width * 0.5, y + Math.sin(y * 0.01 + phase) * 12, width * 0.92, y);
      ctx.stroke();
    }
  } else if (template === "minimalist") {
    const travel = (phase * 0.08) % 1;
    ctx.fillStyle = "rgba(41, 196, 169, 0.13)";
    ctx.fillRect(width * travel - width * 0.18, 0, width * 0.18, height);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, height * (0.18 + Math.sin(phase * 0.35) * 0.04), width, 2);
    ctx.fillRect(0, height * (0.82 + Math.cos(phase * 0.3) * 0.04), width, 2);
  } else {
    ctx.translate(width / 2, height / 2);
    ctx.rotate(phase * 0.025);
    ctx.strokeStyle = "rgba(212, 175, 55, 0.2)";
    ctx.lineWidth = Math.max(3, width * 0.003);
    for (let index = 0; index < 4; index += 1) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        width * (0.22 + index * 0.1),
        height * (0.16 + index * 0.08),
        index * 0.45 + Math.sin(phase * 0.2) * 0.12,
        0,
        Math.PI * 1.55
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}

function fitTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  initialSize: number,
  minimumSize: number,
  weight: string,
  family: string,
  lineHeightRatio = 1.55
): { lines: string[]; lineHeight: number } {
  let size = initialSize;
  let lines: string[] = [];
  let lineHeight = size * lineHeightRatio;

  while (size >= minimumSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrapArabicText(ctx, text, maxWidth);
    lineHeight = size * lineHeightRatio;
    if (lines.length * lineHeight <= maxHeight) break;
    size -= Math.max(2, initialSize * 0.05);
  }

  return { lines, lineHeight };
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  centerY: number,
  lineHeight: number
) {
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + index * lineHeight);
  });
}
