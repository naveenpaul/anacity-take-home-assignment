import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { apiGet } from '../../../lib/api';
import { effectiveMemberships, getCurrentUser } from '../../../lib/auth';
import MembershipsManager from './memberships-manager';

type Role = { id: string; name: string; templateKey: string | null };
type Block = { id: string; name: string };

type Membership = {
  id: string;
  status: string;
  user: { id: string; email: string; name: string };
  roles: Array<{
    id: string;
    role: Role;
    block: { id: string; name: string } | null;
    unit: { id: string; label: string } | null;
    grantedAt: string;
  }>;
};

export default async function MembershipsAdminPage({
  params,
}: {
  params: { cid: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const membership = effectiveMemberships(me).find((m) => m.community.id === params.cid);
  if (!membership) notFound();

  const [memberships, roles, blocks] = await Promise.all([
    apiGet<Membership[]>(`/communities/${params.cid}/memberships`),
    apiGet<Array<Role & { permissions: string[] }>>(`/communities/${params.cid}/roles`),
    apiGet<Block[]>(`/communities/${params.cid}/blocks`).catch(() => null),
  ]);

  if (!memberships || !roles) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Permission denied</h1>
        <p className="text-sm text-ink-secondary">
          You don't have <code className="font-mono">assign_roles</code> in this
          community.
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
          <Link
            href={`/c/${params.cid}`}
            className="hover:text-ink transition-colors"
          >
            {membership.community.name}
          </Link>
          <span>/</span>
          <Link
            href={`/admin/${params.cid}/roles`}
            className="hover:text-ink transition-colors"
          >
            Roles
          </Link>
          <span>/</span>
          <span className="text-ink-secondary">Memberships</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Memberships</h1>
        <p className="text-sm text-ink-secondary max-w-xl">
          Assign or revoke roles per user. Block scope is optional — leave
          blank for community-wide.
        </p>
      </div>

      <MembershipsManager
        communityId={params.cid}
        initialMemberships={memberships}
        roles={roles}
        blocks={blocks ?? []}
      />
    </div>
  );
}
