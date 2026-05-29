import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { CurrentUser, type AuthedUser } from '../auth/current-user.decorator';
import { ActionsService } from './actions.service';
import { knownActionTypes } from './action-types';
import { PrismaService } from '../prisma/prisma.service';

class CreateActionDto {
  @IsString()
  @MinLength(1)
  action_type!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@Controller('communities/:communityId')
@UseGuards(JwtCookieGuard)
export class ActionsController {
  constructor(
    private readonly actions: ActionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('action-types')
  listActionTypes() {
    return knownActionTypes();
  }

  @Get('actions')
  async listForCommunity(
    @Param('communityId') communityId: string,
    @CurrentUser() user: AuthedUser,
    @Query('limit') limit?: string,
  ) {
    await this.assertMember(user.id, communityId);
    return this.actions.listForCommunity(communityId, limit ? Number(limit) : 50);
  }

  @Get('units/:unitId/actions')
  async listForUnit(
    @Param('communityId') communityId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: AuthedUser,
    @Query('limit') limit?: string,
  ) {
    await this.assertMember(user.id, communityId);
    return this.actions.listForUnit(unitId, limit ? Number(limit) : 50);
  }

  @Post('units/:unitId/actions')
  async create(
    @Param('communityId') communityId: string,
    @Param('unitId') unitId: string,
    @Body() dto: CreateActionDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.actions.createForUnit({
      actorUserId: user.id,
      communityId,
      unitId,
      actionType: dto.action_type,
      metadata: dto.metadata,
    });
  }

  /**
   * Pass if the user has either a community-scoped membership OR a
   * tenant-wide membership in this community's tenant. Same union the
   * ability resolver uses — kept in sync deliberately.
   */
  private async assertMember(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { tenantId: true },
    });
    if (!community) throw new ForbiddenException('Not a member of this community');
    const m = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: 'active',
        OR: [
          { communityId },
          { tenantId: community.tenantId, communityId: null },
        ],
      },
      select: { id: true },
    });
    if (!m) throw new ForbiddenException('Not a member of this community');
  }
}
