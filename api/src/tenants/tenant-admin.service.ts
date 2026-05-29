import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AbilityService } from '../rbac/ability.service';

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ability: AbilityService,
  ) {}

  /**
   * Checks if a user has a given permission anywhere in a tenant.
   * Used for tenant-scoped admin actions (branding, future billing, etc.)
   * where the action isn't tied to a specific community.
   *
   * Two sources:
   *  1. Any tenant-wide membership (Membership.communityId IS NULL,
   *     Membership.tenantId = tenantId) with a role granting the
   *     permission. This is the tenant super admin path.
   *  2. Any community membership in this tenant whose resolved ability
   *     includes the permission. Same path as before, kept for backward
   *     compatibility with community-only admins like Alice.
   *
   * Returns as soon as any grant matches.
   */
  async hasTenantPermission(
    userId: string,
    tenantId: string,
    permission: string,
  ): Promise<boolean> {
    // Path 1: tenant-wide grants — single query.
    const tenantWide = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        communityId: null,
        deletedAt: null,
        status: 'active',
        membershipRoles: {
          some: {
            role: {
              deletedAt: null,
              rolePermissions: { some: { permission: { key: permission } } },
            },
          },
        },
      },
      select: { id: true },
    });
    if (tenantWide) return true;

    // Path 2: community-scoped admins. Walk their community memberships
    // and reuse the ability resolver for correctness.
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        tenantId,
        communityId: { not: null },
        deletedAt: null,
        status: 'active',
      },
      select: { communityId: true },
    });
    for (const m of memberships) {
      if (!m.communityId) continue;
      const ability = await this.ability.resolve(userId, m.communityId);
      if (ability.can(permission)) return true;
    }
    return false;
  }
}
