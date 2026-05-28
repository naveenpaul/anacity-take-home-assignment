import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { CurrentUser, type AuthedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('communities')
@UseGuards(JwtCookieGuard)
export class CommunitiesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lightweight listings used by admin UIs (e.g. block scope picker on the
   * grant-role form). Any active member of the community can read these —
   * they're metadata, not authorization-sensitive.
   */
  @Get(':communityId/blocks')
  async listBlocks(@Param('communityId') communityId: string, @CurrentUser() user: AuthedUser) {
    await this.assertMember(user.id, communityId);
    return this.prisma.block.findMany({
      where: { communityId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':communityId/units')
  async listUnits(@Param('communityId') communityId: string, @CurrentUser() user: AuthedUser) {
    await this.assertMember(user.id, communityId);
    return this.prisma.unit.findMany({
      where: { block: { communityId } },
      select: { id: true, label: true, block: { select: { id: true, name: true } } },
      orderBy: [{ block: { name: 'asc' } }, { label: 'asc' }],
    });
  }

  private async assertMember(userId: string, communityId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { userId, communityId, deletedAt: null, status: 'active' },
      select: { id: true },
    });
    if (!m) throw new ForbiddenException('Not a member of this community');
  }
}
