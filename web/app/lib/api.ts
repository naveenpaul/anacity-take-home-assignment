import { cookies, headers as incomingHeaders } from 'next/headers';

const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

/**
 * Server-side fetch against NestJS. Forwards:
 *   - the session cookie (so authed endpoints work from server components)
 *   - the X-Tenant-Slug header set by the Next.js edge middleware
 *     (so tenant-scoped endpoints like /tenants/me resolve correctly,
 *     since direct fetches from a server component bypass the middleware
 *     that would otherwise inject it)
 * Always no-store to avoid stale auth state.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieHeader = cookies().toString();
  const tenantSlug = incomingHeaders().get('x-tenant-slug') ?? '';
  const headers = new Headers(init.headers ?? {});
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (tenantSlug) headers.set('x-tenant-slug', tenantSlug);
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
