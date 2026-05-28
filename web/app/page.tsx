import { redirect } from 'next/navigation';
import { getCurrentUser } from './lib/auth';
import { getTenant } from './tenant';

export default async function Root() {
  const tenant = await getTenant();
  if (!tenant) {
    // No tenant subdomain — show the welcome / sub-domain picker.
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
          (<code>*.localhost</code> resolves to 127.0.0.1 in every modern
          browser — no hosts-file edit needed.)
        </p>
      </div>
    );
  }

  const me = await getCurrentUser();
  redirect(me ? '/home' : '/login');
}
