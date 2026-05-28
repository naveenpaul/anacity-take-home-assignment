import { apiGet } from './api';

export type Membership = {
  id: string;
  status: string;
  community: {
    id: string;
    name: string;
    tenant: { id: string; slug: string; name: string };
  };
  roles: Array<{
    membershipRoleId: string;
    role: { id: string; name: string; templateKey: string | null };
    block: { id: string; name: string } | null;
    unit: { id: string; label: string } | null;
  }>;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  memberships: Membership[];
};

export async function getCurrentUser(): Promise<Me | null> {
  return apiGet<Me>('/auth/me');
}
