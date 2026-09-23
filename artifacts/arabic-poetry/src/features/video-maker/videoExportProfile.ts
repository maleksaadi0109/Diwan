const WEBM_VP9 = 'video/webm;codecs=vp9,opus';
const WEBM_VP8 = 'video/webm;codecs=vp8,opus';
const WEBM = 'video/webm';

export function isWindowsDesktop(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    && /Windows/i.test(navigator.userAgent);
}

export function getVideoExportProfile(windowsDesktop = isWindowsDesktop()) {
  return windowsDesktop
    ? {
        // WebView2 commonly encodes VP9 in software. VP8 and fewer canvas
        // draws keep recording closer to real time on Windows desktops.
        frameRate: 24,
        mimeTypes: [WEBM_VP8, WEBM_VP9, WEBM],
        chunkIntervalMs: 1000,
        progressIntervalMs: 250,
      }
    : {
        frameRate: 30,
        mimeTypes: [WEBM_VP9, WEBM_VP8, WEBM],
        chunkIntervalMs: 100,
        progressIntervalMs: 100,
      };
}