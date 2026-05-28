import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { apiGet } from '../../../lib/api';
import { getCurrentUser } from '../../../lib/auth';
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

export default async function MembershipsAdminPage({ params }: { params: { cid: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const membership = me.memberships.find((m) => m.community.id === params.cid);
  if (!membership) notFound();

  const [memberships, roles, blocks] = await Promise.all([
    apiGet<Membership[]>(`/communities/${params.cid}/memberships`),
    apiGet<Array<Role & { permissions: string[] }>>(`/communities/${params.cid}/roles`),
    apiGet<Block[]>(`/communities/${params.cid}/blocks`).catch(() => null),
  ]);

  if (!memberships || !roles) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Permission denied</h2>
        <p className="text-sm text-gray-600">
          You don&apos;t have <code>assign_roles</code> in this community.
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
          {' · '}
          <Link href={`/admin/${params.cid}/roles`} className="hover:underline">
            Roles
          </Link>
        </p>
        <h2 className="text-2xl font-semibold mt-2">Memberships · {membership.community.name}</h2>
        <p className="text-sm text-gray-500">
          Assign or revoke roles per user. Block scope is optional — leave blank
          for community-wide.
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
