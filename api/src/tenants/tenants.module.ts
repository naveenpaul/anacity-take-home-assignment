import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsAdminController } from './tenants-admin.controller';
import { TenantAdminService } from './tenant-admin.service';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [TenantsController, TenantsAdminController],
  providers: [TenantAdminService],
})
export class TenantsModule {}
