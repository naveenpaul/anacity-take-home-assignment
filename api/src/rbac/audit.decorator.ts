import { SetMetadata } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export const AUDIT_KEY = 'rbac_audit';

export type AuditMetadata = {
  entity: 'Role' | 'RolePermission' | 'Membership' | 'MembershipRole';
  action: 'create' | 'update' | 'delete';
  fetchBefore?: (
    prisma: PrismaService,
    params: Record<string, string>,
    body: Record<string, unknown>,
  ) => Promise<unknown>;
};

export const Audit = (meta: AuditMetadata) => SetMetadata(AUDIT_KEY, meta);
