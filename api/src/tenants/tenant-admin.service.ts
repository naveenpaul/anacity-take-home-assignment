import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if a user has a given permission anywhere in a tenant.
   * Used for tenant-scoped admin actions (branding, future billing, etc.)
   * where the action isn't tied to a specific community.
   *
   * Single query against memberships in the tenant — any active
   * membership (tenant-wide OR community-scoped) whose roles include
   * the permission satisfies the check. Block/unit scope on the
   * MembershipRole is ignored here because tenant-level actions
   * aren't bound to a specific resource.
   */
  async hasTenantPermission(
    userId: string,
    tenantId: string,
    permission: string,
  ): Promise<boolean> {
    const hit = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
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
    return hit !== null;
  }
}
