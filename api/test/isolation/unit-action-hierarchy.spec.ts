import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('isolation: UnitAction hierarchy validation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('posting a Falcon unit_id under the Lakeside :communityId rejects with 400', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const falconUnit = await prisma.unit.findFirst({ where: { block: { communityId: falcon } } });

    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${falconUnit!.id}/actions`)
      .set('Cookie', cookie)
      .send({ action_type: 'visitor_approved' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not belong/i);
  });

  it('reading a Falcon unit_id under the Lakeside :communityId rejects with 400', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const falcon = await findCommunityIdByName(prisma, 'Falcon');
    const falconUnit = await prisma.unit.findFirst({ where: { block: { communityId: falcon } } });

    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/units/${falconUnit!.id}/actions`)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not belong/i);
  });

  it('an unknown action_type is rejected with 400', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const unit = await prisma.unit.findFirst({ where: { block: { communityId: lakeside } } });
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unit!.id}/actions`)
      .set('Cookie', cookie)
      .send({ action_type: 'rocket_launch' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown action_type/);
  });

  it('UnitAction has no UPDATE/DELETE endpoint — it is append-only', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    const unit = await prisma.unit.findFirst({ where: { block: { communityId: lakeside } } });
    // Record one action so we can try to mutate it.
    const createRes = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/units/${unit!.id}/actions`)
      .set('Cookie', cookie)
      .send({ action_type: 'visitor_approved', metadata: { test: 'hierarchy-spec' } });
    expect(createRes.status).toBe(201);
    const actionId = createRes.body.id;
    // No endpoint exists for PATCH/DELETE → router returns 404
    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/communities/${lakeside}/units/${unit!.id}/actions/${actionId}`)
      .set('Cookie', cookie)
      .send({ action_type: 'maintenance_raised' });
    expect(patchRes.status).toBe(404);
    const deleteRes = await request(app.getHttpServer())
      .delete(`/v1/communities/${lakeside}/units/${unit!.id}/actions/${actionId}`)
      .set('Cookie', cookie);
    expect(deleteRes.status).toBe(404);

    // Cleanup the row we created
    await prisma.unitAction.delete({ where: { id: actionId } });
  });
});
