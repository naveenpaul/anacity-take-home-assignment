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
        <h2 className="text-2xl font-semibold">No tenant context</h2>
        <p className="text-sm text-gray-600">
          Visit this page via a tenant subdomain (e.g.{' '}
          <code>prestige.localhost:3000/admin/branding</code>).
        </p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Forbidden</h2>
        <p className="text-sm text-gray-600">
          You aren&apos;t a member of <strong>{tenant.name}</strong>.
        </p>
        <Link href="/home" className="text-blue-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          <Link href="/home" className="hover:underline">
            ← Home
          </Link>
        </p>
        <h2 className="text-2xl font-semibold mt-2">Branding · {detail.name}</h2>
        <p className="text-sm text-gray-500">
          Branding lives on the tenant, so it stays consistent across all of{' '}
          <strong>{detail.name}</strong>&apos;s communities. Changes apply on
          the next page load.
        </p>
      </div>

      <BrandingForm
        tenantName={detail.name}
        tenantSlug={detail.slug}
        initial={{
          logo: detail.branding?.logo ?? '',
          primaryColor: detail.branding?.primaryColor ?? '#6b7280',
          theme: detail.branding?.theme ?? 'default',
        }}
      />
    </div>
  );
}
