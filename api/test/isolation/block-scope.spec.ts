import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName, findUnitInBlock } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: block-scoped role grants are enforced on UnitActions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdRoleId: string | null = null;
  let createdGrantId: string | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdGrantId) await prisma.membershipRole.deleteMany({ where: { id: createdGrantId } });
    if (createdRoleId) {
      await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } });
      await prisma.role.deleteMany({ where: { id: createdRoleId } });
    }
    await prisma.unitAction.deleteMany({
      where: { actionType: 'visitor_approved', metadata: { path: ['test'], equals: 'block-scope-spec' } },
    });
    await app.close();
  });

  it('a Block-A-scoped grant allows action on Block A, denies on Block B', async () => {
    // alice (admin @ Lakeside) grants carol (resident @ Lakeside) a
    // custom role scoped to Block A only.
    const adminCookie = await login(app, 'alice@prestige.dev');
    const carolCookie = await login(app, 'carol@anacity.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const unitA = await findUnitInBlock(prisma, 'Lakeside', 'Block A');
    const unitB = await findUnitInBlock(prisma, 'Lakeside', 'Block B');

    const roleRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/roles`)
      .set('Cookie', adminCookie)
      .send({
        name: '__test_block_scoped_role',
        permissions: ['approve_visitor', 'create_unit_action'],
      });
    expect(roleRes.status).toBe(201);
    createdRoleId = roleRes.body.id;

    const carolMembership = await prisma.membership.findFirst({
      where: { user: { email: 'carol@anacity.dev' }, communityId: lakeside },
    });
    const grantRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/memberships/${carolMembership!.id}/roles`)
      .set('Cookie', adminCookie)
      .send({ roleId: createdRoleId, blockId: unitA.blockId });
    expect(grantRes.status).toBe(201);
    createdGrantId = grantRes.body.id;

    // Carol on a Block A unit → allowed (scope matches)
    const okRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unitA.id}/actions`)
      .set('Cookie', carolCookie)
      .send({ action_type: 'visitor_approved', metadata: { test: 'block-scope-spec' } });
    expect(okRes.status).toBe(201);
    expect(okRes.body.blockId).toBe(unitA.blockId);

    // Carol on a Block B unit → denied (scope mismatch)
    const denyRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unitB.id}/actions`)
      .set('Cookie', carolCookie)
      .send({ action_type: 'visitor_approved', metadata: { test: 'block-scope-spec' } });
    expect(denyRes.status).toBe(403);
    expect(denyRes.body.message).toMatch(/approve_visitor/);
  });
});
