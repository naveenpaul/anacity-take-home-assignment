import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Patch, Req, UseGuards } from '@nestjs/common';
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
