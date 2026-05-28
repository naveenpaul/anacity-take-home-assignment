import './globals.css';
import type { Metadata } from 'next';
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
  const tenant = await getTenant();
  const primary = tenant?.branding?.primaryColor ?? '#6b7280';

  return (
    <html lang="en">
      <body style={{ ['--brand-primary' as string]: primary } as React.CSSProperties}>
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded"
              style={{ background: 'var(--brand-primary)' }}
            />
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                {tenant?.name ?? 'Anacity'}
              </h1>
              {tenant ? (
                <p className="text-xs text-gray-500">{tenant.slug}.localhost</p>
              ) : null}
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
