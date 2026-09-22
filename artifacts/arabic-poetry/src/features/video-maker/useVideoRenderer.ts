import { useEffect } from 'react';
import { VideoState } from './types';
import { wrapArabicText } from './textLayoutUtils';

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
        ctx.fillStyle = '#101217';
        ctx.fillRect(0, 0, width, height);
      } else if (state.backgroundType === 'gradient') {
        const pan = (timeMs / 10000) % (Math.PI * 2);
        const x1 = width/2 + Math.cos(pan) * width;
        const y1 = height/2 + Math.sin(pan) * height;
        const x2 = width/2 - Math.cos(pan) * width;
        const y2 = height/2 - Math.sin(pan) * height;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, '#101217');
        grad.addColorStop(1, '#2b303d');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (state.backgroundType === 'particles') {
        ctx.fillStyle = '#101217';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#d4af37';
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
          ctx.fillStyle = state.textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.direction = 'rtl';

          const is169 = state.aspectRatio === '16:9';
          const baseFontSize = (is169 ? 64 : 72) * state.fontScale;

          if (currentEvent.type === 'intro') {
            const titleLayout = fitTextBlock(
              ctx,
              state.poem.title,
              width * 0.82,
              height * 0.32,
              baseFontSize * 1.5,
              baseFontSize * 0.65,
              "bold",
              '"Amiri", serif'
            );
            drawCenteredLines(
              ctx,
              titleLayout.lines,
              width / 2,
              height / 2 - baseFontSize,
              titleLayout.lineHeight
            );
            ctx.font = `${Math.max(baseFontSize * 0.75, 34)}px "Cairo", sans-serif`;
            ctx.fillStyle = '#d4af37';
            ctx.fillText(
              state.poem.poet.name,
              width / 2,
              height / 2 + titleLayout.lines.length * titleLayout.lineHeight * 0.55 + baseFontSize
            );
          } else if (currentEvent.type === 'verse' && currentEvent.verse) {
            const verseLayout = fitTextBlock(
              ctx,
              currentEvent.verse.text,
              width * 0.85,
              height * 0.58,
              baseFontSize,
              Math.max(30, baseFontSize * 0.48),
              "bold",
              '"Amiri", serif'
            );
            drawCenteredLines(
              ctx,
              verseLayout.lines,
              width / 2,
              height / 2,
              verseLayout.lineHeight
            );
          } else if (currentEvent.type === 'outro') {
            ctx.font = `bold ${baseFontSize * 1.8}px "Amiri", serif`;
            ctx.fillText("دِيـــوَان", width/2, height/2);
            ctx.font = `${baseFontSize * 0.6}px "Cairo", sans-serif`;
            ctx.fillStyle = '#a0aab7';
            ctx.fillText("شعر عربي ومحاذاة صوتية", width/2, height/2 + (baseFontSize * 1.5));
          }
          
          ctx.globalAlpha = 1.0;
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

function fitTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  initialSize: number,
  minimumSize: number,
  weight: string,
  family: string
): { lines: string[]; lineHeight: number } {
  let size = initialSize;
  let lines: string[] = [];
  let lineHeight = size * 1.55;

  while (size >= minimumSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrapArabicText(ctx, text, maxWidth);
    lineHeight = size * 1.55;
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
