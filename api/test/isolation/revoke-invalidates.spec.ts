import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName, findUnitInBlock } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: revoke takes effect on next request', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdRoleId: string | null = null;
  let createdGrantId: string | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup any partially-created state in case a mid-test failure left
    // it behind.
    if (createdGrantId) {
      await prisma.membershipRole.deleteMany({ where: { id: createdGrantId } });
    }
    if (createdRoleId) {
      await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } });
      await prisma.role.deleteMany({ where: { id: createdRoleId } });
    }
    await prisma.unitAction.deleteMany({
      where: { actionType: 'visitor_approved', metadata: { path: ['test'], equals: 'revoke-spec' } },
    });
    await app.close();
  });

  it('grant → user can act; revoke → next request denies', async () => {
    // alice is admin in Lakeside; carol is a resident there (no
    // approve_visitor by default). Use them as the granter / grantee.
    const adminCookie = await login(app, 'alice@prestige.dev');
    const carolCookie = await login(app, 'carol@anacity.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const unitA1 = await findUnitInBlock(prisma, 'Lakeside', 'Block A');

    // Sanity: carol (resident) currently cannot approve_visitor
    let attempt = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unitA1.id}/actions`)
      .set('Cookie', carolCookie)
      .send({ action_type: 'visitor_approved', metadata: { test: 'revoke-spec', phase: 'before' } });
    expect(attempt.status).toBe(403);

    // alice creates a custom role with approve_visitor + grants it to carol
    const roleRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/roles`)
      .set('Cookie', adminCookie)
      .send({ name: '__test_temp_visitor_role', permissions: ['approve_visitor', 'create_unit_action'] });
    expect(roleRes.status).toBe(201);
    createdRoleId = roleRes.body.id;

    const carolMembership = await prisma.membership.findFirst({
      where: { user: { email: 'carol@anacity.dev' }, communityId: lakeside },
    });
    const grantRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/memberships/${carolMembership!.id}/roles`)
      .set('Cookie', adminCookie)
      .send({ roleId: createdRoleId });
    expect(grantRes.status).toBe(201);
    createdGrantId = grantRes.body.id;

    // After grant: carol's next request can approve
    attempt = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unitA1.id}/actions`)
      .set('Cookie', carolCookie)
      .send({ action_type: 'visitor_approved', metadata: { test: 'revoke-spec', phase: 'after-grant' } });
    expect(attempt.status).toBe(201);

    // Revoke the grant
    const revokeRes = await request(app.getHttpServer())
      .delete(`/v1/communities/${lakeside}/memberships/${carolMembership!.id}/roles/${createdGrantId}`)
      .set('Cookie', adminCookie);
    expect(revokeRes.status).toBe(200);
    createdGrantId = null;

    // After revoke: carol's very next request is denied (no cache TTL —
    // ability re-resolves from DB and the grant is gone)
    attempt = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unitA1.id}/actions`)
      .set('Cookie', carolCookie)
      .send({ action_type: 'visitor_approved', metadata: { test: 'revoke-spec', phase: 'after-revoke' } });
    expect(attempt.status).toBe(403);
  });
});
