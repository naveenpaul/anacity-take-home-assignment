import Link from 'next/link';
import { redirect } from 'next/navigation';
import { effectiveMemberships, getCurrentUser } from '../lib/auth';
import { getTenant } from '../tenant';
import LogoutButton from './logout-button';

export default async function HomePage() {
  const [me, tenant] = await Promise.all([getCurrentUser(), getTenant()]);
  if (!me) redirect('/login');

  // Effective list = community memberships + synthesized rows for
  // communities covered by a tenant-wide membership.
  const effective = effectiveMemberships(me);

  // Scope visible memberships to the current tenant (cross-tenant identity
  // — same user, different visible communities per host).
  const visible = tenant
    ? effective.filter((m) => m.community.tenant.slug === tenant.slug)
    : effective;

  const otherTenants = Array.from(
    new Set(
      effective
        .filter((m) => !tenant || m.community.tenant.slug !== tenant.slug)
        .map((m) => m.community.tenant.slug),
    ),
  );

  const hasAdmin = visible.some((m) =>
    m.roles.some((r) => r.role.templateKey === 'admin'),
  );
  const isTenantSuperAdmin = tenant
    ? me.tenantWideMemberships.some(
        (tw) =>
          tw.tenant.slug === tenant.slug &&
          tw.roles.some((r) => r.role.templateKey === 'admin'),
      )
    : false;

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
            Signed in
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{me.name}</h1>
          <p className="font-mono text-xs text-ink-tertiary">{me.email}</p>
        </div>
        <LogoutButton />
      </div>

      {tenant && (hasAdmin || isTenantSuperAdmin) ? (
        <div className="border border-line rounded-sm p-4 flex items-center justify-between bg-surface-raised">
          <div>
            <p className="text-sm font-medium">
              {isTenantSuperAdmin ? 'Tenant super admin' : 'Tenant admin'}
            </p>
            <p className="text-xs text-ink-secondary mt-0.5">
              {isTenantSuperAdmin
                ? `You hold a tenant-wide admin role at ${tenant.name} — every community below is administrable.`
                : `You're admin in at least one ${tenant.name} community.`}
            </p>
          </div>
          <Link
            href="/admin/branding"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            Brand settings →
          </Link>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-wider font-medium text-ink-tertiary">
            Your communities {tenant ? `at ${tenant.name}` : ''}
          </h2>
          <span className="font-mono text-xs text-ink-tertiary">
            {visible.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="border border-line rounded-sm p-6 space-y-3">
            <p className="text-sm text-ink-secondary">
              You have no memberships on this tenant.
            </p>
            {otherTenants.length > 0 ? (
              <p className="text-xs text-ink-tertiary">
                Try{' '}
                {otherTenants.map((s, i) => (
                  <span key={s}>
                    <a
                      href={`http://${s}.localhost:3000/home`}
                      className="font-mono hover:underline"
                      style={{ color: 'var(--brand-primary)' }}
                    >
                      {s}.localhost
                    </a>
                    {i < otherTenants.length - 1 ? ', ' : ''}
                  </span>
                ))}{' '}
                where you are a member.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((m) => {
              const isAdmin = m.roles.some((r) => r.role.templateKey === 'admin');
              return (
                <div
                  key={m.id}
                  className="border border-line rounded-sm hover:border-line-strong transition-colors"
                >
                  <Link href={`/c/${m.community.id}`} className="block p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{m.community.name}</p>
                        <p className="text-xs text-ink-tertiary mt-0.5">
                          {m.community.tenant.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: 'var(--brand-primary-soft)',
                            color: 'var(--brand-primary)',
                          }}
                        >
                          {m.roles[0]?.role.name ?? 'No role'}
                        </span>
                        {m.fromTenantWide ? (
                          <span className="text-2xs font-mono text-ink-tertiary">
                            via tenant grant
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--brand-primary)' }}>
                      Open dashboard →
                    </p>
                  </Link>
                  {isAdmin ? (
                    <div className="border-t border-line px-4 py-2 flex gap-4 text-xs">
                      <Link
                        href={`/admin/${m.community.id}/roles`}
                        className="text-ink-secondary hover:text-ink transition-colors"
                      >
                        Roles
                      </Link>
                      <Link
                        href={`/admin/${m.community.id}/memberships`}
                        className="text-ink-secondary hover:text-ink transition-colors"
                      >
                        Memberships
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {otherTenants.length > 0 && visible.length > 0 ? (
        <section className="text-xs text-ink-tertiary border-t border-line pt-6">
          <p>
            You also have memberships at{' '}
            {otherTenants.map((s, i) => (
              <span key={s}>
                <a
                  href={`http://${s}.localhost:3000/home`}
                  className="font-mono hover:underline"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  {s}.localhost
                </a>
                {i < otherTenants.length - 1 ? ', ' : ''}
              </span>
            ))}
            . Same identity. Each tenant subdomain only shows you that
            tenant's communities — see design doc §3 for the resolver.
          </p>
        </section>
      ) : null}
    </div>
  );
}
