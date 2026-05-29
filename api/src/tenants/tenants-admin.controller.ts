import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsHexColor, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { CurrentUser, type AuthedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAdminService } from './tenant-admin.service';

class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  logo?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  theme?: string;
}

@Controller('tenants/me')
@UseGuards(JwtCookieGuard)
export class TenantsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: TenantAdminService,
  ) {}

  @Get()
  async getMyTenant(@Req() req: Request, @CurrentUser() user: AuthedUser) {
    const tenant = await this.resolveTenantFromHeaders(req);
    // Anyone with an active membership in this tenant can read tenant info.
    const memberCount = await this.prisma.membership.count({
      where: { userId: user.id, deletedAt: null, status: 'active', community: { tenantId: tenant.id } },
    });
    if (memberCount === 0) throw new ForbiddenException('Not a member of this tenant');
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: tenant.branding,
    };
  }

  @Patch('branding')
  async updateBranding(
    @Req() req: Request,
    @CurrentUser() user: AuthedUser,
    @Body() dto: UpdateBrandingDto,
  ) {
    const tenant = await this.resolveTenantFromHeaders(req);
    const allowed = await this.admin.hasTenantPermission(user.id, tenant.id, 'manage_branding');
    if (!allowed) throw new ForbiddenException('Missing permission: manage_branding');

    const current = (tenant.branding ?? {}) as Record<string, unknown>;
    const next = {
      ...current,
      ...(dto.logo !== undefined ? { logo: dto.logo } : {}),
      ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
    };
    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { branding: next },
    });
    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      branding: updated.branding,
    };
  }

  /**
   * Cross-community activity feed for the home page. Returns the most
   * recent UnitAction rows in this tenant, scoped to communities the
   * user can see:
   *   - Tenant-wide membership ⇒ every community in the tenant.
   *   - Community-scoped memberships only ⇒ just those community IDs.
   * Returns an empty array (not 403) when the user has access to zero
   * communities; that's a normal state for someone freshly invited.
   */
  @Get('recent-activity')
  async recentActivity(
    @Req() req: Request,
    @CurrentUser() user: AuthedUser,
    @Query('limit') limit?: string,
  ) {
    const tenant = await this.resolveTenantFromHeaders(req);
    const take = Math.min(Math.max(Number(limit) || 25, 1), 100);

    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: user.id,
        tenantId: tenant.id,
        deletedAt: null,
        status: 'active',
      },
      select: { communityId: true },
    });
    if (memberships.length === 0) return [];

    const isTenantWide = memberships.some((m) => m.communityId === null);
    const where = isTenantWide
      ? { tenantId: tenant.id }
      : {
          tenantId: tenant.id,
          communityId: {
            in: memberships
              .map((m) => m.communityId)
              .filter((c): c is string => c !== null),
          },
        };

    const actions = await this.prisma.unitAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        community: { select: { id: true, name: true } },
      },
    });
    return actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      unitLabel: a.unitLabel,
      metadata: a.metadata,
      createdAt: a.createdAt,
      actor: a.actor,
      community: a.community,
    }));
  }

  /**
   * Resolves the tenant from the X-Tenant-Slug header injected by the
   * Next.js edge middleware. Production: also accept a custom-domain
   * lookup (see design doc §10).
   */
  private async resolveTenantFromHeaders(req: Request) {
    const slug = (req.headers['x-tenant-slug'] as string | undefined) ?? '';
    if (!slug) throw new BadRequestException('Missing X-Tenant-Slug header');
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException(`Unknown tenant: ${slug}`);
    return tenant;
  }
}
