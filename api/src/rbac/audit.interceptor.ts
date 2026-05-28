import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_KEY, type AuditMetadata } from './audit.decorator';

/**
 * Writes a RbacAuditLog row after any controller method tagged with @Audit().
 * The `before` snapshot is captured before the handler runs (if a fetch hook
 * is provided); the `after` snapshot is captured from the handler's return.
 *
 * Design doc §7: every RBAC mutation must produce an audit row.
 */
@Injectable()
export class RbacAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const meta = this.reflector.get<AuditMetadata | undefined>(AUDIT_KEY, ctx.getHandler());
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest<{ user?: { id: string }; params: Record<string, string>; body: Record<string, unknown> }>();
    const actorUserId = req.user?.id;

    let before: unknown = null;
    if (meta.fetchBefore) {
      try {
        before = await meta.fetchBefore(this.prisma, req.params, req.body);
      } catch {
        before = null;
      }
    }

    return next.handle().pipe(
      tap(async (after: unknown) => {
        if (!actorUserId) return;
        const community = req.params['communityId'] ?? req.params['cid'];
        let tenantId: string | null = null;
        if (community) {
          const c = await this.prisma.community.findUnique({ where: { id: community }, select: { tenantId: true } });
          tenantId = c?.tenantId ?? null;
        }
        if (!tenantId) {
          // Fall back to extracting tenant from `after` if shaped that way.
          const a = after as { tenantId?: string } | null;
          tenantId = a?.tenantId ?? null;
        }
        if (!tenantId) return; // can't audit without a tenant

        const entityId =
          (after as { id?: string } | null)?.id ??
          (before as { id?: string } | null)?.id ??
          req.params['mrid'] ??
          req.params['rid'] ??
          req.params['id'] ??
          '00000000-0000-0000-0000-000000000000';

        await this.prisma.rbacAuditLog.create({
          data: {
            tenantId,
            actorUserId,
            entity: meta.entity,
            entityId,
            action: meta.action,
            before: (before ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
            after:
              meta.action === 'delete'
                ? Prisma.JsonNull
                : ((after ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull),
          },
        });
      }),
    );
  }
}
