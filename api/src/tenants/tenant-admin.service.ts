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
   * Inefficient by design (O(N memberships)) — acceptable at POC scale.
   * In production, denormalize a tenant-level permission cache.
   */
  async hasTenantPermission(userId: string, tenantId: string, permission: string): Promise<boolean> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'active',
        community: { tenantId },
      },
      select: { communityId: true },
    });
    for (const m of memberships) {
      const ability = await this.ability.resolve(userId, m.communityId);
      if (ability.can(permission)) return true;
    }
    return false;
  }
}
