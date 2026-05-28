import { getTenant } from './tenant';

export default async function Home() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <div className="space-y-6 max-w-xl">
        <h2 className="text-2xl font-semibold">Welcome to Anacity</h2>
        <p className="text-gray-700">
          This platform is multi-tenant. Visit a tenant subdomain to see
          its branded view:
        </p>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>
            <a className="text-blue-600 underline" href="http://prestige.localhost:3000">
              prestige.localhost:3000
            </a>
          </li>
          <li>
            <a className="text-blue-600 underline" href="http://sobha.localhost:3000">
              sobha.localhost:3000
            </a>
          </li>
        </ul>
        <p className="text-sm text-gray-500">
          (`*.localhost` resolves to 127.0.0.1 in every modern browser, no
          hosts-file edit needed.)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-semibold">{tenant.name}</h2>
        <p className="text-sm text-gray-500">
          Resolved from <code>{tenant.slug}.localhost</code>
        </p>
      </div>

      <div className="rounded border border-gray-200 p-4 space-y-2">
        <p className="font-medium">POC scaffold is live.</p>
        <p className="text-sm text-gray-600">
          Tenant resolution + branding pipeline is wired (W1 + a slice of
          W4). Auth, multi-community dashboard, dynamic role admin, and
          unit actions ship in W2 / W3 / remaining W4.
        </p>
      </div>

      <div className="text-sm text-gray-600">
        Brand swatch (from <code>Tenant.branding.primaryColor</code>):
        <div className="mt-2 flex items-center gap-2">
          <div
            className="w-12 h-12 rounded"
            style={{ background: 'var(--brand-primary)' }}
          />
          <span className="font-mono text-xs">
            {tenant.branding?.primaryColor ?? '(default)'}
          </span>
        </div>
      </div>
    </div>
  );
}
