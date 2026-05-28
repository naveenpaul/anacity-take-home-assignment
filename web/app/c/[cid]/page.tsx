import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { apiGet } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import UnitsBoard from './units-board';

type Block = { id: string; name: string };
type Unit = { id: string; label: string; block: { id: string; name: string } };
type MyContext = { permissions: string[] };
type Action = {
  id: string;
  unitId: string;
  unitLabel: string;
  actionType: string;
  metadata: Record<string, unknown>;
  actor: { id: string; name: string; email: string };
  createdAt: string;
};

export default async function CommunityPage({ params }: { params: { cid: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const membership = me.memberships.find((m) => m.community.id === params.cid);
  if (!membership) notFound();

  const [units, myCtx, recent, actionTypes] = await Promise.all([
    apiGet<Unit[]>(`/communities/${params.cid}/units`),
    apiGet<MyContext>(`/communities/${params.cid}/me`),
    apiGet<Action[]>(`/communities/${params.cid}/actions?limit=25`),
    apiGet<string[]>(`/communities/${params.cid}/action-types`),
  ]);

  if (!units || !myCtx || !recent || !actionTypes) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Failed to load community</h2>
        <Link href="/home" className="text-blue-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  // Group units by block.
  const byBlock = new Map<string, { block: Block; units: Unit[] }>();
  for (const u of units) {
    const entry = byBlock.get(u.block.id) ?? { block: u.block, units: [] };
    entry.units.push(u);
    byBlock.set(u.block.id, entry);
  }
  const blocks = Array.from(byBlock.values()).sort((a, b) => a.block.name.localeCompare(b.block.name));

  const isAdmin = membership.roles.some((r) => r.role.templateKey === 'admin');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          <Link href="/home" className="hover:underline">
            ← Home
          </Link>
          {isAdmin ? (
            <>
              {' · '}
              <Link href={`/admin/${params.cid}/roles`} className="hover:underline">
                Manage roles
              </Link>
              {' · '}
              <Link href={`/admin/${params.cid}/memberships`} className="hover:underline">
                Manage memberships
              </Link>
            </>
          ) : null}
        </p>
        <h2 className="text-2xl font-semibold mt-2">{membership.community.name}</h2>
        <p className="text-sm text-gray-500">
          {membership.roles.map((r) => r.role.name).join(', ')} ·{' '}
          {myCtx.permissions.length} permission(s) here
        </p>
      </div>

      <UnitsBoard
        communityId={params.cid}
        blocks={blocks}
        actionTypes={actionTypes}
        myPermissions={myCtx.permissions}
        initialActions={recent}
      />
    </div>
  );
}
