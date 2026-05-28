import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { CommunitiesModule } from './communities/communities.module';
import { ActionsModule } from './actions/actions.module';

@Module({
  imports: [PrismaModule, TenantsModule, AuthModule, RbacModule, CommunitiesModule, ActionsModule],
  controllers: [HealthController],
})
export class AppModule {}
