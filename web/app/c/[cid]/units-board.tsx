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

const ACTION_TYPE_VERB: Record<string, string> = {
  visitor_approved: 'approved a visitor for',
  maintenance_raised: 'raised maintenance for',
  notice_created: 'posted a notice for',
  parking_assigned: 'assigned parking for',
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
  const allowedActionTypes = actionTypes.filter(
    (t) => permSet.has(ACTION_TYPE_PERMISSION[t] ?? ''),
  );

  async function recordAction(
    unit: Unit,
    actionType: string,
    metadata: Record<string, unknown>,
  ) {
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
    const feedRes = await fetch(`/api/v1/communities/${communityId}/actions?limit=25`, {
      credentials: 'include',
    });
    if (feedRes.ok) setActions(await feedRes.json());
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        {error ? (
          <div className="text-sm text-danger border-l-2 border-danger pl-3 py-2">
            {error}
          </div>
        ) : null}

        {allowedActionTypes.length === 0 ? (
          <div className="border border-line rounded-sm p-4">
            <p className="text-sm text-ink-secondary">
              You have no action permissions in this community. Ask an admin
              to grant you a role.
            </p>
          </div>
        ) : null}

        {blocks.map(({ block, units }) => (
          <section key={block.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
                {block.name}
              </h3>
              <span className="font-mono text-xs text-ink-tertiary">
                {units.length} units
              </span>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
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
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
            Recent activity
          </h3>
          <span className="font-mono text-xs text-ink-tertiary">
            {actions.length}
          </span>
        </div>
        <div className="border border-line rounded-sm divide-y divide-line max-h-[32rem] overflow-y-auto">
          {actions.length === 0 ? (
            <div className="p-4 text-sm text-ink-tertiary italic">
              No actions yet. Record one to see it appear here.
            </div>
          ) : (
            actions.map((a) => (
              <div key={a.id} className="p-3 space-y-1">
                <p className="text-sm">
                  <span className="font-medium">{a.actor.name}</span>{' '}
                  <span className="text-ink-secondary">
                    {ACTION_TYPE_VERB[a.actionType] ?? a.actionType}
                  </span>{' '}
                  <span className="font-mono font-medium">{a.unitLabel}</span>
                </p>
                {Object.keys(a.metadata).length > 0 ? (
                  <p className="text-xs text-ink-secondary font-mono">
                    {JSON.stringify(a.metadata)}
                  </p>
                ) : null}
                <p className="text-xs font-mono text-ink-tertiary">
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
    <div className="border border-line rounded-sm hover:border-line-strong transition-colors">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{unit.label}</span>
        {allowedActionTypes.length > 0 ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            {open ? 'Cancel' : '+ Action'}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="border-t border-line p-3 space-y-2">
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="w-full border border-line-strong rounded text-xs px-2 py-1 bg-surface"
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
            className="w-full border border-line-strong rounded text-xs px-2 py-1 bg-surface"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="w-full text-xs font-medium text-white rounded py-1.5 disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }}
          >
            {busy ? 'Recording…' : 'Record'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
