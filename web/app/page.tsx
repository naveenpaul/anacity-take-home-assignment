import { redirect } from 'next/navigation';
import { getCurrentUser } from './lib/auth';
import { getTenant } from './tenant';

export default async function Root() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <div className="max-w-2xl space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">Anacity</h1>
          <p className="text-lg text-ink-secondary leading-relaxed">
            Multi-tenant SaaS for residential community management.
            Each customer organization lives on its own subdomain with
            its own branding.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
            Demo tenants
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="http://prestige.localhost:3000"
              className="group block border border-line hover:border-line-strong rounded-sm p-5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-[#0047AB]" />
                <div>
                  <p className="font-semibold">Prestige</p>
                  <p className="font-mono text-xs text-ink-tertiary mt-0.5">
                    prestige.localhost:3000
                  </p>
                </div>
              </div>
            </a>
            <a
              href="http://sobha.localhost:3000"
              className="group block border border-line hover:border-line-strong rounded-sm p-5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-[#16A34A]" />
                <div>
                  <p className="font-semibold">Sobha</p>
                  <p className="font-mono text-xs text-ink-tertiary mt-0.5">
                    sobha.localhost:3000
                  </p>
                </div>
              </div>
            </a>
          </div>
          <p className="text-xs text-ink-tertiary">
            <code className="font-mono">*.localhost</code> resolves to{' '}
            <code className="font-mono">127.0.0.1</code> in every modern
            browser — no hosts-file edit needed.
          </p>
        </div>
      </div>
    );
  }

  const me = await getCurrentUser();
  redirect(me ? '/home' : '/login');
}
