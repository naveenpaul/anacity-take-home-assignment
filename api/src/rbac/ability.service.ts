import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ScopedGrant = {
  permission: string;
  blockId: string | null;
  unitId: string | null;
};

/**
 * Per-request ability for a (user, community) pair.
 *
 * In the design (§5) this is Redis-cached and busted on every RBAC mutation.
 * In the POC it's resolved per request from the DB — the *invalidation
 * contract* (mutations bust the cache) is the architectural commitment;
 * the cache itself is W2-followup.
 *
 * `can(perm)` checks if the user has the permission at all in this community.
 * `can(perm, { blockId, unitId })` additionally enforces block/unit scope:
 * an unscoped grant (blockId/unitId both null on the MembershipRole row)
 * applies community-wide; a scoped grant applies only to matching resources.
 */
export class UserAbility {
  constructor(
    public readonly userId: string,
    public readonly communityId: string,
    private readonly grants: ScopedGrant[],
  ) {}

  can(permission: string, context?: { blockId?: string; unitId?: string }): boolean {
    const matching = this.grants.filter((g) => g.permission === permission);
    if (matching.length === 0) return false;
    if (!context?.blockId && !context?.unitId) {
      // Unscoped check — any grant of this permission is enough.
      return true;
    }
    // Scoped check — at least one grant must be either unscoped (community-wide)
    // or scoped to the matching block/unit.
    return matching.some((g) => {
      const blockOk = !g.blockId || g.blockId === context.blockId;
      const unitOk = !g.unitId || g.unitId === context.unitId;
      return blockOk && unitOk;
    });
  }

  ensure(permission: string, context?: { blockId?: string; unitId?: string }): void {
    if (!this.can(permission, context)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  permissions(): string[] {
    return Array.from(new Set(this.grants.map((g) => g.permission))).sort();
  }
}

@Injectable()
export class AbilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the ability for a (user, community) pair.
   * Throws if the user has no active membership in the community.
   */
  async resolve(userId: string, communityId: string): Promise<UserAbility> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, communityId, deletedAt: null, status: 'active' },
      include: {
        membershipRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('No active membership in this community');
    }

    const grants: ScopedGrant[] = [];
    for (const mr of membership.membershipRoles) {
      if (mr.role.deletedAt) continue;
      for (const rp of mr.role.rolePermissions) {
        grants.push({
          permission: rp.permission.key,
          blockId: mr.blockId,
          unitId: mr.unitId,
        });
      }
    }
    return new UserAbility(userId, communityId, grants);
  }
}
