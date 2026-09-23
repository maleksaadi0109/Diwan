import { Poem, Recording } from "@/types";
import { VideoTimelineEvent } from "./types";

export function generateTimeline(poem: Poem, recording: Recording): VideoTimelineEvent[] {
  const duration = recording.durationMs;
  const events: VideoTimelineEvent[] = [];
  
  if (poem.verses.length === 0) {
    events.push({ type: 'intro', startMs: 0, endMs: duration });
    return events;
  }

  // Check if *every* verse has an alignment. If any verse is missing alignment, we must fallback.
  // Sometimes alignment is present but status is 'auto' or 'review'. As long as startMs and endMs exist, we can use it.
  let previousEnd = 0;
  const hasAlignment = poem.verses.every((verse) => {
    const alignment = verse.alignment;
    if (
      alignment?.recordingId !== recording.id ||
      !Number.isFinite(alignment.startMs) ||
      !Number.isFinite(alignment.endMs) ||
      alignment.startMs < previousEnd ||
      alignment.endMs <= alignment.startMs ||
      alignment.endMs > duration
    ) {
      return false;
    }
    previousEnd = alignment.endMs;
    return true;
  });
  
  if (hasAlignment) {
    const firstVerseStart = poem.verses[0].alignment!.startMs;
    events.push({ type: 'intro', startMs: 0, endMs: firstVerseStart });
    
    poem.verses.forEach(v => {
      events.push({ type: 'verse', startMs: v.alignment!.startMs, endMs: v.alignment!.endMs, verse: v });
    });
    
    const lastVerseEnd = poem.verses[poem.verses.length - 1].alignment!.endMs;
    events.push({ type: 'outro', startMs: lastVerseEnd, endMs: Math.max(duration, lastVerseEnd + 3000) });
  } else {
    // Equal timing fallback
    // Calculate intro/outro up to 3 seconds, but at most 10% of duration each if duration is short.
    const introDuration = Math.min(3000, duration * 0.1);
    const outroDuration = Math.min(3000, duration * 0.1);
    const available = Math.max(0, duration - introDuration - outroDuration);
    
    events.push({ type: 'intro', startMs: 0, endMs: introDuration });
    
    if (available > 0) {
      const timePerVerse = available / poem.verses.length;
      poem.verses.forEach((v, i) => {
        const start = introDuration + i * timePerVerse;
        events.push({ type: 'verse', startMs: start, endMs: start + timePerVerse, verse: v });
      });
    }
    
    events.push({ type: 'outro', startMs: duration - outroDuration, endMs: Math.max(duration, duration + 1000) });
  }
  
  return events;
}
