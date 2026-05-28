'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function MembershipsManager({
  communityId,
  initialMemberships,
  roles,
  blocks,
}: {
  communityId: string;
  initialMemberships: Membership[];
  roles: Role[];
  blocks: Block[];
}) {
  const router = useRouter();
  const [memberships, setMemberships] = useState(initialMemberships);

  async function refresh() {
    const res = await fetch(`/api/v1/communities/${communityId}/memberships`, {
      credentials: 'include',
    });
    if (res.ok) {
      setMemberships(await res.json());
      router.refresh();
    }
  }

  async function revoke(mid: string, mrid: string) {
    if (!confirm('Revoke this role from this user?')) return;
    const res = await fetch(
      `/api/v1/communities/${communityId}/memberships/${mid}/roles/${mrid}`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-3">
      {memberships.map((m) => (
        <MembershipRow
          key={m.id}
          membership={m}
          roles={roles}
          blocks={blocks}
          onRevoke={revoke}
          onGrantSaved={refresh}
          communityId={communityId}
        />
      ))}
    </div>
  );
}

function MembershipRow({
  membership,
  roles,
  blocks,
  onRevoke,
  onGrantSaved,
  communityId,
}: {
  membership: Membership;
  roles: Role[];
  blocks: Block[];
  onRevoke: (mid: string, mrid: string) => void | Promise<void>;
  onGrantSaved: () => void | Promise<void>;
  communityId: string;
}) {
  const [granting, setGranting] = useState(false);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const [blockId, setBlockId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    setBusy(true);
    setError(null);
    const body: Record<string, string> = { roleId };
    if (blockId) body.blockId = blockId;
    const res = await fetch(
      `/api/v1/communities/${communityId}/memberships/${membership.id}/roles`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Grant failed');
      return;
    }
    setGranting(false);
    setBlockId('');
    await onGrantSaved();
  }

  return (
    <div className="border border-gray-200 rounded p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{membership.user.name}</h4>
          <p className="text-xs text-gray-500">{membership.user.email}</p>
        </div>
        <button
          onClick={() => setGranting((g) => !g)}
          className="text-sm text-blue-600 hover:underline"
        >
          {granting ? 'Cancel' : '+ Grant role'}
        </button>
      </div>

      {membership.roles.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No roles</p>
      ) : (
        <div className="space-y-1">
          {membership.roles.map((mr) => (
            <div
              key={mr.id}
              className="flex items-center justify-between text-sm border-l-2 pl-2"
              style={{ borderColor: 'var(--brand-primary)' }}
            >
              <div>
                <span className="font-medium">{mr.role.name}</span>
                {mr.block ? (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100">
                    scope: {mr.block.name}
                  </span>
                ) : null}
                {mr.unit ? (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100">
                    scope: unit {mr.unit.label}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => onRevoke(membership.id, mr.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {granting ? (
        <div className="border-t pt-3 space-y-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Role</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Scope (optional)</label>
              <select
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">(community-wide)</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={grant}
              disabled={busy || !roleId}
              className="px-3 py-1 rounded text-sm text-white disabled:opacity-50"
              style={{ background: 'var(--brand-primary)' }}
            >
              {busy ? '…' : 'Grant'}
            </button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
