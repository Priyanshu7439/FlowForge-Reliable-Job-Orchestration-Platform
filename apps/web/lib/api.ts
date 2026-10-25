export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function responseMessage(status: number, code: string | undefined, message: unknown): string {
  if (typeof message === 'string' && message !== 'Request failed') return message;
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested API route is not available in the running service.';
  if (code === 'PROFILE_SCHEMA_UNAVAILABLE') return 'Profile storage is not ready. The profiles database migration must be applied before using profiles.';
  if (status >= 500) return 'The server could not complete this request. Try again or contact the administrator.';
  return 'Request failed';
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const externalAbort = () => controller.abort();
  options?.signal?.addEventListener('abort', externalAbort, { once: true });
  try {
    const response = await fetch(`${apiBase}${path}`, { ...options, credentials: 'include', signal: controller.signal, headers: { 'content-type': 'application/json', ...options?.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(responseMessage(response.status, body?.error?.code, body?.error?.message), response.status, body?.error?.code);
    return body as T;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw new ApiError('The API did not respond within 8 seconds. Check that the API service is running.', 408, 'REQUEST_TIMEOUT');
    throw cause;
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener('abort', externalAbort);
  }
}
