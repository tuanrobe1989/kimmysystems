import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma.service';

describe('Auth with PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  const account = { email: 'kimmy@example.com', password: 'correct-horse-battery', name: 'Kimmy Phùng' };
  const post = (path: string, body: object) => request(app.getHttpServer()).post(`/api/v1/auth/${path}`).send(body);
  const me = (authorization?: string) => {
    const req = request(app.getHttpServer()).get('/api/v1/auth/me');
    return authorization ? req.set('Authorization', authorization) : req;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    await db.user.deleteMany(); // setup.ts refuses any non-test database.
  });
  afterAll(async () => { await app?.close(); });

  it('registers an account, stores only an argon2id hash, and opens a session', async () => {
    const response = await post('register', account).expect(201);
    expect(response.body.user).toMatchObject({ email: account.email, name: account.name });
    expect(response.body).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String), expiresIn: 900 });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const user = await db.user.findUniqueOrThrow({ where: { email: account.email }, include: { sessions: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(account.password);
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0].refreshTokenHash).not.toBe(response.body.refreshToken);
    expect(user.sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it('normalizes email case and rejects duplicates with 409', async () => {
    await post('register', { ...account, email: 'KIMMY@EXAMPLE.COM' }).expect(409);
  });
  it.each([
    { ...account, email: 'not-an-email' },
    { ...account, password: 'short' },
    { ...account, name: '  ' },
    { email: account.email, password: account.password },
  ])('rejects malformed registration %#', async (body) => { await post('register', body).expect(400); });

  it('logs in and issues a fresh session per login', async () => {
    const response = await post('login', { email: 'Kimmy@Example.com ', password: account.password }).expect(200);
    expect(response.body.user.email).toBe(account.email);
    expect(await db.session.count()).toBe(2);
  });
  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const wrongPassword = (await post('login', { email: account.email, password: 'wrong-password' }).expect(401)).body;
    const unknownEmail = (await post('login', { email: 'nobody@example.com', password: account.password }).expect(401)).body;
    expect(wrongPassword.message).toBe(unknownEmail.message); // no account enumeration
  });

  it('reads the signed-in account with a bearer token', async () => {
    const { accessToken } = (await post('login', account).expect(200)).body;
    const response = await me(`Bearer ${accessToken}`).expect(200);
    expect(response.body).toMatchObject({ email: account.email, name: account.name });
    expect(response.body).not.toHaveProperty('passwordHash');
  });
  it.each([undefined, 'Bearer not-a-token', 'Basic abc', 'Bearer '])('rejects /me with bad authorization %#', async (header) => { await me(header).expect(401); });

  it('documents auth endpoints in the OpenAPI spec', async () => {
    const spec = (await request(app.getHttpServer()).get('/docs-json').expect(200)).body;
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/me']));
    expect(spec.components.schemas.AuthSessionDto.properties.refreshToken).toBeDefined();
  });
});
