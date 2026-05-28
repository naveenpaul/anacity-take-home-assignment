import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Bootstraps a NestJS app with the same global setup as main.ts
 * (cookie parser, validation pipe, `/v1` prefix). Returns the app —
 * caller is responsible for `app.close()` in afterAll.
 *
 * Tests run against the dev DB. Mutations clean up after themselves in
 * afterAll. For a production CI, swap to a separate test DB with a
 * reset-and-seed step before the run.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

/**
 * Logs in as a seed user and returns the session cookie ready to drop
 * into `request(...).set('Cookie', cookie)`.
 */
export async function login(
  app: INestApplication,
  email: string,
  password = 'dev',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password });
  if (res.status !== 201) {
    throw new Error(`login(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const setCookie = res.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookieHeader) throw new Error(`login(${email}) returned no cookie`);
  return cookieHeader.split(';')[0]!;
}

export async function findCommunityIdByName(
  prisma: PrismaService,
  namePart: string,
): Promise<string> {
  const c = await prisma.community.findFirst({ where: { name: { contains: namePart } } });
  if (!c) throw new Error(`No community matching name: ${namePart}`);
  return c.id;
}

export async function findUnitInBlock(
  prisma: PrismaService,
  communityName: string,
  blockName: string,
): Promise<{ id: string; blockId: string; communityId: string; label: string }> {
  const unit = await prisma.unit.findFirst({
    where: { block: { community: { name: { contains: communityName } }, name: blockName } },
    include: { block: true },
  });
  if (!unit) throw new Error(`No unit in ${communityName}/${blockName}`);
  return {
    id: unit.id,
    blockId: unit.blockId,
    communityId: unit.block.communityId,
    label: unit.label,
  };
}
