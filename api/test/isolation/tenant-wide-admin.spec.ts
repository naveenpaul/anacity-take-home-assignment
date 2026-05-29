import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: tenant-wide admin grants', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('boss@prestige has admin permissions in every Prestige community', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    for (const name of ['Lakeside', 'Falcon']) {
      const cid = await findCommunityIdByName(prisma, name);
      const res = await request(app.getHttpServer())
        .get(`/v1/communities/${cid}/me`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.permissions).toEqual(
        expect.arrayContaining(['assign_roles', 'manage_branding', 'manage_units']),
      );
    }
  });

  it('boss@prestige can list roles in a Prestige community despite no community membership', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/roles`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('boss@prestige is rejected from any Sobha community (cross-tenant isolation)', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const dreamAcres = await findCommunityIdByName(prisma, 'Dream Acres');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${dreamAcres}/roles`)
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('boss@prestige can mutate Prestige branding but not Sobha branding', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const ok = await request(app.getHttpServer())
      .patch('/v1/tenants/me/branding')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige')
      .send({ primaryColor: '#0047AB' });
    expect(ok.status).toBe(200);

    const denied = await request(app.getHttpServer())
      .patch('/v1/tenants/me/branding')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'sobha')
      .send({ primaryColor: '#000000' });
    expect(denied.status).toBe(403);
  });

  it('boss@prestige can read units and actions in a Prestige community (member-gate reads)', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const units = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/units`)
      .set('Cookie', cookie);
    expect(units.status).toBe(200);
    const actions = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/actions?limit=5`)
      .set('Cookie', cookie);
    expect(actions.status).toBe(200);
  });

  it('/auth/me returns tenant-wide memberships with their accessible community list', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.memberships).toHaveLength(0);
    expect(res.body.tenantWideMemberships).toHaveLength(1);
    const tw = res.body.tenantWideMemberships[0];
    expect(tw.tenant.slug).toBe('prestige');
    expect(tw.accessibleCommunities.map((c: { name: string }) => c.name).sort()).toEqual(
      ['Prestige Falcon City', 'Prestige Lakeside Habitat'],
    );
  });
});
