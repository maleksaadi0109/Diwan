import { afterEach, describe, expect, it, vi } from 'vitest';
import { stageDesktopAudio } from './useVideoExport';
import { resolveAudioSrcAsync } from '@/lib/audio/fileManager';

vi.mock('@/lib/audio/fileManager', () => ({
  resolveAudioSrcAsync: vi.fn(async (path: string) => path),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('desktop video audio staging', () => {
  const destination = '/app-data/export/audio.bin';
  const recording = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]);

  function mockAudioFetch() {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/wav' }),
      arrayBuffer: async () => recording.buffer,
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('uses an existing Windows recording file without fetching it', async () => {
    const exists = vi.fn(async () => true);
    const writeFile = vi.fn(async () => {});
    const fetchMock = mockAudioFetch();
    const path = 'C:\\Poems\\recording.wav';

    await expect(stageDesktopAudio(path, destination, exists, writeFile)).resolves.toBe(path);
    expect(exists).toHaveBeenCalledWith(path);
    expect(writeFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['/recordings/voice.wav', 'blob:recorded-voice'])(
    'stages playable audio from %s before invoking native FFmpeg',
    async (path) => {
      const fetchMock = mockAudioFetch();
      const writeFile = vi.fn(async () => {});

      await expect(stageDesktopAudio(path, destination, vi.fn(async () => false), writeFile))
        .resolves.toBe(destination);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(writeFile).toHaveBeenCalledWith(destination, recording);
      if (path.startsWith('/')) {
        expect(resolveAudioSrcAsync).not.toHaveBeenCalled();
      }
    },
  );

  it('does not fetch remote audio from another origin', async () => {
    const fetchMock = mockAudioFetch();
    await expect(stageDesktopAudio(
      'https://example.invalid/audio.wav',
      destination,
      vi.fn(async () => false),
      vi.fn(async () => {}),
    )).rejects.toThrow('مصدر خارجي');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses an existing Windows network recording and rejects inaccessible ones', async () => {
    const path = '\\\\server\\share\\recording.wav';
    const fetchMock = mockAudioFetch();
    const writeFile = vi.fn(async () => {});
    await expect(stageDesktopAudio(path, destination, vi.fn(async () => true), writeFile))
      .resolves.toBe(path);
    await expect(stageDesktopAudio(path, destination, vi.fn(async () => false), writeFile))
      .rejects.toThrow('تعذر الوصول');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects an HTML page returned for a missing recording path', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => new TextEncoder().encode('<html>missing</html>').buffer,
    })));
    await expect(stageDesktopAudio(
      '/recordings/missing.wav',
      destination,
      vi.fn(async () => false),
      vi.fn(async () => {}),
    )).rejects.toThrow('غير صالح');
  });
});