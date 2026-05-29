import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Observable, from } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_KEY, type AuditMetadata } from './audit.decorator';

/**
 * Writes a RbacAuditLog row after any controller method tagged with @Audit().
 * The `before` snapshot is captured before the handler runs (if a fetch hook
 * is provided); the `after` snapshot is captured from the handler's return.
 *
 * Design doc §7: every RBAC mutation must produce an audit row.
 *
 * Reliability today: the audit write is awaited before the handler's response
 * is emitted (concatMap), so a failed audit surfaces as a 500 to the caller
 * rather than a silently dropped row. This is BEST-EFFORT — the underlying
 * mutation has already committed by the time we try to write the audit row,
 * so a Postgres outage between the two leaves a mutation with no audit
 * trail. The production fix per design doc §10 is to write the audit row
 * inside the same Prisma `$transaction` as the mutation (services-layer
 * change); that work is deferred.
 */
@Injectable()
export class RbacAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RbacAuditInterceptor.name);

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
      concatMap((after: unknown) =>
        from(this.writeAudit(meta, req.params, actorUserId, before, after)).pipe(
          map(() => after),
        ),
      ),
    );
  }

  private async writeAudit(
    meta: AuditMetadata,
    params: Record<string, string>,
    actorUserId: string | undefined,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    if (!actorUserId) return;

    const community = params['communityId'] ?? params['cid'];
    let tenantId: string | null = null;
    if (community) {
      const c = await this.prisma.community.findUnique({
        where: { id: community },
        select: { tenantId: true },
      });
      tenantId = c?.tenantId ?? null;
    }
    if (!tenantId) {
      const a = after as { tenantId?: string } | null;
      tenantId = a?.tenantId ?? null;
    }
    if (!tenantId) {
      // No tenant context available — log loudly rather than silently
      // skip. An audited mutation without a tenant ID is a bug in the
      // controller or the @Audit metadata; we'd rather see it.
      this.logger.warn(
        `Skipping audit for ${meta.entity}.${meta.action}: no tenant ID could be resolved`,
      );
      return;
    }

    const entityId =
      (after as { id?: string } | null)?.id ??
      (before as { id?: string } | null)?.id ??
      params['mrid'] ??
      params['mid'] ??
      params['rid'] ??
      params['id'] ??
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
  }
}
