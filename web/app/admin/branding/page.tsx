import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiGet } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import { getTenant } from '../../tenant';
import BrandingForm from './branding-form';

type TenantDetail = {
  id: string;
  slug: string;
  name: string;
  branding: { logo?: string; primaryColor?: string; theme?: string };
};

export default async function BrandingPage() {
  const [me, tenant, detail] = await Promise.all([
    getCurrentUser(),
    getTenant(),
    apiGet<TenantDetail>('/tenants/me'),
  ]);

  if (!me) redirect('/login');
  if (!tenant) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">No tenant context</h1>
        <p className="text-sm text-ink-secondary">
          Visit this page via a tenant subdomain (e.g.{' '}
          <code className="font-mono">prestige.localhost:3000/admin/branding</code>).
        </p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Forbidden</h1>
        <p className="text-sm text-ink-secondary">
          You aren't a member of <strong>{tenant.name}</strong>.
        </p>
        <Link
          href="/home"
          className="text-sm hover:underline"
          style={{ color: 'var(--brand-primary)' }}
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-2 text-xs text-ink-tertiary">
          <Link href="/home" className="hover:text-ink transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-ink-secondary">Brand settings</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Brand settings</h1>
        <p className="text-sm text-ink-secondary max-w-xl">
          Branding lives on the tenant, so it stays consistent across all of{' '}
          <strong>{detail.name}</strong>'s communities. Changes apply on the
          next page load.
        </p>
      </div>

      <BrandingForm
        tenantName={detail.name}
        tenantSlug={detail.slug}
        initial={{
          logo: detail.branding?.logo ?? '',
          primaryColor: detail.branding?.primaryColor ?? '#525252',
          theme: detail.branding?.theme ?? 'default',
        }}
      />
    </div>
  );
}
