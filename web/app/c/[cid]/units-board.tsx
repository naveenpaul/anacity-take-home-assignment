'use client';

import { useEffect, useState } from 'react';

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
type ScopedGrant = {
  permission: string;
  blockId: string | null;
  unitId: string | null;
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
  myGrants,
  initialActions,
}: {
  communityId: string;
  blocks: Array<{ block: Block; units: Unit[] }>;
  actionTypes: string[];
  myPermissions: string[];
  myGrants: ScopedGrant[];
  initialActions: Action[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [busyUnit, setBusyUnit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const permSet = new Set(myPermissions);
  const availableActionTypes = actionTypes.filter((t) =>
    permSet.has(ACTION_TYPE_PERMISSION[t] ?? ''),
  );

  function allowedActionTypesForUnit(unit: Unit) {
    return availableActionTypes.filter((t) => {
      const permission = ACTION_TYPE_PERMISSION[t];
      if (!permission) return false;
      return myGrants.some((grant) => {
        if (grant.permission !== permission) return false;
        const blockOk = !grant.blockId || grant.blockId === unit.block.id;
        const unitOk = !grant.unitId || grant.unitId === unit.id;
        return blockOk && unitOk;
      });
    });
  }

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
      return false;
    }
    const feedRes = await fetch(`/api/v1/communities/${communityId}/actions?limit=25`, {
      credentials: 'include',
    });
    if (feedRes.ok) setActions(await feedRes.json());
    return true;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        {error ? (
          <div className="text-sm text-danger border-l-2 border-danger pl-3 py-2">
            {error}
          </div>
        ) : null}

        {availableActionTypes.length === 0 ? (
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
                  selected={selectedUnit?.id === u.id}
                  canAct={allowedActionTypesForUnit(u).length > 0}
                  onSelect={() => setSelectedUnit(u)}
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

      {selectedUnit ? (
        <ActionDrawer
          // Key reset clears action-type/note state when switching units.
          key={selectedUnit.id}
          unit={selectedUnit}
          allowedActionTypes={allowedActionTypesForUnit(selectedUnit)}
          recentForUnit={actions.filter((a) => a.unitId === selectedUnit.id)}
          busy={busyUnit === selectedUnit.id}
          onSubmit={async (actionType, metadata) => {
            const ok = await recordAction(selectedUnit, actionType, metadata);
            if (ok) setSelectedUnit(null);
          }}
          onClose={() => setSelectedUnit(null)}
        />
      ) : null}
    </div>
  );
}

function UnitCard({
  unit,
  selected,
  canAct,
  onSelect,
}: {
  unit: Unit;
  selected: boolean;
  canAct: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!canAct}
      className={`text-left border rounded-sm px-3 py-2 flex items-center justify-between transition-[border-color,background-color,transform] duration-150 ${
        selected
          ? 'border-line-strong bg-surface-raised'
          : 'border-line hover:border-line-strong hover:bg-surface-raised'
      } ${canAct ? 'cursor-pointer active:translate-y-[0.5px]' : 'cursor-not-allowed opacity-60'}`}
    >
      <span className="font-mono text-sm font-medium">{unit.label}</span>
      {canAct ? (
        <span
          className="text-xs"
          style={{ color: 'var(--brand-primary)' }}
        >
          + Action
        </span>
      ) : null}
    </button>
  );
}

function ActionDrawer({
  unit,
  allowedActionTypes,
  recentForUnit,
  busy,
  onSubmit,
  onClose,
}: {
  unit: Unit;
  allowedActionTypes: string[];
  recentForUnit: Action[];
  busy: boolean;
  onSubmit: (actionType: string, metadata: Record<string, unknown>) => void | Promise<void>;
  onClose: () => void;
}) {
  const [actionType, setActionType] = useState(allowedActionTypes[0] ?? '');
  const [note, setNote] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    if (!actionType) return;
    await onSubmit(actionType, note ? { note } : {});
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
        aria-label={`Record action on ${unit.label}`}
        className="w-full max-w-md bg-surface border-l border-line-strong h-full flex flex-col animate-sheet-in"
      >
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
              Record action
            </p>
            <p className="text-lg font-semibold tracking-tight">
              <span className="text-ink-tertiary">{unit.block.name} /</span>{' '}
              <span className="font-mono">{unit.label}</span>
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

        <div className="px-5 py-5 space-y-4 border-b border-line">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
              Action type
            </span>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
            >
              {allowedActionTypes.map((t) => (
                <option key={t} value={t}>
                  {ACTION_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
              Note <span className="text-ink-tertiary normal-case">(optional)</span>
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. visitor name, vehicle plate"
              className="w-full border border-line-strong rounded text-sm px-3 py-2 bg-surface"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !actionType}
            className="btn-brand w-full text-sm font-medium rounded py-2"
          >
            {busy ? 'Recording…' : 'Record action'}
          </button>
        </div>

        <div className="px-5 py-4 flex-1 overflow-y-auto">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
              Recent on this unit
            </h3>
            <span className="font-mono text-xs text-ink-tertiary">
              {recentForUnit.length}
            </span>
          </div>
          {recentForUnit.length === 0 ? (
            <p className="text-sm text-ink-tertiary italic">
              No actions recorded yet for {unit.label}.
            </p>
          ) : (
            <div className="border border-line rounded-sm divide-y divide-line">
              {recentForUnit.map((a) => (
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
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
