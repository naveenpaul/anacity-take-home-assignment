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
  const [granting, setGranting] = useState<Membership | null>(null);

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
          className="btn-brand text-sm font-medium rounded px-3 py-1.5"
        >
          + Add member
        </button>
      </div>

      <div className="space-y-2">
        {memberships.map((m) => (
          <MembershipRow
            key={m.id}
            membership={m}
            onRevoke={revoke}
            onGrant={() => setGranting(m)}
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

      {granting ? (
        <GrantRoleDrawer
          key={granting.id}
          communityId={communityId}
          membership={granting}
          roles={roles}
          blocks={blocks}
          onClose={() => setGranting(null)}
          onSaved={async () => {
            setGranting(null);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Shared right-side sheet — backdrop fade + slide-in (DESIGN.md §8). */
function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        aria-label={title}
        className="w-full max-w-md bg-surface border-l border-line-strong h-full flex flex-col animate-sheet-in"
      >
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
              {title}
            </p>
            {subtitle ? (
              <p className="text-lg font-semibold tracking-tight truncate">{subtitle}</p>
            ) : null}
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
        <div className="px-5 py-5 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs uppercase tracking-wider font-medium text-ink-tertiary mb-1.5">
      {children}
    </span>
  );
}

const selectClass =
  'w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface';
const inputClass =
  'w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface';

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
  // Default to "new" when there's nobody left to attach — otherwise the
  // drawer used to be a dead end.
  const [mode, setMode] = useState<'existing' | 'new'>(
    eligibleUsers.length > 0 ? 'existing' : 'new',
  );

  // existing-user fields
  const [userId, setUserId] = useState(eligibleUsers[0]?.id ?? '');
  // new-user fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // shared role/scope
  const [roleId, setRoleId] = useState('');
  const [blockId, setBlockId] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);

    let res: Response;
    if (mode === 'existing') {
      if (!userId) {
        setBusy(false);
        return;
      }
      const body: Record<string, string> = { userId };
      if (roleId) body.initialRoleId = roleId;
      if (roleId && blockId) body.initialBlockId = blockId;
      res = await fetch(`/api/v1/communities/${communityId}/memberships`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
    } else {
      const body: Record<string, string> = { name, email };
      if (password) body.password = password;
      if (roleId) body.initialRoleId = roleId;
      if (roleId && blockId) body.initialBlockId = blockId;
      res = await fetch(`/api/v1/communities/${communityId}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
    }

    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Failed to add member');
      return;
    }
    await onSaved();
  }

  const newUserValid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email);
  const canSubmit = mode === 'existing' ? !!userId : newUserValid;

  return (
    <Drawer title="Add member" subtitle="Bring someone into this community" onClose={onClose}>
      <div className="space-y-5">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 border border-line rounded-sm bg-surface-muted">
          {(['existing', 'new'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className="text-xs font-medium rounded-sm px-2 py-1.5 transition-colors"
                style={
                  active
                    ? {
                        background: 'var(--brand-primary-soft)',
                        color: 'var(--brand-primary)',
                      }
                    : { color: 'var(--text-secondary)' }
                }
              >
                {m === 'existing' ? 'Existing user' : 'New user'}
              </button>
            );
          })}
        </div>

        {mode === 'existing' ? (
          eligibleUsers.length === 0 ? (
            <div className="text-sm text-ink-secondary border border-line rounded-sm p-4 space-y-2">
              <p>Everyone in this tenant is already a member here.</p>
              <p className="text-xs text-ink-tertiary">
                Switch to <span className="font-medium">New user</span> above to
                create a brand-new account and seat them here.
              </p>
            </div>
          ) : (
            <label className="block">
              <FieldLabel>User</FieldLabel>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={selectClass}
              >
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-tertiary mt-1.5">
                Listing users with an active membership in any community in this
                tenant.
              </p>
            </label>
          )
        ) : (
          <div className="space-y-4">
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Nair"
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@tenant.dev"
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="block">
              <FieldLabel>
                Temporary password <span className="normal-case">(optional)</span>
              </FieldLabel>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="dev"
                className={`${inputClass} font-mono`}
              />
              <p className="text-xs text-ink-tertiary mt-1.5">
                Defaults to <span className="font-mono">dev</span> if left blank.
                The user can change it later.
              </p>
            </label>
          </div>
        )}

        {/* Shared role + scope — applies to both modes */}
        {!(mode === 'existing' && eligibleUsers.length === 0) ? (
          <>
            <label className="block">
              <FieldLabel>
                Initial role <span className="normal-case">(optional)</span>
              </FieldLabel>
              <select
                value={roleId}
                onChange={(e) => {
                  setRoleId(e.target.value);
                  if (!e.target.value) setBlockId('');
                }}
                className={selectClass}
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
              <label className="block">
                <FieldLabel>
                  Scope <span className="normal-case">(optional)</span>
                </FieldLabel>
                <select
                  value={blockId}
                  onChange={(e) => setBlockId(e.target.value)}
                  className={selectClass}
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
              disabled={busy || !canSubmit}
              className="btn-brand w-full text-sm font-medium rounded py-2"
            >
              {busy
                ? mode === 'new'
                  ? 'Creating…'
                  : 'Adding…'
                : mode === 'new'
                  ? 'Create user & add'
                  : 'Add to community'}
            </button>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}

function GrantRoleDrawer({
  communityId,
  membership,
  roles,
  blocks,
  onClose,
  onSaved,
}: {
  communityId: string;
  membership: Membership;
  roles: Role[];
  blocks: Block[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
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
    await onSaved();
  }

  return (
    <Drawer title="Grant role" subtitle={membership.user.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs font-mono text-ink-tertiary -mt-1">
          {membership.user.email}
        </p>
        <label className="block">
          <FieldLabel>Role</FieldLabel>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className={selectClass}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>
            Scope <span className="normal-case">(optional)</span>
          </FieldLabel>
          <select
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
            className={selectClass}
          >
            <option value="">community-wide</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={grant}
          disabled={busy || !roleId}
          className="btn-brand w-full text-sm font-medium rounded py-2"
        >
          {busy ? 'Granting…' : 'Grant role'}
        </button>
      </div>
    </Drawer>
  );
}

function MembershipRow({
  membership,
  onRevoke,
  onGrant,
}: {
  membership: Membership;
  onRevoke: (mid: string, mrid: string) => void | Promise<void>;
  onGrant: () => void;
}) {
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
            onClick={onGrant}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            + Grant role
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
      </div>
    </div>
  );
}
