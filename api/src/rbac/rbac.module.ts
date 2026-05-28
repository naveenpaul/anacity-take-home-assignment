import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { AbilityService } from './ability.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacAuditInterceptor } from './audit.interceptor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [RbacService, AbilityService, PermissionsGuard, RbacAuditInterceptor],
  exports: [AbilityService, PermissionsGuard],
})
export class RbacModule {}
