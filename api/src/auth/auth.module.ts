import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtCookieGuard } from './jwt-cookie.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtCookieGuard],
  exports: [AuthService, JwtCookieGuard],
})
export class AuthModule {}
