import { headers } from 'next/headers';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  branding: { logo?: string; primaryColor?: string; theme?: string };
};

export async function getTenant(): Promise<Tenant | null> {
  const hdrs = headers();
  const slug = hdrs.get('x-tenant-slug');
  if (!slug) return null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/v1/tenants/resolve?slug=${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Tenant;
  } catch {
    return null;
  }
}
