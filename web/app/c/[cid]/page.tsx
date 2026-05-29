import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { apiGet } from '../../lib/api';
import { effectiveMemberships, getCurrentUser } from '../../lib/auth';
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

  const membership = effectiveMemberships(me).find((m) => m.community.id === params.cid);
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Failed to load community
        </h1>
        <Link href="/home" className="text-sm hover:underline" style={{ color: 'var(--brand-primary)' }}>
          ← Back to home
        </Link>
      </div>
    );
  }

  const byBlock = new Map<string, { block: Block; units: Unit[] }>();
  for (const u of units) {
    const entry = byBlock.get(u.block.id) ?? { block: u.block, units: [] };
    entry.units.push(u);
    byBlock.set(u.block.id, entry);
  }
  const blocks = Array.from(byBlock.values()).sort((a, b) =>
    a.block.name.localeCompare(b.block.name),
  );

  const isAdmin = membership.roles.some((r) => r.role.templateKey === 'admin');

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-2 text-xs text-ink-tertiary">
          <Link href="/home" className="hover:text-ink transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-ink-secondary">{membership.community.name}</span>
          {isAdmin ? (
            <>
              <span className="ml-auto" />
              <Link
                href={`/admin/${params.cid}/roles`}
                className="hover:text-ink transition-colors"
              >
                Manage roles
              </Link>
              <span>·</span>
              <Link
                href={`/admin/${params.cid}/memberships`}
                className="hover:text-ink transition-colors"
              >
                Memberships
              </Link>
            </>
          ) : null}
        </nav>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {membership.community.name}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-ink-secondary">Your roles:</span>
          {membership.roles.map((r) => (
            <span
              key={r.membershipRoleId}
              className="px-2 py-0.5 rounded-full font-medium"
              style={{
                background: 'var(--brand-primary-soft)',
                color: 'var(--brand-primary)',
              }}
            >
              {r.role.name}
            </span>
          ))}
          <span className="text-ink-tertiary">
            · <span className="font-mono">{myCtx.permissions.length}</span> permission(s) here
          </span>
        </div>
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
