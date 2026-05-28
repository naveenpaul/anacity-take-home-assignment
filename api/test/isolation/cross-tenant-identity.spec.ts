import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login } from '../helpers';

describe('isolation: cross-tenant identity', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('carol has memberships in both tenants — /auth/me returns both', async () => {
    const cookie = await login(app, 'carol@anacity.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const tenantSlugs = new Set(
      res.body.memberships.map((m: { community: { tenant: { slug: string } } }) => m.community.tenant.slug),
    );
    expect(tenantSlugs).toEqual(new Set(['prestige', 'sobha']));
  });

  it('tenant header drives tenant context for tenant-scoped admin endpoints', async () => {
    const cookie = await login(app, 'carol@anacity.dev');
    // carol can read both tenants she's a member of
    const prestige = await request(app.getHttpServer())
      .get('/v1/tenants/me')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige');
    const sobha = await request(app.getHttpServer())
      .get('/v1/tenants/me')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'sobha');
    expect(prestige.status).toBe(200);
    expect(prestige.body.slug).toBe('prestige');
    expect(sobha.status).toBe(200);
    expect(sobha.body.slug).toBe('sobha');
  });

  it('carol cannot mutate either tenant branding (resident-only, no manage_branding)', async () => {
    const cookie = await login(app, 'carol@anacity.dev');
    for (const slug of ['prestige', 'sobha']) {
      const res = await request(app.getHttpServer())
        .patch('/v1/tenants/me/branding')
        .set('Cookie', cookie)
        .set('X-Tenant-Slug', slug)
        .send({ primaryColor: '#000000' });
      expect(res.status).toBe(403);
    }
  });
});
