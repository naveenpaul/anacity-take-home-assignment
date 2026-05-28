import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName, findUnitInBlock } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: cross-tenant', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a prestige user cannot list roles in a sobha community', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const sobhaCid = await findCommunityIdByName(prisma, 'Dream Acres');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${sobhaCid}/roles`)
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permission|membership/i);
  });

  it('a prestige user cannot record an action on a sobha unit', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const sobhaCid = await findCommunityIdByName(prisma, 'Dream Acres');
    const unit = await prisma.unit.findFirst({ where: { block: { communityId: sobhaCid } } });
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${sobhaCid}/units/${unit!.id}/actions`)
      .set('Cookie', cookie)
      .send({ action_type: 'visitor_approved' });
    expect(res.status).toBe(403);
  });

  it('a sobha user cannot read prestige tenant branding', async () => {
    const cookie = await login(app, 'bob@sobha.dev');
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige');
    expect(res.status).toBe(403);
  });

  it('a sobha user cannot mutate prestige branding even with the slug header', async () => {
    const cookie = await login(app, 'bob@sobha.dev');
    const res = await request(app.getHttpServer())
      .patch('/v1/tenants/me/branding')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige')
      .send({ primaryColor: '#000000' });
    expect(res.status).toBe(403);
  });
});
