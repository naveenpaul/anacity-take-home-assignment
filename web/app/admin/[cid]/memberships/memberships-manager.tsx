'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = { id: string; name: string; templateKey: string | null };
type Block = { id: string; name: string };
type EligibleUser = { id: string; name: string; email: string };

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
  initialEligibleUsers,
}: {
  communityId: string;
  initialMemberships: Membership[];
  roles: Role[];
  blocks: Block[];
  initialEligibleUsers: EligibleUser[];
}) {
  const router = useRouter();
  const [memberships, setMemberships] = useState(initialMemberships);
  const [eligibleUsers, setEligibleUsers] = useState(initialEligibleUsers);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const [mRes, eRes] = await Promise.all([
      fetch(`/api/v1/communities/${communityId}/memberships`, { credentials: 'include' }),
      fetch(`/api/v1/communities/${communityId}/eligible-users`, { credentials: 'include' }),
    ]);
    if (mRes.ok) setMemberships(await mRes.json());
    if (eRes.ok) setEligibleUsers(await eRes.json());
    router.refresh();
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
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-ink-secondary">
          <span className="font-mono">{memberships.length}</span> member(s)
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-sm font-medium text-white rounded px-3 py-1.5"
          style={{ background: 'var(--brand-primary)' }}
        >
          + Add member
        </button>
      </div>

      <div className="space-y-2">
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

      {adding ? (
        <AddMemberDrawer
          communityId={communityId}
          eligibleUsers={eligibleUsers}
          roles={roles}
          blocks={blocks}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AddMemberDrawer({
  communityId,
  eligibleUsers,
  roles,
  blocks,
  onClose,
  onSaved,
}: {
  communityId: string;
  eligibleUsers: EligibleUser[];
  roles: Role[];
  blocks: Block[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [userId, setUserId] = useState(eligibleUsers[0]?.id ?? '');
  const [roleId, setRoleId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const body: Record<string, string> = { userId };
    if (roleId) body.initialRoleId = roleId;
    if (roleId && blockId) body.initialBlockId = blockId;
    const res = await fetch(`/api/v1/communities/${communityId}/memberships`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Failed to add member');
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 animate-overlay-in"
        style={{ background: 'rgb(0 0 0 / 0.25)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label="Add member"
        className="w-full max-w-md bg-surface border-l border-line-strong h-full flex flex-col animate-sheet-in"
      >
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
              Add member
            </p>
            <p className="text-lg font-semibold tracking-tight">
              Pick someone from this tenant
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink-tertiary hover:text-ink transition-colors"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-5 flex-1 overflow-y-auto space-y-5">
          {eligibleUsers.length === 0 ? (
            <div className="text-sm text-ink-secondary border border-line rounded-sm p-4">
              <p>
                Everyone in this tenant is already a member here. To add
                someone new, create them via the seed or a dedicated
                user-onboarding flow (not built in this POC).
              </p>
            </div>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
                  User
                </span>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
                >
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-tertiary">
                  Listing users with an active membership in any
                  community in this tenant.
                </p>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
                  Initial role <span className="normal-case">(optional)</span>
                </span>
                <select
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value);
                    if (!e.target.value) setBlockId('');
                  }}
                  className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
                >
                  <option value="">— no role (add later) —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              {roleId ? (
                <label className="block space-y-1.5">
                  <span className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
                    Scope <span className="normal-case">(optional)</span>
                  </span>
                  <select
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
                  >
                    <option value="">community-wide</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {error ? (
                <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={busy || !userId}
                className="w-full text-sm font-medium text-white rounded py-2 disabled:opacity-50"
                style={{ background: 'var(--brand-primary)' }}
              >
                {busy ? 'Adding…' : 'Add to community'}
              </button>
            </>
          )}
        </div>
      </aside>
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
    <div className="border border-line rounded-sm">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{membership.user.name}</p>
            <p className="text-xs font-mono text-ink-tertiary mt-0.5">
              {membership.user.email}
            </p>
          </div>
          <button
            onClick={() => setGranting((g) => !g)}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            {granting ? 'Cancel' : '+ Grant role'}
          </button>
        </div>

        {membership.roles.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">No roles</p>
        ) : (
          <div className="space-y-1">
            {membership.roles.map((mr) => (
              <div
                key={mr.id}
                className="flex items-center justify-between text-sm pl-3 border-l-2"
                style={{ borderColor: 'var(--brand-primary)' }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{mr.role.name}</span>
                  {mr.block ? (
                    <span className="text-xs font-mono text-ink-tertiary px-1.5 py-0.5 rounded-full bg-surface-muted">
                      scope: {mr.block.name}
                    </span>
                  ) : null}
                  {mr.unit ? (
                    <span className="text-xs font-mono text-ink-tertiary px-1.5 py-0.5 rounded-full bg-surface-muted">
                      scope: unit {mr.unit.label}
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={() => onRevoke(membership.id, mr.id)}
                  className="text-xs text-danger hover:opacity-80 transition-opacity"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {granting ? (
          <div className="border-t border-line pt-3 space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Role
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full border border-line-strong rounded text-sm px-2 py-1.5 bg-surface"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Scope (optional)
                </label>
                <select
                  value={blockId}
                  onChange={(e) => setBlockId(e.target.value)}
                  className="w-full border border-line-strong rounded text-sm px-2 py-1.5 bg-surface"
                >
                  <option value="">community-wide</option>
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
                className="text-sm font-medium text-white rounded px-3 py-1.5 disabled:opacity-50"
                style={{ background: 'var(--brand-primary)' }}
              >
                {busy ? '…' : 'Grant'}
              </button>
            </div>
            {error ? (
              <p className="text-xs text-danger border-l-2 border-danger pl-2 py-1">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
