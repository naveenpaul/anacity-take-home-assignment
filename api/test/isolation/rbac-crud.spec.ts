import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, findCommunityIdByName } from '../helpers';
import { PrismaService } from '../../src/prisma/prisma.service';

const BOGUS_UUID = '00000000-0000-0000-0000-000000000000';

// Covers the rbac read methods and the grant/revoke/update/delete error
// branches that the security-focused isolation specs don't reach. alice is
// admin @ Lakeside (has assign_roles there), so she can drive every path.
describe('rbac: CRUD + read coverage', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lakeside: string;
  let falcon: string;

  // (community_id, name) is unique even across soft-deletes, so the custom
  // role this suite creates must be hard-removed for reruns to be idempotent.
  async function cleanupTempRoles() {
    await prisma.role.deleteMany({
      where: { communityId: lakeside, name: { startsWith: 'QA Temp' } },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    lakeside = await findCommunityIdByName(prisma, 'Lakeside');
    falcon = await findCommunityIdByName(prisma, 'Falcon');
    await cleanupTempRoles();
  });

  afterAll(async () => {
    await cleanupTempRoles();
    await app.close();
  });

  // ---------- reads ----------
  it('lists roles in the community (templates instantiated)', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/roles`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((r: { templateKey: string }) => r.templateKey === 'admin')).toBe(true);
  });

  it('lists memberships in the community', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/memberships`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // shape: each member has a user + a roles array
    expect(res.body[0]).toHaveProperty('user.email');
    expect(Array.isArray(res.body[0].roles)).toBe(true);
  });

  it('lists eligible (addable) tenant users for the community', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const res = await request(app.getHttpServer())
      .get(`/v1/communities/${lakeside}/eligible-users`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // current members must NOT appear in the eligible list
    const memberEmails = new Set(res.body.map((u: { email: string }) => u.email));
    expect(memberEmails.has('alice@prestige.dev')).toBe(false);
  });

  // ---------- grant/revoke error branches ----------
  it('grant rejects a role from another community (400)', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const falconRole = await prisma.role.findFirst({
      where: { communityId: falcon, templateKey: 'resident' },
    });
    const aliceLakeside = await prisma.membership.findFirst({
      where: { user: { email: 'alice@prestige.dev' }, communityId: lakeside },
    });
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/memberships/${aliceLakeside!.id}/roles`)
      .set('Cookie', cookie)
      .send({ roleId: falconRole!.id });
    expect(res.status).toBe(400);
  });

  it('grant rejects a block from another community (400)', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const lakesideRole = await prisma.role.findFirst({
      where: { communityId: lakeside, templateKey: 'resident' },
    });
    const falconBlock = await prisma.block.findFirst({ where: { communityId: falcon } });
    const aliceLakeside = await prisma.membership.findFirst({
      where: { user: { email: 'alice@prestige.dev' }, communityId: lakeside },
    });
    const res = await request(app.getHttpServer())
      .post(`/v1/communities/${lakeside}/memberships/${aliceLakeside!.id}/roles`)
      .set('Cookie', cookie)
      .send({ roleId: lakesideRole!.id, blockId: falconBlock!.id });
    expect(res.status).toBe(400);
  });

  it('revoke rejects an unknown grant (404)', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const aliceLakeside = await prisma.membership.findFirst({
      where: { user: { email: 'alice@prestige.dev' }, communityId: lakeside },
    });
    const res = await request(app.getHttpServer())
      .delete(
        `/v1/communities/${lakeside}/memberships/${aliceLakeside!.id}/roles/${BOGUS_UUID}`,
      )
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  // ---------- role update/delete lifecycle ----------
  it('creates, updates, then deletes a custom role', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const base = `/v1/communities/${lakeside}/roles`;

    const created = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', cookie)
      .send({ name: 'QA Temp Role', permissions: ['view_notices'] });
    expect(created.status).toBe(201);
    const roleId = created.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`${base}/${roleId}`)
      .set('Cookie', cookie)
      .send({ name: 'QA Temp Role (edited)', permissions: ['view_notices', 'view_visitors'] });
    expect(updated.status).toBe(200);

    const deleted = await request(app.getHttpServer())
      .delete(`${base}/${roleId}`)
      .set('Cookie', cookie);
    expect(deleted.status).toBe(200);

    const gone = await prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
    });
    expect(gone).toBeNull();
  });

  it('rejects a duplicate role name with 400 (not 500)', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const base = `/v1/communities/${lakeside}/roles`;
    const first = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', cookie)
      .send({ name: 'QA Temp Dupe', permissions: ['view_notices'] });
    expect(first.status).toBe(201);

    const dupe = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', cookie)
      .send({ name: 'QA Temp Dupe', permissions: ['view_notices'] });
    expect(dupe.status).toBe(400);
  });

  it('lets a role name be reused after the prior role is deleted', async () => {
    const cookie = await login(app, 'alice@prestige.dev');
    const base = `/v1/communities/${lakeside}/roles`;

    const first = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', cookie)
      .send({ name: 'QA Temp Reuse', permissions: ['view_notices'] });
    expect(first.status).toBe(201);

    const removed = await request(app.getHttpServer())
      .delete(`${base}/${first.body.id}`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);

    // partial unique index (WHERE deleted_at IS NULL) frees the name
    const reused = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', cookie)
      .send({ name: 'QA Temp Reuse', permissions: ['view_visitors'] });
    expect(reused.status).toBe(201);
    expect(reused.body.id).not.toBe(first.body.id);
  });
});
