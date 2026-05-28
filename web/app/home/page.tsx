import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth';
import { getTenant } from '../tenant';
import LogoutButton from './logout-button';

export default async function HomePage() {
  const [me, tenant] = await Promise.all([getCurrentUser(), getTenant()]);
  if (!me) redirect('/login');

  // Scope visible memberships to the current tenant (cross-tenant identity
  // — same user, different visible communities per host).
  const visible = tenant
    ? me.memberships.filter((m) => m.community.tenant.slug === tenant.slug)
    : me.memberships;

  const otherTenants = Array.from(
    new Set(
      me.memberships
        .filter((m) => !tenant || m.community.tenant.slug !== tenant.slug)
        .map((m) => m.community.tenant.slug),
    ),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">Signed in as</p>
          <h2 className="text-2xl font-semibold">{me.name}</h2>
          <p className="text-sm text-gray-500">{me.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">
          Your communities {tenant ? `at ${tenant.name}` : ''} ({visible.length})
        </h3>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            You have no memberships on this tenant.
            {otherTenants.length > 0 ? (
              <>
                {' '}
                But you have memberships at:{' '}
                {otherTenants.map((s) => (
                  <a
                    key={s}
                    href={`http://${s}.localhost:3000/home`}
                    className="text-blue-600 underline mr-2"
                  >
                    {s}.localhost
                  </a>
                ))}
              </>
            ) : null}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((m) => {
              const isAdmin = m.roles.some((r) => r.role.templateKey === 'admin');
              return (
                <div
                  key={m.id}
                  className="border border-gray-200 rounded p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{m.community.name}</h4>
                      <p className="text-xs text-gray-500">{m.community.tenant.name}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100">
                      {m.roles.map((r) => r.role.name).join(', ') || 'No role'}
                    </span>
                  </div>
                  {isAdmin ? (
                    <div className="flex gap-2 pt-2 text-sm">
                      <Link
                        href={`/admin/${m.community.id}/roles`}
                        className="text-blue-600 hover:underline"
                      >
                        Manage roles
                      </Link>
                      <span className="text-gray-300">·</span>
                      <Link
                        href={`/admin/${m.community.id}/memberships`}
                        className="text-blue-600 hover:underline"
                      >
                        Manage memberships
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
        <section className="text-sm text-gray-600 border-t pt-4">
          You also have memberships at:{' '}
          {otherTenants.map((s) => (
            <a
              key={s}
              href={`http://${s}.localhost:3000/home`}
              className="text-blue-600 underline mr-2"
            >
              {s}.localhost
            </a>
          ))}
          <p className="text-xs text-gray-400 mt-1">
            (Same identity. Each tenant subdomain only shows you that
            tenant&apos;s communities — see design doc §3 for the resolver.)
          </p>
        </section>
      ) : null}
    </div>
  );
}
