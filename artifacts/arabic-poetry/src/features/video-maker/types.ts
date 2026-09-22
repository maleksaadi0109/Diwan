import { Poem, Verse, Recording } from "@/types";

export interface VideoTimelineEvent {
  type: 'intro' | 'verse' | 'outro';
  startMs: number;
  endMs: number;
  verse?: Verse;
}

export type AspectRatio = '16:9' | '9:16';
export type BackgroundType = 'solid' | 'gradient' | 'particles' | 'image';

export interface VideoState {
  poem: Poem | null;
  recording: Recording | null;
  aspectRatio: AspectRatio;
  backgroundType: BackgroundType;
  backgroundImageUrl: string | null;
  backgroundImageElement: HTMLImageElement | null;
  fontScale: number;
  textColor: string;
  overlayOpacity: number;
  events: VideoTimelineEvent[];
}
