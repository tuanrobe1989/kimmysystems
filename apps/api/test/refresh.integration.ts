import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma.service';

describe('Refresh rotation with PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  const account = { email: 'rotate@example.com', password: 'correct-horse-battery', name: 'Rotation Tester' };
  const post = (path: string, body: object) => request(app.getHttpServer()).post(`/api/v1/auth/${path}`).send(body);
  const familySessions = (familyId: string) => db.session.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } });
  // The newest live session belongs to the chain under test (register in beforeAll owns an older family).
  const currentFamily = async () => (await db.session.findFirstOrThrow({ where: { revokedAt: null }, orderBy: { createdAt: 'desc' } })).familyId;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    await db.user.deleteMany(); // setup.ts refuses any non-test database.
    await post('register', account).expect(201);
  });
  afterAll(async () => { await app?.close(); });

  it('rotates: new tokens issued, old session revoked, family preserved', async () => {
    const first = (await post('login', account).expect(200)).body;
    const second = (await post('refresh', { refreshToken: first.refreshToken }).expect(200)).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(200);

    const familyId = await currentFamily();
    const sessions = await familySessions(familyId);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].revokedAt).not.toBeNull();
    expect(sessions[1].revokedAt).toBeNull();

    // Replaying the rotated-out token revokes the ENTIRE family, newest token included.
    await post('refresh', { refreshToken: first.refreshToken }).expect(401);
    expect((await familySessions(familyId)).every((s) => s.revokedAt !== null)).toBe(true);
    await post('refresh', { refreshToken: second.refreshToken }).expect(401);
  });

  it('keeps other login families untouched when one family is revoked', async () => {
    const a = (await post('login', account).expect(200)).body;
    const b = (await post('login', account).expect(200)).body;
    const rotatedA = (await post('refresh', { refreshToken: a.refreshToken }).expect(200)).body;
    await post('refresh', { refreshToken: a.refreshToken }).expect(401); // nukes family A
    await post('refresh', { refreshToken: rotatedA.refreshToken }).expect(401);
    await post('refresh', { refreshToken: b.refreshToken }).expect(200); // family B still alive
  });

  it('rejects expired sessions and revokes their family', async () => {
    const { refreshToken } = (await post('login', account).expect(200)).body;
    const live = await db.session.findFirstOrThrow({ where: { revokedAt: null, user: { email: account.email } }, orderBy: { createdAt: 'desc' } });
    await db.session.update({ where: { id: live.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await post('refresh', { refreshToken }).expect(401);
    expect((await db.session.findUniqueOrThrow({ where: { id: live.id } })).revokedAt).not.toBeNull();
  });

  it('returns the same 401 for unknown and revoked tokens', async () => {
    const unknown = (await post('refresh', { refreshToken: 'x'.repeat(64) }).expect(401)).body;
    const { refreshToken } = (await post('login', account).expect(200)).body;
    await post('logout', { refreshToken }).expect(204);
    const revoked = (await post('refresh', { refreshToken }).expect(401)).body;
    expect(unknown.message).toBe(revoked.message);
  });

  it.each([{}, { refreshToken: 'short' }, { refreshToken: 42 }])('rejects malformed refresh body %#', async (body) => { await post('refresh', body as object).expect(400); });

  it('logout is idempotent and revokes only the presented session', async () => {
    const a = (await post('login', account).expect(200)).body;
    const b = (await post('login', account).expect(200)).body;
    await post('logout', { refreshToken: a.refreshToken }).expect(204);
    await post('logout', { refreshToken: a.refreshToken }).expect(204);
    await post('logout', { refreshToken: 'y'.repeat(64) }).expect(204);
    await post('refresh', { refreshToken: b.refreshToken }).expect(200);
  });

  it('documents refresh and logout in the OpenAPI spec', async () => {
    const spec = (await request(app.getHttpServer()).get('/docs-json').expect(200)).body;
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(['/api/v1/auth/refresh', '/api/v1/auth/logout']));
  });
});
