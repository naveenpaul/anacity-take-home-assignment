'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = {
  id: string;
  name: string;
  description: string | null;
  templateKey: string | null;
  permissions: string[];
};

export default function RolesManager({
  communityId,
  initialRoles,
  permissions,
}: {
  communityId: string;
  initialRoles: Role[];
  permissions: string[];
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/v1/communities/${communityId}/roles`, {
      credentials: 'include',
    });
    if (res.ok) {
      setRoles(await res.json());
      router.refresh();
    }
  }

  async function deleteRole(id: string) {
    if (!confirm('Delete this role? Existing grants are removed; audit preserved.')) return;
    const res = await fetch(`/api/v1/communities/${communityId}/roles/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      setError('Delete failed');
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">
          {error}
        </p>
      ) : null}

      {creating ? (
        <div className="border border-line rounded-sm p-4">
          <RoleForm
            mode="create"
            communityId={communityId}
            permissions={permissions}
            onDone={async () => {
              setCreating(false);
              await refresh();
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="text-sm font-medium text-white rounded px-3 py-1.5"
          style={{ background: 'var(--brand-primary)' }}
        >
          + New custom role
        </button>
      )}

      <div className="space-y-2">
        {roles.map((role) => (
          <div key={role.id} className="border border-line rounded-sm">
            {editing?.id === role.id ? (
              <div className="p-4">
                <RoleForm
                  mode="edit"
                  communityId={communityId}
                  permissions={permissions}
                  initial={role}
                  onDone={async () => {
                    setEditing(null);
                    await refresh();
                  }}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-medium">{role.name}</h3>
                      {role.templateKey ? (
                        <span className="text-xs font-mono text-ink-tertiary px-1.5 py-0.5 rounded-full bg-surface-muted">
                          template:{role.templateKey}
                        </span>
                      ) : (
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: 'var(--brand-primary-soft)',
                            color: 'var(--brand-primary)',
                          }}
                        >
                          custom
                        </span>
                      )}
                    </div>
                    {role.description ? (
                      <p className="text-xs text-ink-secondary">{role.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-3 text-xs shrink-0">
                    <button
                      onClick={() => setEditing(role)}
                      className="text-ink-secondary hover:text-ink transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRole(role.id)}
                      className="text-danger hover:opacity-80 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.map((p) => (
                    <span
                      key={p}
                      className="font-mono text-xs px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-secondary"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleForm({
  mode,
  communityId,
  permissions,
  initial,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit';
  communityId: string;
  permissions: string[];
  initial?: Role;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial?.permissions ?? []),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(p: string) {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setSelected(next);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const body = {
      name,
      description: description || undefined,
      permissions: Array.from(selected),
    };
    const url =
      mode === 'create'
        ? `/api/v1/communities/${communityId}/roles`
        : `/api/v1/communities/${communityId}/roles/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Save failed');
      return;
    }
    await onDone();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1.5">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Night Shift Security"
          className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1.5">
          Description (optional)
        </label>
        <input
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-2">
          Permissions
        </label>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {permissions.map((p) => (
            <label
              key={p}
              className="flex items-center gap-2 cursor-pointer hover:bg-surface-muted px-2 py-1 rounded-sm transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(p)}
                onChange={() => toggle(p)}
                className="rounded-sm"
              />
              <span className="font-mono text-xs">{p}</span>
            </label>
          ))}
        </div>
      </div>
      {error ? (
        <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !name}
          className="text-sm font-medium text-white rounded px-3 py-1.5 disabled:opacity-50"
          style={{ background: 'var(--brand-primary)' }}
        >
          {busy ? 'Saving…' : mode === 'create' ? 'Create role' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm font-medium border border-line-strong rounded px-3 py-1.5 text-ink-secondary hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
