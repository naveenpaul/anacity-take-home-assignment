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
    if (!confirm('Delete this role? Existing grants will be removed (soft-deleted, audit-preserved).')) return;
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {creating ? (
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
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-2 rounded text-sm text-white"
          style={{ background: 'var(--brand-primary)' }}
        >
          + New custom role
        </button>
      )}

      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="border border-gray-200 rounded p-4">
            {editing?.id === role.id ? (
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
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{role.name}</h4>
                    {role.description ? (
                      <p className="text-xs text-gray-500">{role.description}</p>
                    ) : null}
                    {role.templateKey ? (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-100">
                        from template: {role.templateKey}
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-amber-100">
                        custom
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => setEditing(role)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRole(role.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.map((p) => (
                    <span
                      key={p}
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono"
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
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.permissions ?? []));
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
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Night Shift Security"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <input
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Permissions</label>
        <div className="grid sm:grid-cols-2 gap-1">
          {permissions.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm font-mono">
              <input
                type="checkbox"
                checked={selected.has(p)}
                onChange={() => toggle(p)}
              />
              {p}
            </label>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !name}
          className="px-3 py-1.5 rounded text-sm text-white disabled:opacity-50"
          style={{ background: 'var(--brand-primary)' }}
        >
          {busy ? 'Saving…' : mode === 'create' ? 'Create role' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-sm border border-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
