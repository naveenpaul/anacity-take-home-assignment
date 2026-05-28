import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'approve_visitor',
  'view_visitors',
  'create_notice',
  'view_notices',
  'manage_maintenance',
  'raise_maintenance',
  'view_finance',
  'assign_roles',
  'manage_units',
  'create_unit_action',
];

const TEMPLATES = [
  { key: 'admin',    name: 'Admin',    permissions: PERMISSIONS },
  { key: 'manager',  name: 'Manager',  permissions: ['create_notice', 'view_notices', 'manage_maintenance', 'view_visitors', 'create_unit_action'] },
  { key: 'security', name: 'Security', permissions: ['approve_visitor', 'view_visitors', 'create_unit_action'] },
  { key: 'resident', name: 'Resident', permissions: ['view_notices', 'raise_maintenance', 'view_visitors'] },
];

async function clean() {
  await prisma.unitAction.deleteMany();
  await prisma.rbacAuditLog.deleteMany();
  await prisma.membershipRole.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.systemRoleTemplate.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.block.deleteMany();
  await prisma.community.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Cleaning…');
  await clean();

  console.log('Seeding permissions…');
  await prisma.permission.createMany({ data: PERMISSIONS.map((key) => ({ key })) });
  const perms = await prisma.permission.findMany();
  const permIdByKey = new Map(perms.map((p) => [p.key, p.id]));

  console.log('Seeding system role templates…');
  await prisma.systemRoleTemplate.createMany({
    data: TEMPLATES.map((t) => ({ key: t.key, name: t.name, permissions: t.permissions })),
  });

  console.log('Seeding tenants…');
  const prestige = await prisma.tenant.create({
    data: {
      slug: 'prestige',
      name: 'Prestige',
      branding: { logo: '/brand/prestige.svg', primaryColor: '#0047AB', theme: 'default' },
    },
  });
  const sobha = await prisma.tenant.create({
    data: {
      slug: 'sobha',
      name: 'Sobha',
      branding: { logo: '/brand/sobha.svg', primaryColor: '#16A34A', theme: 'default' },
    },
  });

  console.log('Seeding communities, blocks, units…');
  const lakeside   = await prisma.community.create({ data: { tenantId: prestige.id, name: 'Prestige Lakeside Habitat' } });
  const falcon     = await prisma.community.create({ data: { tenantId: prestige.id, name: 'Prestige Falcon City' } });
  const dreamAcres = await prisma.community.create({ data: { tenantId: sobha.id,    name: 'Sobha Dream Acres' } });
  const forestView = await prisma.community.create({ data: { tenantId: sobha.id,    name: 'Sobha Forest View' } });

  async function seedBlocksUnits(communityId: string, blockCount: number, unitsPerBlock: number) {
    for (let b = 1; b <= blockCount; b++) {
      const letter = String.fromCharCode(64 + b);
      const block = await prisma.block.create({
        data: { communityId, name: `Block ${letter}` },
      });
      for (let u = 1; u <= unitsPerBlock; u++) {
        await prisma.unit.create({ data: { blockId: block.id, label: `${letter}${u}` } });
      }
    }
  }

  await seedBlocksUnits(lakeside.id,   3, 4); // 12 units
  await seedBlocksUnits(falcon.id,     2, 4); // 8 units
  await seedBlocksUnits(dreamAcres.id, 2, 4); // 8 units
  await seedBlocksUnits(forestView.id, 2, 4); // 8 units

  console.log('Instantiating roles per community from system templates…');
  const communities = [lakeside, falcon, dreamAcres, forestView];
  const roleIdByCommunityAndKey = new Map<string, string>();

  for (const community of communities) {
    for (const tpl of TEMPLATES) {
      const role = await prisma.role.create({
        data: {
          tenantId: community.tenantId,
          communityId: community.id,
          templateKey: tpl.key,
          name: tpl.name,
          description: `${tpl.name} role for ${community.name}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: tpl.permissions.map((pkey) => ({
          roleId: role.id,
          permissionId: permIdByKey.get(pkey)!,
        })),
      });
      roleIdByCommunityAndKey.set(`${community.id}:${tpl.key}`, role.id);
    }
  }

  console.log('Seeding users (password: "dev")…');
  const passwordHash = await bcrypt.hash('dev', 10);
  const alice = await prisma.user.create({ data: { email: 'alice@prestige.dev', name: 'Alice', passwordHash } });
  const bob   = await prisma.user.create({ data: { email: 'bob@sobha.dev',      name: 'Bob',   passwordHash } });
  const carol = await prisma.user.create({ data: { email: 'carol@anacity.dev',  name: 'Carol', passwordHash } });
  const dave  = await prisma.user.create({ data: { email: 'dave@prestige.dev',  name: 'Dave',  passwordHash } });
  const ravi  = await prisma.user.create({ data: { email: 'ravi@prestige.dev',  name: 'Ravi',  passwordHash } });

  console.log('Seeding memberships + role grants…');
  async function grant(userId: string, communityId: string, roleKey: string, granterId: string) {
    const membership = await prisma.membership.create({
      data: { userId, communityId, status: 'active' },
    });
    const roleId = roleIdByCommunityAndKey.get(`${communityId}:${roleKey}`)!;
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId, grantedById: granterId },
    });
  }

  // alice — admin @ Lakeside, resident @ Falcon
  await grant(alice.id, lakeside.id, 'admin',    alice.id);
  await grant(alice.id, falcon.id,   'resident', alice.id);
  // bob — admin @ both Sobha
  await grant(bob.id, dreamAcres.id, 'admin', bob.id);
  await grant(bob.id, forestView.id, 'admin', bob.id);
  // carol — cross-tenant resident
  await grant(carol.id, lakeside.id,   'resident', alice.id);
  await grant(carol.id, dreamAcres.id, 'resident', bob.id);
  // dave — resident @ Falcon (recipient of dynamic-role demo)
  await grant(dave.id, falcon.id, 'resident', alice.id);
  // ravi — security across both Prestige
  await grant(ravi.id, lakeside.id, 'security', alice.id);
  await grant(ravi.id, falcon.id,   'security', alice.id);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
