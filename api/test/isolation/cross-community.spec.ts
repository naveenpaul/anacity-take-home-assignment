import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: cross-community within a tenant', () => {
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
      await prisma.membershipRole.deleteMany({ where: { roleId: createdRoleId } });
      await prisma.role.deleteMany({ where: { id: createdRoleId } });
    }
    await app.close();
  });

  it('alice is admin in Lakeside, resident in Falcon — Lakeside roles list works', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/roles`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('alice as resident in Falcon cannot list Falcon roles (no assign_roles there)', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${falcon}/roles`)
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/assign_roles/);
  });

  it('different community → different ability for the same user and same endpoint shape', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const lakesideMe = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/me`)
      .set('Cookie', cookie);
    const falconMe = await request(app.getHttpServer())
      .get(`/v1/communities/${falcon}/me`)
      .set('Cookie', cookie);
    expect(lakesideMe.status).toBe(200);
    expect(falconMe.status).toBe(200);
    expect(lakesideMe.body.permissions).toEqual(expect.arrayContaining(['assign_roles', 'manage_branding']));
    expect(falconMe.body.permissions).not.toContain('assign_roles');
    expect(falconMe.body.permissions).not.toContain('manage_branding');
  });

  it('an admin in two communities cannot mutate a role through the wrong community path', async () => {
    const cookie = await login(app, 'bob@sobha.dev');
    const dream = await findCommunityIdByName(prisma, 'Dream Acres');
    const forest = await findCommunityIdByName(prisma, 'Forest View');

    const createRes = await request(app.getHttpServer())
      .post(`/v1/communities/${dream}/roles`)
      .set('Cookie', cookie)
      .send({
        name: '__test_wrong_path_role',
        permissions: ['approve_visitor'],
      });
    expect(createRes.status).toBe(201);
    createdRoleId = createRes.body.id;

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/communities/${forest}/roles/${createdRoleId}`)
      .set('Cookie', cookie)
      .send({ description: 'should not apply through another community path' });
    expect(patchRes.status).toBe(400);
    expect(patchRes.body.message).toMatch(/belong to this community/i);

    const role = await prisma.role.findUnique({ where: { id: createdRoleId } });
    expect(role?.description).toBeNull();
  });

  it('an admin in two communities cannot grant a role through the wrong community path', async () => {
    const cookie = await login(app, 'bob@sobha.dev');
    const dream = await findCommunityIdByName(prisma, 'Dream Acres');
    const forest = await findCommunityIdByName(prisma, 'Forest View');

    if (!createdRoleId) {
      const createRes = await request(app.getHttpServer())
        .post(`/v1/communities/${dream}/roles`)
        .set('Cookie', cookie)
        .send({
          name: '__test_wrong_path_role_for_grant',
          permissions: ['approve_visitor'],
        });
      expect(createRes.status).toBe(201);
      createdRoleId = createRes.body.id;
    }

    const dreamMembership = await prisma.membership.findFirst({
      where: { communityId: dream, user: { email: 'bob@sobha.dev' } },
    });

    const grantRes = await request(app.getHttpServer())
      .post(`/v1/communities/${forest}/memberships/${dreamMembership!.id}/roles`)
      .set('Cookie', cookie)
      .send({ roleId: createdRoleId });
    expect(grantRes.status).toBe(400);
    expect(grantRes.body.message).toMatch(/belong to this community/i);

    const accidentalGrant = await prisma.membershipRole.findFirst({
      where: { membershipId: dreamMembership!.id, roleId: createdRoleId },
    });
    createdGrantId = accidentalGrant?.id ?? null;
    expect(accidentalGrant).toBeNull();
  });
});
