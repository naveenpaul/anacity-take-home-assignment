'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Tenant = { name: string; slug: string; logo?: string | null } | null;

/**
 * Global header. Hidden on the login screen — that surface uses the full
 * Anacity logo as its brand anchor, so a second square+name header above it
 * is redundant (and its only nav link doesn't render pre-auth anyway).
 *
 * When the tenant has a logo set (uploaded inline or a URL), it renders that;
 * otherwise it falls back to the brand-colored square + name. A broken/404
 * logo URL also falls back, so a stale path never shows a broken image.
 */
export default function SiteHeader({
  tenant,
  authed,
}: {
  tenant: Tenant;
  authed: boolean;
}) {
  const pathname = usePathname();
  const [logoBroken, setLogoBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A 404/invalid logo often errors before React attaches onError (the img
  // is server-rendered, the handler binds on hydration). Re-check on mount:
  // a finished load with zero natural width means it failed.
  useEffect(() => {
    setLogoBroken(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setLogoBroken(true);
  }, [tenant?.logo]);

  const showLogo = !!tenant?.logo && !logoBroken;

  return (
    <header className="border-b border-line">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={tenant!.logo as string}
              alt={tenant!.name}
              className="h-7 w-auto max-w-[160px] object-contain"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <>
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
            </>
          )}
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
