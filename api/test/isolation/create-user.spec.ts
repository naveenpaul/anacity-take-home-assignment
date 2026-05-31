import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

// POST /communities/:id/users mints a brand-new global user and seats them
// in the community. It is assign_roles-gated and path-bound, so the same
// isolation rules as role grants apply. Uses a fixed throwaway email,
// cleaned up before and after so reruns are idempotent.
const NEW_EMAIL = 'qa-create-user@prestige.dev';

describe('isolation: user provisioning (create-user)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: NEW_EMAIL } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: NEW_EMAIL } });
    await app.close();
  });

  it('a non-admin cannot create a user (lacks assign_roles)', async () => {
    const cookie = await login(app, 'dave@prestige.dev'); // resident @ Falcon
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${falcon}/users`)
      .set('Cookie', cookie)
      .send({ name: 'Mallory', email: 'mallory-should-not-exist@prestige.dev' });
    expect(res.status).toBe(403);
    // and the account must not have been created
    const leaked = await prisma.user.findUnique({
      where: { email: 'mallory-should-not-exist@prestige.dev' },
    });
    expect(leaked).toBeNull();
  });

  it('an admin creates a new user seated in this community and tenant', async () => {
    const cookie = await login(app, 'alice@prestige.dev'); // admin @ Lakeside
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/users`)
      .set('Cookie', cookie)
      .send({ name: 'QA New User', email: NEW_EMAIL });
    expect(res.status).toBe(201);

    const community = await prisma.community.findUnique({
      where: { id: lakeside },
      select: { tenantId: true },
    });
    const membership = await prisma.membership.findFirst({
      where: { user: { email: NEW_EMAIL }, communityId: lakeside, deletedAt: null },
    });
    expect(membership).not.toBeNull();
    // membership is scoped to the community's tenant — no cross-tenant leak
    expect(membership!.tenantId).toBe(community!.tenantId);
  });

  it('rejects creating a user whose email already exists', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/users`)
      .set('Cookie', cookie)
      .send({ name: 'Duplicate', email: 'bob@sobha.dev' });
    expect(res.status).toBe(400);
  });
});
