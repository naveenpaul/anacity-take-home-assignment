import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Mark a route handler as requiring one or more permissions.
 * The PermissionsGuard reads the community ID from the request params
 * (`:communityId` or `:cid`) and resolves the ability for the current user.
 */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);
