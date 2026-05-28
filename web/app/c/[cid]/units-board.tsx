'use client';

import { useState } from 'react';

type Block = { id: string; name: string };
type Unit = { id: string; label: string; block: { id: string; name: string } };
type Action = {
  id: string;
  unitId: string;
  unitLabel: string;
  actionType: string;
  metadata: Record<string, unknown>;
  actor: { id: string; name: string; email: string };
  createdAt: string;
};

// Mirror of action-types.ts on the backend. If we add more action types,
// keep these in sync.
const ACTION_TYPE_LABELS: Record<string, string> = {
  visitor_approved: 'Approve visitor',
  maintenance_raised: 'Raise maintenance',
  notice_created: 'Post notice',
  parking_assigned: 'Assign parking',
};

const ACTION_TYPE_PERMISSION: Record<string, string> = {
  visitor_approved: 'approve_visitor',
  maintenance_raised: 'raise_maintenance',
  notice_created: 'create_notice',
  parking_assigned: 'manage_units',
};

export default function UnitsBoard({
  communityId,
  blocks,
  actionTypes,
  myPermissions,
  initialActions,
}: {
  communityId: string;
  blocks: Array<{ block: Block; units: Unit[] }>;
  actionTypes: string[];
  myPermissions: string[];
  initialActions: Action[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [busyUnit, setBusyUnit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const permSet = new Set(myPermissions);
  const allowedActionTypes = actionTypes.filter((t) => permSet.has(ACTION_TYPE_PERMISSION[t] ?? ''));

  async function recordAction(unit: Unit, actionType: string, metadata: Record<string, unknown>) {
    setBusyUnit(unit.id);
    setError(null);
    const res = await fetch(
      `/api/v1/communities/${communityId}/units/${unit.id}/actions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action_type: actionType, metadata }),
        credentials: 'include',
      },
    );
    setBusyUnit(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Action failed');
      return;
    }
    // Refetch the feed.
    const feedRes = await fetch(`/api/v1/communities/${communityId}/actions?limit=25`, {
      credentials: 'include',
    });
    if (feedRes.ok) setActions(await feedRes.json());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {error ? (
          <div className="text-sm text-red-600 border border-red-200 rounded p-2">
            {error}
          </div>
        ) : null}

        {allowedActionTypes.length === 0 ? (
          <div className="text-sm text-gray-600 border border-gray-200 rounded p-3">
            You have no action permissions in this community. Ask an admin to
            grant you one — try the Resident, Security, or Manager role.
          </div>
        ) : null}

        {blocks.map(({ block, units }) => (
          <section key={block.id}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {block.name}
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {units.map((u) => (
                <UnitCard
                  key={u.id}
                  unit={u}
                  allowedActionTypes={allowedActionTypes}
                  onAction={recordAction}
                  busy={busyUnit === u.id}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-4 self-start">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Recent activity ({actions.length})
        </h3>
        <div className="border border-gray-200 rounded divide-y max-h-[28rem] overflow-y-auto">
          {actions.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No actions yet.</div>
          ) : (
            actions.map((a) => (
              <div key={a.id} className="p-3 text-sm">
                <p>
                  <span className="font-medium">{a.actor.name}</span>{' '}
                  <span className="text-gray-600">
                    {ACTION_TYPE_LABELS[a.actionType] ?? a.actionType}
                  </span>{' '}
                  on <span className="font-mono">{a.unitLabel}</span>
                </p>
                {Object.keys(a.metadata).length > 0 ? (
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {JSON.stringify(a.metadata)}
                  </p>
                ) : null}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function UnitCard({
  unit,
  allowedActionTypes,
  onAction,
  busy,
}: {
  unit: Unit;
  allowedActionTypes: string[];
  onAction: (unit: Unit, actionType: string, metadata: Record<string, unknown>) => void | Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState(allowedActionTypes[0] ?? '');
  const [note, setNote] = useState('');

  async function submit() {
    if (!actionType) return;
    const metadata = note ? { note } : {};
    await onAction(unit, actionType, metadata);
    setNote('');
    setOpen(false);
  }

  return (
    <div className="border border-gray-200 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono font-medium">{unit.label}</span>
        {allowedActionTypes.length > 0 ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-blue-600 hover:underline"
          >
            {open ? 'Cancel' : '+ Action'}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2">
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
          >
            {allowedActionTypes.map((t) => (
              <option key={t} value={t}>
                {ACTION_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="w-full px-2 py-1 rounded text-xs text-white disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }}
          >
            {busy ? 'Recording…' : 'Record'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
