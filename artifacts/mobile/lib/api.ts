/**
 * Helpers for talking to the shared artifacts/api-server YouTube import
 * pipeline (download -> align). See lib/api-spec/openapi.yaml for the
 * documented contract.
 */

export function apiDomain(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    throw new Error('EXPO_PUBLIC_DOMAIN is not set');
  }
  return domain;
}

/**
 * The download endpoint returns paths like "/api-worker/youtube/audio/<job>/playback.mp3".
 * That "/api-worker" prefix only exists for the desktop app's local dev proxy rewrite;
 * the real server route lives under "/api". Convert to a fetchable absolute URL.
 */
export function toPlayableAudioUrl(rawPath: string): string {
  const serverPath = rawPath.replace(/^\/api-worker\//, '/api/');
  return `https://${apiDomain()}${serverPath}`;
}

export function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybe = error as {
      error_message?: string;
      message?: string;
    };
    if (typeof maybe.error_message === 'string' && maybe.error_message) {
      return maybe.error_message;
    }
    if (typeof maybe.message === 'string' && maybe.message) {
      return maybe.message;
    }
  }
  return fallback;
}

/**
 * Error codes returned by artifacts/api-server's YouTube worker (see
 * artifacts/arabic-poetry/src/features/import/YouTubeImportView.tsx for the
 * matching desktop behavior) that mean "this video needs a logged-in
 * YouTube session" — the app should show a cookie-paste box and retry.
 */
const COOKIE_UNLOCK_CODES = new Set(['LOGIN_REQUIRED', 'COOKIES_INVALID']);

export function extractErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object') {
    const code = (error as { error_code?: string }).error_code;
    if (typeof code === 'string' && code) return code;
  }
  return null;
}

export function needsCookieUnlock(error: unknown): boolean {
  const code = extractErrorCode(error);
  return code !== null && COOKIE_UNLOCK_CODES.has(code);
}
