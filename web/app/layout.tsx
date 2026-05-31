import './globals.css';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { getCurrentUser } from './lib/auth';
import { getTenant } from './tenant';
import SiteHeader from './site-header';

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
  // No tenant resolved (bare host / landing) → fall back to the Anacity
  // product brand (violet from the wordmark) rather than neutral gray, so
  // the header, CTAs, and focus rings read as branded, not unstyled.
  const primary = tenant?.branding?.primaryColor ?? '#7A357A';

  // Hex (#RRGGBB) → rgba with 10% alpha for soft accent surfaces (badges, hover).
  const primarySoft = hexToSoftRgba(primary, 0.1);

  const cssVars = {
    ['--brand-primary' as string]: primary,
    ['--brand-primary-soft' as string]: primarySoft,
  } as React.CSSProperties;

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-surface text-ink antialiased" style={cssVars}>
        <SiteHeader
          tenant={
            tenant
              ? {
                  name: tenant.name,
                  slug: tenant.slug,
                  logo: tenant.branding?.logo ?? null,
                }
              : null
          }
          authed={!!me}
        />
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
