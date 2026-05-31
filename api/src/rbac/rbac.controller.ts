import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { CurrentUser, type AuthedUser } from '../auth/current-user.decorator';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './permissions.decorator';
import { Audit } from './audit.decorator';
import { RbacAuditInterceptor } from './audit.interceptor';
import { RbacService } from './rbac.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

class GrantRoleDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  blockId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  initialRoleId?: string;

  @IsOptional()
  @IsUUID()
  initialBlockId?: string;
}

class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @IsOptional()
  @IsUUID()
  initialRoleId?: string;

  @IsOptional()
  @IsUUID()
  initialBlockId?: string;
}

@Controller()
@UseGuards(JwtCookieGuard, PermissionsGuard)
@UseInterceptors(RbacAuditInterceptor)
export class RbacController {
  constructor(
    private readonly rbac: RbacService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- Permissions catalog (no scope) ----------
  @Get('permissions')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  // ---------- Role CRUD (community-scoped) ----------
  @Get('communities/:communityId/roles')
  @RequirePermissions('assign_roles')
  listRoles(@Param('communityId') communityId: string) {
    return this.rbac.listRolesInCommunity(communityId);
  }

  @Post('communities/:communityId/roles')
  @RequirePermissions('assign_roles')
  @Audit({ entity: 'Role', action: 'create' })
  async createRole(@Param('communityId') communityId: string, @Body() dto: CreateRoleDto) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    return this.rbac.createRole({
      tenantId: community.tenantId,
      communityId,
      name: dto.name,
      description: dto.description,
      permissions: dto.permissions,
    });
  }

  @Patch('communities/:communityId/roles/:rid')
  @RequirePermissions('assign_roles')
  @Audit({
    entity: 'Role',
    action: 'update',
    fetchBefore: async (prisma, params) => {
      const role = await prisma.role.findUnique({
        where: { id: params['rid'] ?? '' },
        include: { rolePermissions: { include: { permission: true } } },
      });
      return role
        ? {
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.rolePermissions.map((rp) => rp.permission.key).sort(),
          }
        : null;
    },
  })
  updateRole(
    @Param('communityId') communityId: string,
    @Param('rid') rid: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(communityId, rid, dto);
  }

  @Delete('communities/:communityId/roles/:rid')
  @RequirePermissions('assign_roles')
  @Audit({
    entity: 'Role',
    action: 'delete',
    fetchBefore: async (prisma, params) => {
      return prisma.role.findUnique({ where: { id: params['rid'] ?? '' } });
    },
  })
  deleteRole(@Param('communityId') communityId: string, @Param('rid') rid: string) {
    return this.rbac.deleteRole(communityId, rid);
  }

  // ---------- Memberships + role grants ----------
  @Get('communities/:communityId/memberships')
  @RequirePermissions('assign_roles')
  listMemberships(@Param('communityId') communityId: string) {
    return this.rbac.listMembershipsInCommunity(communityId);
  }

  @Get('communities/:communityId/eligible-users')
  @RequirePermissions('assign_roles')
  listEligibleUsers(@Param('communityId') communityId: string) {
    return this.rbac.listEligibleUsersForCommunity(communityId);
  }

  @Post('communities/:communityId/memberships')
  @RequirePermissions('assign_roles')
  @Audit({ entity: 'Membership', action: 'create' })
  createMembership(
    @Param('communityId') communityId: string,
    @Body() dto: CreateMembershipDto,
    @CurrentUser() current: AuthedUser,
  ) {
    return this.rbac.createMembership({
      userId: dto.userId,
      communityId,
      initialRoleId: dto.initialRoleId ?? null,
      initialBlockId: dto.initialBlockId ?? null,
      grantedById: current.id,
    });
  }

  @Post('communities/:communityId/users')
  @RequirePermissions('assign_roles')
  @Audit({ entity: 'User', action: 'create' })
  createUser(
    @Param('communityId') communityId: string,
    @Body() dto: CreateUserDto,
    @CurrentUser() current: AuthedUser,
  ) {
    return this.rbac.createUserAndMembership({
      communityId,
      name: dto.name,
      email: dto.email,
      password: dto.password ?? null,
      initialRoleId: dto.initialRoleId ?? null,
      initialBlockId: dto.initialBlockId ?? null,
      grantedById: current.id,
    });
  }

  @Post('communities/:communityId/memberships/:mid/roles')
  @RequirePermissions('assign_roles')
  @Audit({ entity: 'MembershipRole', action: 'create' })
  grantRole(
    @Param('communityId') communityId: string,
    @Param('mid') membershipId: string,
    @Body() dto: GrantRoleDto,
    @CurrentUser() current: AuthedUser,
  ) {
    return this.rbac.grantRole({
      communityId,
      membershipId,
      roleId: dto.roleId,
      blockId: dto.blockId ?? null,
      unitId: dto.unitId ?? null,
      grantedById: current.id,
    });
  }

  @Delete('communities/:communityId/memberships/:mid/roles/:mrid')
  @RequirePermissions('assign_roles')
  @Audit({
    entity: 'MembershipRole',
    action: 'delete',
    fetchBefore: async (prisma, params) => {
      return prisma.membershipRole.findUnique({ where: { id: params['mrid'] ?? '' } });
    },
  })
  revokeRole(
    @Param('communityId') communityId: string,
    @Param('mid') membershipId: string,
    @Param('mrid') mrid: string,
  ) {
    return this.rbac.revokeRole(communityId, membershipId, mrid);
  }
}
