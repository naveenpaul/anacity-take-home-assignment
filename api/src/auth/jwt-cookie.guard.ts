import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'anacity_session';

export const SESSION_COOKIE_NAME = COOKIE_NAME;

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string; email: string } }>();
    const token = (req.cookies?.[COOKIE_NAME] as string | undefined) ?? extractBearer(req);
    if (!token) throw new UnauthorizedException('No session');
    const payload = this.auth.verify(token);
    req.user = { id: payload.sub, email: payload.email };
    return true;
  }
}

function extractBearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return undefined;
  return h.slice(7);
}
