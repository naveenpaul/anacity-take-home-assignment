import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: cross-community within a tenant', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
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
});
