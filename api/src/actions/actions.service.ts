import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbilityService } from '../rbac/ability.service';
import { knownActionTypes, permissionFor } from './action-types';

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ability: AbilityService,
  ) {}

  async createForUnit(input: {
    actorUserId: string;
    communityId: string;
    unitId: string;
    actionType: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!knownActionTypes().includes(input.actionType)) {
      throw new BadRequestException(`Unknown action_type: ${input.actionType}`);
    }
    const requiredPerm = permissionFor(input.actionType)!;

    // Resolve and validate the hierarchy: tenant ⊇ community ⊇ block ⊇ unit.
    // Snapshot all four IDs into the audit row so renames/moves later don't
    // mutate history (design doc §6).
    const unit = await this.prisma.unit.findUnique({
      where: { id: input.unitId },
      include: { block: { include: { community: { select: { id: true, tenantId: true } } } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.block.community.id !== input.communityId) {
      throw new BadRequestException('Unit does not belong to this community');
    }

    // Ability check with block/unit scope.
    const ability = await this.ability.resolve(input.actorUserId, input.communityId);
    if (!ability.can(requiredPerm, { blockId: unit.blockId, unitId: unit.id })) {
      throw new ForbiddenException(`Missing permission: ${requiredPerm}`);
    }

    const action = await this.prisma.unitAction.create({
      data: {
        tenantId: unit.block.community.tenantId,
        communityId: unit.block.community.id,
        blockId: unit.blockId,
        unitId: unit.id,
        unitLabel: unit.label,
        actorUserId: input.actorUserId,
        actionType: input.actionType,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return action;
  }

  async listForCommunity(communityId: string, limit = 50) {
    return this.prisma.unitAction.findMany({
      where: { communityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listForUnit(communityId: string, unitId: string, limit = 50) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { block: { select: { communityId: true } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.block.communityId !== communityId) {
      throw new BadRequestException('Unit does not belong to this community');
    }

    return this.prisma.unitAction.findMany({
      where: { communityId, unitId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }
}
