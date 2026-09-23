import { describe, expect, it } from 'vitest';
import { getVideoExportProfile } from './videoExportProfile';

describe('video export profiles', () => {
  it('prefers the faster VP8 encoder and fewer frames on Windows desktop', () => {
    expect(getVideoExportProfile(true)).toMatchObject({
      frameRate: 24,
      chunkIntervalMs: 1000,
      progressIntervalMs: 250,
    });
    expect(getVideoExportProfile(true).mimeTypes[0]).toBe('video/webm;codecs=vp8,opus');
  });

  it('preserves the existing web and non-Windows settings', () => {
    expect(getVideoExportProfile(false)).toMatchObject({
      frameRate: 30,
      chunkIntervalMs: 100,
      progressIntervalMs: 100,
    });
    expect(getVideoExportProfile(false).mimeTypes[0]).toBe('video/webm;codecs=vp9,opus');
  });
});