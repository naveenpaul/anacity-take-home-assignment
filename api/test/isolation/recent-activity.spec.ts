import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

// Covers GET /tenants/me/recent-activity — the home-page cross-community
// feed, scoped to what the caller can see (tenant-wide ⇒ all; community
// memberships ⇒ just those communities).
describe('recent-activity feed', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires the tenant header (400 without X-Tenant-Slug)', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me/recent-activity')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('a tenant-wide admin sees activity across the tenant', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me/recent-activity?limit=10')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // seed records one Prestige action (visitor approved on Lakeside A1)
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('actionType');
    expect(res.body[0]).toHaveProperty('community.name');
  });

  it('caps the result set to the requested limit', async () => {
    const cookie = await login(app, 'boss@prestige.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me/recent-activity?limit=1')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(1);
  });

  it('a community-scoped member only sees their community (empty when none)', async () => {
    // dave is resident @ Falcon, which has no seeded actions → []
    const cookie = await login(app, 'dave@prestige.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me/recent-activity')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // every row, if any, must belong to a community dave is a member of —
    // never a Lakeside action he can't see
    const falconActions = res.body.filter(
      (a: { community: { name: string } }) => a.community.name.includes('Falcon'),
    );
    expect(falconActions.length).toBe(res.body.length);
  });
});
