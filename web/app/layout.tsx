import './globals.css';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Link from 'next/link';
import { getCurrentUser } from './lib/auth';
import { getTenant } from './tenant';

export const metadata: Metadata = {
  title: 'Anacity',
  description: 'Multi-community management platform',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tenant, me] = await Promise.all([getTenant(), getCurrentUser()]);
  const primary = tenant?.branding?.primaryColor ?? '#525252';

  // Hex (#RRGGBB) → rgba with 10% alpha for soft accent surfaces (badges, hover).
  const primarySoft = hexToSoftRgba(primary, 0.1);

  const cssVars = {
    ['--brand-primary' as string]: primary,
    ['--brand-primary-soft' as string]: primarySoft,
  } as React.CSSProperties;

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-surface text-ink antialiased" style={cssVars}>
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
            {tenant && me ? (
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
        <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}

function hexToSoftRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(82, 82, 82, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
