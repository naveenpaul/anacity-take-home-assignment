import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [PrismaModule, TenantsModule],
  controllers: [HealthController],
})
export class AppModule {}
