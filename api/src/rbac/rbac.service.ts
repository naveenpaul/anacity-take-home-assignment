import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async listRolesInCommunity(communityId: string) {
    const roles = await this.prisma.role.findMany({
      where: { communityId, deletedAt: null },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      templateKey: r.templateKey,
      permissions: r.rolePermissions.map((rp) => rp.permission.key).sort(),
    }));
  }

  async createRole(input: {
    tenantId: string;
    communityId: string;
    name: string;
    description?: string;
    permissions: string[];
  }) {
    const perms = await this.prisma.permission.findMany({
      where: { key: { in: input.permissions } },
    });
    if (perms.length !== input.permissions.length) {
      const known = new Set(perms.map((p) => p.key));
      const missing = input.permissions.filter((p) => !known.has(p));
      throw new BadRequestException(`Unknown permission(s): ${missing.join(', ')}`);
    }
    const role = await this.prisma.role.create({
      data: {
        tenantId: input.tenantId,
        communityId: input.communityId,
        name: input.name,
        description: input.description,
        rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return this.shapeRole(role);
  }

  async updateRole(communityId: string, roleId: string, input: { name?: string; description?: string; permissions?: string[] }) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.deletedAt) throw new NotFoundException('Role not found');
    if (role.communityId !== communityId) {
      throw new BadRequestException('Role does not belong to this community');
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: { name: input.name, description: input.description },
    });

    if (input.permissions) {
      const perms = await this.prisma.permission.findMany({
        where: { key: { in: input.permissions } },
      });
      if (perms.length !== input.permissions.length) {
        const known = new Set(perms.map((p) => p.key));
        const missing = input.permissions.filter((p) => !known.has(p));
        throw new BadRequestException(`Unknown permission(s): ${missing.join(', ')}`);
      }
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId } }),
        this.prisma.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
        }),
      ]);
    }

    const updated = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return this.shapeRole(updated!);
  }

  async deleteRole(communityId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.deletedAt) throw new NotFoundException('Role not found');
    if (role.communityId !== communityId) {
      throw new BadRequestException('Role does not belong to this community');
    }
    await this.prisma.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
    return { id: roleId, tenantId: role.tenantId, deleted: true };
  }

  /**
   * Tenant users eligible to be added as community-scoped members.
   * Includes users who hold any *community-scoped* membership somewhere
   * in this tenant. Excludes:
   *   - users already community-scoped here (would dupe)
   *   - users with only a tenant-wide membership in this tenant; they
   *     already effectively belong to every community via the tenant
   *     grant, so listing them as "add" is misleading
   *   - users with no membership anywhere in this tenant
   */
  async listEligibleUsersForCommunity(communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { tenantId: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const candidates = await this.prisma.user.findMany({
      where: {
        memberships: {
          some: {
            tenantId: community.tenantId,
            communityId: { not: null },
            deletedAt: null,
            status: 'active',
          },
        },
      },
      select: { id: true, email: true, name: true },
      orderBy: { name: 'asc' },
    });

    const existing = await this.prisma.membership.findMany({
      where: { communityId, deletedAt: null },
      select: { userId: true },
    });
    const blocked = new Set(existing.map((m) => m.userId));
    return candidates.filter((u) => !blocked.has(u.id));
  }

  async createMembership(input: {
    userId: string;
    communityId: string;
    initialRoleId?: string | null;
    initialBlockId?: string | null;
    grantedById: string;
  }) {
    const community = await this.prisma.community.findUnique({
      where: { id: input.communityId },
      select: { tenantId: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException('User not found');

    const dup = await this.prisma.membership.findFirst({
      where: { userId: input.userId, communityId: input.communityId, deletedAt: null },
      select: { id: true },
    });
    if (dup) throw new BadRequestException('User already a member of this community');

    if (input.initialRoleId) {
      const role = await this.prisma.role.findUnique({ where: { id: input.initialRoleId } });
      if (!role || role.deletedAt) throw new NotFoundException('Role not found');
      if (role.communityId !== input.communityId) {
        throw new BadRequestException('Role does not belong to this community');
      }
    }
    if (input.initialBlockId) {
      const block = await this.prisma.block.findUnique({ where: { id: input.initialBlockId } });
      if (!block || block.communityId !== input.communityId) {
        throw new BadRequestException('Block not in this community');
      }
    }

    // The findFirst dedupe check above is racy; rely on the partial unique
    // index `memberships_user_id_community_id_key` to enforce the invariant
    // under concurrency, and convert P2002 into the same BadRequest the
    // pre-check would have thrown.
    try {
      const membership = await this.prisma.membership.create({
        data: {
          userId: input.userId,
          tenantId: community.tenantId,
          communityId: input.communityId,
          status: 'active',
          ...(input.initialRoleId
            ? {
                membershipRoles: {
                  create: {
                    roleId: input.initialRoleId,
                    blockId: input.initialBlockId ?? null,
                    grantedById: input.grantedById,
                  },
                },
              }
            : {}),
        },
      });
      return { ...membership, tenantId: community.tenantId };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('User already a member of this community');
      }
      throw err;
    }
  }

  async listMembershipsInCommunity(communityId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { communityId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true } },
        membershipRoles: {
          include: {
            role: { select: { id: true, name: true, templateKey: true } },
            block: { select: { id: true, name: true } },
            unit: { select: { id: true, label: true } },
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });
    return memberships.map((m) => ({
      id: m.id,
      status: m.status,
      user: m.user,
      roles: m.membershipRoles.map((mr) => ({
        id: mr.id,
        role: mr.role,
        block: mr.block,
        unit: mr.unit,
        grantedAt: mr.grantedAt,
      })),
    }));
  }

  async grantRole(input: {
    communityId: string;
    membershipId: string;
    roleId: string;
    blockId?: string | null;
    unitId?: string | null;
    grantedById: string;
  }) {
    const role = await this.prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role || role.deletedAt) throw new NotFoundException('Role not found');
    const membership = await this.prisma.membership.findUnique({ where: { id: input.membershipId } });
    if (!membership || membership.deletedAt) throw new NotFoundException('Membership not found');
    if (membership.communityId !== input.communityId) {
      throw new BadRequestException('Membership does not belong to this community');
    }
    if (role.communityId !== input.communityId) {
      throw new BadRequestException('Role does not belong to this community');
    }
    if (input.blockId) {
      const block = await this.prisma.block.findUnique({ where: { id: input.blockId } });
      if (!block || block.communityId !== membership.communityId) {
        throw new BadRequestException('Block not in this community');
      }
    }
    if (input.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: input.unitId },
        include: { block: true },
      });
      if (!unit || unit.block.communityId !== membership.communityId) {
        throw new BadRequestException('Unit not in this community');
      }
    }
    const mr = await this.prisma.membershipRole.create({
      data: {
        membershipId: input.membershipId,
        roleId: input.roleId,
        blockId: input.blockId ?? null,
        unitId: input.unitId ?? null,
        grantedById: input.grantedById,
      },
    });
    return { ...mr, tenantId: role.tenantId };
  }

  async revokeRole(communityId: string, membershipId: string, membershipRoleId: string) {
    const mr = await this.prisma.membershipRole.findUnique({
      where: { id: membershipRoleId },
      include: {
        membership: { select: { id: true, communityId: true } },
        role: { select: { tenantId: true, communityId: true } },
      },
    });
    if (!mr) throw new NotFoundException('Grant not found');
    if (mr.membership.id !== membershipId) {
      throw new BadRequestException('Grant does not belong to this membership');
    }
    if (mr.membership.communityId !== communityId || mr.role.communityId !== communityId) {
      throw new BadRequestException('Grant does not belong to this community');
    }
    await this.prisma.membershipRole.delete({ where: { id: membershipRoleId } });
    return { id: membershipRoleId, tenantId: mr.role.tenantId, deleted: true };
  }

  private shapeRole(role: { id: string; name: string; description: string | null; templateKey: string | null; tenantId: string; rolePermissions: Array<{ permission: { key: string } }> }) {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description,
      templateKey: role.templateKey,
      permissions: role.rolePermissions.map((rp) => rp.permission.key).sort(),
    };
  }
}
