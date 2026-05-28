import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityService } from './ability.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

/**
 * Reads required permissions from @RequirePermissions(), pulls the community
 * ID from request params (`communityId` preferred, `cid` fallback), resolves
 * the user's ability for that community, and checks every required perm.
 *
 * Must run AFTER JwtCookieGuard (which attaches req.user).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ability: AbilityService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: { id: string }; params: Record<string, string>; ability?: unknown }>();
    if (!req.user?.id) throw new UnauthorizedException('No authenticated user');

    const communityId = req.params['communityId'] ?? req.params['cid'];
    if (!communityId) {
      throw new BadRequestException('Permission check requires a :communityId route param');
    }

    const ability = await this.ability.resolve(req.user.id, communityId);
    for (const perm of required) {
      if (!ability.can(perm)) {
        throw new ForbiddenException(`Missing permission: ${perm}`);
      }
    }
    // Attach ability for handlers that want to do conditional checks.
    req.ability = ability;
    return true;
  }
}
