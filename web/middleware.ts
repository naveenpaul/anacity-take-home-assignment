import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const hostname = host.split(':')[0] ?? '';
  const parts = hostname.split('.');
  const slug = parts.length > 1 ? parts[0] : '';

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-slug', slug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
