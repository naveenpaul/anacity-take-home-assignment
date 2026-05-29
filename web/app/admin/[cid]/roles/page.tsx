import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { apiGet } from '../../../lib/api';
import { effectiveMemberships, getCurrentUser } from '../../../lib/auth';
import RolesManager from './roles-manager';

type Role = {
  id: string;
  name: string;
  description: string | null;
  templateKey: string | null;
  permissions: string[];
};

type Permission = { id: string; key: string };

export default async function RolesAdminPage({ params }: { params: { cid: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const membership = effectiveMemberships(me).find((m) => m.community.id === params.cid);
  if (!membership) notFound();

  const [roles, permissions] = await Promise.all([
    apiGet<Role[]>(`/communities/${params.cid}/roles`),
    apiGet<Permission[]>('/permissions'),
  ]);

  if (!roles || !permissions) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Permission denied</h1>
        <p className="text-sm text-ink-secondary">
          You don't have <code className="font-mono">assign_roles</code> in this
          community.
        </p>
        <Link href="/home" className="text-sm hover:underline" style={{ color: 'var(--brand-primary)' }}>
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
          <Link
            href={`/c/${params.cid}`}
            className="hover:text-ink transition-colors"
          >
            {membership.community.name}
          </Link>
          <span>/</span>
          <span className="text-ink-secondary">Roles</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        <p className="text-sm text-ink-secondary max-w-xl">
          Create custom roles or edit instantiated ones. Permissions are flat
          keys — changes take effect on the granted user's next request, no
          deployment.
        </p>
      </div>

      <RolesManager
        communityId={params.cid}
        initialRoles={roles}
        permissions={permissions.map((p) => p.key)}
      />

      <p className="text-xs text-ink-tertiary border-t border-line pt-4">
        Next:{' '}
        <Link
          href={`/admin/${params.cid}/memberships`}
          className="hover:underline"
          style={{ color: 'var(--brand-primary)' }}
        >
          assign these roles to users
        </Link>
        .
      </p>
    </div>
  );
}
