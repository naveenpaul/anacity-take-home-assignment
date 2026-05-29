import { apiGet } from './api';

export type Tenant = { id: string; slug: string; name: string };

export type Membership = {
  id: string;
  status: string;
  community: {
    id: string;
    name: string;
    tenant: Tenant;
  };
  roles: Array<{
    membershipRoleId: string;
    role: { id: string; name: string; templateKey: string | null };
    block: { id: string; name: string } | null;
    unit: { id: string; label: string } | null;
  }>;
  /** Synthesized from a tenant-wide membership — see effectiveMemberships(). */
  fromTenantWide?: boolean;
};

export type TenantWideMembership = {
  id: string;
  status: string;
  tenant: Tenant;
  roles: Array<{
    membershipRoleId: string;
    role: { id: string; name: string; templateKey: string | null };
  }>;
  accessibleCommunities: Array<{ id: string; name: string; tenant: Tenant }>;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  memberships: Membership[];
  tenantWideMemberships: TenantWideMembership[];
};

export async function getCurrentUser(): Promise<Me | null> {
  return apiGet<Me>('/auth/me');
}

/**
 * Returns the user's effective membership list: community memberships
 * plus one synthesized entry per community covered by a tenant-wide
 * membership. Dedupes by community.id when a user has BOTH a
 * community-scoped membership AND tenant-wide coverage for the same
 * community (community-scoped wins so block/unit scope on it is honored
 * by the UI).
 */
export function effectiveMemberships(me: Me): Membership[] {
  const byCommunity = new Map<string, Membership>();
  for (const m of me.memberships) byCommunity.set(m.community.id, m);
  for (const tw of me.tenantWideMemberships) {
    for (const c of tw.accessibleCommunities) {
      if (byCommunity.has(c.id)) continue; // community-scoped wins
      byCommunity.set(c.id, {
        id: `tw-${tw.id}-${c.id}`,
        status: tw.status,
        community: c,
        roles: tw.roles.map((r) => ({
          membershipRoleId: r.membershipRoleId,
          role: r.role,
          block: null,
          unit: null,
        })),
        fromTenantWide: true,
      });
    }
  }
  return Array.from(byCommunity.values()).sort((a, b) =>
    a.community.name.localeCompare(b.community.name),
  );
}
