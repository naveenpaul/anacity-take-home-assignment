'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tenant = { name: string; slug: string } | null;

/**
 * Global header. Hidden on the login screen — that surface uses the full
 * Anacity logo as its brand anchor, so a second square+name header above it
 * is redundant (and its only nav link doesn't render pre-auth anyway).
 */
export default function SiteHeader({
  tenant,
  authed,
}: {
  tenant: Tenant;
  authed: boolean;
}) {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <header className="border-b border-line">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-6 h-6 rounded-sm"
            style={{ background: 'var(--brand-primary)' }}
          />
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">
              {tenant?.name ?? 'Anacity'}
            </span>
            {tenant ? (
              <span className="text-xs font-mono text-ink-tertiary">
                {tenant.slug}.localhost
              </span>
            ) : null}
          </div>
        </Link>
        {tenant && authed ? (
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/home"
              className="text-ink-secondary hover:text-ink transition-colors"
            >
              Home
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
