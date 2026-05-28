import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('resolve')
  async resolve(@Query('slug') slug?: string, @Query('host') host?: string) {
    let lookup = slug;
    if (!lookup && host) {
      lookup = host.split(':')[0]?.split('.')[0];
    }
    if (!lookup) {
      throw new NotFoundException('No slug or host provided');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: lookup } });
    if (!tenant) {
      throw new NotFoundException(`Unknown tenant: ${lookup}`);
    }
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: tenant.branding,
    };
  }
}
