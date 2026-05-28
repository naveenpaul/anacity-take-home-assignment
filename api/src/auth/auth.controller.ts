import { Body, Controller, Get, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtCookieGuard, SESSION_COOKIE_NAME } from './jwt-cookie.guard';
import { CurrentUser, type AuthedUser } from './current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validate(dto.email, dto.password);
    const token = this.auth.sign(user);
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return { id: user.id, email: user.email, name: user.name };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtCookieGuard)
  @Get('me')
  async me(@CurrentUser() current: AuthedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
      include: {
        memberships: {
          where: { deletedAt: null, status: 'active' },
          include: {
            community: {
              include: { tenant: { select: { id: true, slug: true, name: true } } },
            },
            membershipRoles: {
              include: {
                role: { select: { id: true, name: true, templateKey: true } },
                block: { select: { id: true, name: true } },
                unit: { select: { id: true, label: true } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Stale session');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        status: m.status,
        community: {
          id: m.community.id,
          name: m.community.name,
          tenant: m.community.tenant,
        },
        roles: m.membershipRoles.map((mr) => ({
          membershipRoleId: mr.id,
          role: mr.role,
          block: mr.block,
          unit: mr.unit,
        })),
      })),
    };
  }
}
