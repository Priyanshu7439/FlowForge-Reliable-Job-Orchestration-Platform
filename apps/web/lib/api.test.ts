import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

describe('api client authentication', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('includes the session cookie on API requests', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ user: { id: 'user-1' } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await api('/auth/me');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/me'), expect.objectContaining({ credentials: 'include' }));
  });

  it.each([
    [401, 'Your session has expired. Sign in again.'],
    [403, 'You do not have permission to perform this action.'],
    [500, 'The server could not complete this request. Try again or contact the administrator.'],
  ])('maps HTTP %s without confusing it with authentication expiry', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));
    await expect(api('/profile')).rejects.toMatchObject({ status, message });
  });

  it('reports a profile schema prerequisite from the API error code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'PROFILE_SCHEMA_UNAVAILABLE' } }), { status: 503 })));
    await expect(api('/profile')).rejects.toEqual(expect.objectContaining({ status: 503, code: 'PROFILE_SCHEMA_UNAVAILABLE', message: 'Profile storage is not ready. The profiles database migration must be applied before using profiles.' } satisfies Partial<ApiError>));
  });
});
