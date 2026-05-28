import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: privilege escalation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a non-admin cannot create a role (lacks assign_roles)', async () => {
    const cookie = await login(app, 'dave@prestige.dev'); // resident @ Falcon
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${falcon}/roles`)
      .set('Cookie', cookie)
      .send({ name: 'Self-Granted Admin', permissions: ['assign_roles', 'manage_branding'] });
    expect(res.status).toBe(403);
  });

  it('a non-admin cannot grant themselves a high-privilege role even if it exists', async () => {
    const cookie = await login(app, 'dave@prestige.dev');
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const adminRole = await prisma.role.findFirst({
      where: { communityId: falcon, templateKey: 'admin' },
    });
    const daveMembership = await prisma.membership.findFirst({
      where: { user: { email: 'dave@prestige.dev' }, communityId: falcon },
    });
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${falcon}/memberships/${daveMembership!.id}/roles`)
      .set('Cookie', cookie)
      .send({ roleId: adminRole!.id });
    expect(res.status).toBe(403);
  });

  it('a resident cannot mutate tenant branding (no manage_branding)', async () => {
    const cookie = await login(app, 'dave@prestige.dev');
    const res = await request(app.getHttpServer())
      .patch('/v1/tenants/me/branding')
      .set('Cookie', cookie)
      .set('X-Tenant-Slug', 'prestige')
      .send({ primaryColor: '#FF00FF' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/manage_branding/);
  });
});
