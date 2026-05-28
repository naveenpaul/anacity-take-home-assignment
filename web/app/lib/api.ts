import { cookies } from 'next/headers';

const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

/**
 * Server-side fetch against NestJS. Forwards the session cookie if present
 * so authed endpoints work from server components. Always uses no-store to
 * avoid stale auth state.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieHeader = cookies().toString();
  const headers = new Headers(init.headers ?? {});
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  const url = path.startsWith('http') ? path : `${API_INTERNAL}/v1${path}`;
  return fetch(url, { ...init, headers, cache: 'no-store' });
}

export async function apiGet<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path, { method: 'GET' });
  if (!res.ok) return null;
  return (await res.json()) as T;
}
