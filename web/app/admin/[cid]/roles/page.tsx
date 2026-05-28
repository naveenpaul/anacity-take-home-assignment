import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { apiGet } from '../../../lib/api';
import { getCurrentUser } from '../../../lib/auth';
import RolesManager from './roles-manager';

type Role = {
  id: string;
  name: string;
  description: string | null;
  templateKey: string | null;
  permissions: string[];
};

type Permission = { id: string; key: string };

export default async function RolesAdminPage({ params }: { params: { cid: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const membership = me.memberships.find((m) => m.community.id === params.cid);
  if (!membership) notFound();

  const [roles, permissions] = await Promise.all([
    apiGet<Role[]>(`/communities/${params.cid}/roles`),
    apiGet<Permission[]>('/permissions'),
  ]);

  if (!roles || !permissions) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Permission denied</h2>
        <p className="text-sm text-gray-600">
          You don&apos;t have <code>assign_roles</code> in this community.
        </p>
        <Link href="/home" className="text-blue-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          <Link href="/home" className="hover:underline">
            ← Home
          </Link>
        </p>
        <h2 className="text-2xl font-semibold mt-2">Roles · {membership.community.name}</h2>
        <p className="text-sm text-gray-500">
          Create custom roles, edit permissions, or remove. Changes take effect on
          the next request — no deployment.
        </p>
      </div>

      <RolesManager
        communityId={params.cid}
        initialRoles={roles}
        permissions={permissions.map((p) => p.key)}
      />

      <p className="text-sm text-gray-500 pt-4 border-t">
        Next: <Link href={`/admin/${params.cid}/memberships`} className="text-blue-600 hover:underline">manage memberships</Link>{' '}
        to assign these roles to users.
      </p>
    </div>
  );
}
