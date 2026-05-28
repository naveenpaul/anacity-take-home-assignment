import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [CommunitiesController],
})
export class CommunitiesModule {}
