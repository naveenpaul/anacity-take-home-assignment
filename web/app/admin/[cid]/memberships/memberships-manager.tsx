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
  // One flow, create-on-miss: search the tenant's existing users; if the
  // typed value is an email that matches nobody, fall through to creating
  // a new account. No mode toggle.
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matches = q
    ? eligibleUsers.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    : eligibleUsers;

  const selected = selectedUserId
    ? (eligibleUsers.find((u) => u.id === selectedUserId) ?? null)
    : null;
  const isEmail = /\S+@\S+\.\S+/.test(query.trim());
  const exactExisting = eligibleUsers.some((u) => u.email.toLowerCase() === q);
  // Create a new account when nothing existing is selected, the query is a
  // valid email, and it doesn't exactly match an addable tenant user.
  const creatingNew = !selected && isEmail && !exactExisting;

  function selectExisting(id: string) {
    const u = eligibleUsers.find((x) => x.id === id);
    setSelectedUserId(id);
    setQuery(u ? u.email : '');
    setNewName('');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);

    let res: Response;
    if (selected) {
      const body: Record<string, string> = { userId: selected.id };
      if (roleId) body.initialRoleId = roleId;
      if (roleId && blockId) body.initialBlockId = blockId;
      res = await fetch(`/api/v1/communities/${communityId}/memberships`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
    } else {
      const body: Record<string, string> = { name: newName.trim(), email: query.trim() };
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

  const canSubmit = selected ? true : creatingNew && newName.trim().length > 0;

  return (
    <Drawer title="Add member" subtitle="Search or create someone" onClose={onClose}>
      <div className="space-y-5">
        <label className="block">
          <FieldLabel>Search by name or email</FieldLabel>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedUserId(null);
              setError(null);
            }}
            placeholder="Type a name, or a new email to create…"
            className={`${inputClass} ${selected ? 'font-mono' : ''}`}
            autoFocus
          />
        </label>

        {/* Existing tenant users matching the query (not yet members here) */}
        {!selected && !creatingNew ? (
          matches.length > 0 ? (
            <div className="border border-line rounded-sm divide-y divide-line max-h-56 overflow-y-auto">
              {matches.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selectExisting(u.id)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-muted transition-colors"
                >
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs font-mono text-ink-tertiary">{u.email}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-tertiary px-1">
              {query.trim()
                ? 'No tenant member matches. Type a full email address to create a new user.'
                : 'No existing tenant members left to add — type an email to create someone new.'}
            </p>
          )
        ) : null}

        {/* Chosen existing user */}
        {selected ? (
          <div className="flex items-center justify-between border border-line rounded-sm px-3 py-2 bg-surface-raised">
            <div>
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="text-xs font-mono text-ink-tertiary">{selected.email}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedUserId(null);
                setQuery('');
              }}
              className="text-xs text-ink-tertiary hover:text-ink transition-colors"
            >
              Change
            </button>
          </div>
        ) : null}

        {/* Create-new fields (query is an email that matches nobody) */}
        {creatingNew ? (
          <div className="space-y-4 border border-line rounded-sm p-4">
            <p className="text-xs text-ink-secondary">
              No match for <span className="font-mono">{query.trim()}</span> —
              creating a new user.
            </p>
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Priya Nair"
                className={inputClass}
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
              </p>
            </label>
          </div>
        ) : null}

        {/* Role + scope — once a target (existing or new) is chosen */}
        {selected || creatingNew ? (
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
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">{error}</p>
        ) : null}

        {selected || creatingNew ? (
          <button
            type="button"
            onClick={submit}
            disabled={busy || !canSubmit}
            className="btn-brand w-full text-sm font-medium rounded py-2"
          >
            {busy
              ? creatingNew
                ? 'Creating…'
                : 'Adding…'
              : creatingNew
                ? 'Create user & add'
                : 'Add to community'}
          </button>
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
