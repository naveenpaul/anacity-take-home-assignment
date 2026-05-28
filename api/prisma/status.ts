import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [
    tenants,
    communities,
    blocks,
    units,
    users,
    memberships,
    membershipRoles,
    templates,
    roles,
    rolePermissions,
    permissions,
    actions,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.community.count(),
    prisma.block.count(),
    prisma.unit.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.membershipRole.count(),
    prisma.systemRoleTemplate.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
    prisma.permission.count(),
    prisma.unitAction.count(),
  ]);

  console.log('=== Anacity DB status ===');
  console.log(`  tenants:           ${tenants}`);
  console.log(`  communities:       ${communities}`);
  console.log(`  blocks:            ${blocks}`);
  console.log(`  units:             ${units}`);
  console.log(`  users:             ${users}`);
  console.log(`  memberships:       ${memberships}`);
  console.log(`  membership_roles:  ${membershipRoles}`);
  console.log(`  templates:         ${templates}`);
  console.log(`  roles:             ${roles}`);
  console.log(`  role_permissions:  ${rolePermissions}`);
  console.log(`  permissions:       ${permissions}`);
  console.log(`  unit_actions:      ${actions}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
