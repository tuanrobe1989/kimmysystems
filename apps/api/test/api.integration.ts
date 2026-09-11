import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma.service';
import { seedDatabase } from '../prisma/seed-data';

describe('API with PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  let kimmyId: string;
  let demoId: string;
  const counts = async () => Promise.all([db.site.count(), db.siteDomain.count(), db.page.count(), db.pageTranslation.count()]);
  const get = (path: string) => request(app.getHttpServer()).get(path);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    await db.site.deleteMany(); // setup.ts refuses any non-test database.
    await seedDatabase(db);
    kimmyId = (await db.site.findUniqueOrThrow({ where: { slug: 'kimmyphungmakeup' } })).id;
    demoId = (await db.site.findUniqueOrThrow({ where: { slug: 'demo' } })).id;
  });
  afterAll(async () => { await app?.close(); });

  it('seeds twice without duplicates or changed IDs', async () => {
    const before = await counts();
    expect(before).toEqual([2, 3, 3, 5]);
    await seedDatabase(db);
    expect(await counts()).toEqual(before);
    expect((await db.site.findUniqueOrThrow({ where: { slug: 'kimmyphungmakeup' } })).id).toBe(kimmyId);
  });
  it('exposes unprefixed health and Swagger with all response models', async () => {
    const response = await get('/healthz').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', uptime: expect.any(Number) });
    await get('/api/v1/healthz').expect(404);
    await get('/docs').expect(200);
    const spec = (await get('/docs-json').expect(200)).body;
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(['/healthz', '/api/v1/sites/resolve', '/api/v1/sites/{siteId}/pages/{slug}']));
    expect(spec.components.schemas.PageDto.properties.availableLocales.type).toBe('array');
  });
  it.each(['kimmyphungmakeup.localhost', 'KIMMYPHUNGMAKEUP.LOCALHOST', 'localhost'])('resolves registered alias %s', async (domain) => {
    const response = await get(`/api/v1/sites/resolve?domain=${domain}`).expect(200);
    expect(response.body).toMatchObject({ id: kimmyId, slug: 'kimmyphungmakeup', defaultLocale: 'vi', locales: ['vi', 'en'] });
    expect(response.body).not.toHaveProperty('domains');
  });
  it('resolves a second site independently', async () => { expect((await get('/api/v1/sites/resolve?domain=demo.localhost').expect(200)).body.id).toBe(demoId); });
  it('rejects unknown domains', async () => { await get('/api/v1/sites/resolve?domain=unknown.localhost').expect(404); });
  it.each(['', '?domain=http://localhost', '?domain=localhost:3000', '?domain=a..b', '?domain=x&domain=y', '?domain=localhost/path', '?domain=-invalid.localhost'])('rejects malformed domain %s', async (query) => { await get(`/api/v1/sites/resolve${query}`).expect(400); });
  it('reads localized data with localized alternate slugs', async () => {
    const response = await get(`/api/v1/sites/${kimmyId}/pages/gioi-thieu?locale=vi`).expect(200);
    expect(response.body.title).toBe('Bắt đầu từ chính bạn.');
    expect(response.body.availableLocales).toEqual(['en', 'vi']);
    expect(response.body.translations).toContainEqual({ locale: 'en', slug: 'about' });
    expect((await get(`/api/v1/sites/${kimmyId}/pages/about?locale=en`).expect(200)).body.title).toBe('It starts with you.');
  });
  it('isolates pages with identical slugs across sites', async () => {
    const kimmy = (await get(`/api/v1/sites/${kimmyId}/pages/home?locale=vi`).expect(200)).body;
    const demo = (await get(`/api/v1/sites/${demoId}/pages/home?locale=vi`).expect(200)).body;
    expect(kimmy.title).not.toBe(demo.title);
    expect(demo.availableLocales).toEqual(['vi']);
    await get(`/api/v1/sites/${demoId}/pages/gioi-thieu?locale=vi`).expect(404);
    await get(`/api/v1/sites/${demoId}/pages/home?locale=en`).expect(404);
  });
  it.each(['fr', '', 'vi&locale=en'])('rejects invalid locale %s', async (locale) => { await get(`/api/v1/sites/${kimmyId}/pages/home?locale=${locale}`).expect(400); });
  it('returns 400/404 for invalid IDs and missing pages', async () => {
    await get('/api/v1/sites/not-an-id/pages/home?locale=vi').expect(400);
    await get(`/api/v1/sites/${kimmyId}/pages/missing?locale=vi`).expect(404);
    await get(`/api/v1/sites/${kimmyId}/pages/invalid.slug?locale=vi`).expect(400);
  });
  it.each(['DRAFT', 'FUTURE', 'NO_DATE'] as const)('does not expose %s pages', async (kind) => {
    const key = kind.toLowerCase().replace('_', '-');
    await db.page.create({ data: { siteId: kimmyId, key, status: kind === 'DRAFT' ? 'DRAFT' : 'PUBLISHED', publishedAt: kind === 'NO_DATE' ? null : new Date(kind === 'FUTURE' ? '2099-01-01' : '2020-01-01'), translations: { create: { locale: 'vi', title: 'Private content', slug: key } } } });
    await get(`/api/v1/sites/${kimmyId}/pages/${key}?locale=vi`).expect(404);
  });
  it('enforces tenant-scoped slug uniqueness in PostgreSQL', async () => {
    await expect(db.page.create({ data: { siteId: kimmyId, key: 'duplicate', translations: { create: { locale: 'vi', title: 'Duplicate', slug: 'home' } } } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects a translation attached to another tenant via a composite FK', async () => {
    const page = await db.page.findUniqueOrThrow({ where: { siteId_key: { siteId: kimmyId, key: 'home' } } });
    await expect(db.pageTranslation.create({ data: { pageId: page.id, siteId: demoId, locale: 'fr', title: 'Wrong tenant', slug: 'wrong-tenant' } })).rejects.toMatchObject({ code: 'P2003' });
  });
});
