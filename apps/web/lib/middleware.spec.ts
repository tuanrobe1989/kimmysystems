import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const site = { id: 'cmf1234560000abcdef1234567', slug: 'demo', name: 'Demo', defaultLocale: 'vi', locales: ['vi', 'en'], settings: {} };
async function run(path: string, headers: Record<string, string> = {}, status = 200, origin = 'http://demo.localhost:3000') {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => status === 200 ? Response.json(site) : new Response(null, { status })));
  const { middleware } = await import('../middleware');
  return middleware(new NextRequest(`${origin}${path}`, { headers: { host: 'demo.localhost:3000', ...headers } }));
}
afterEach(() => vi.unstubAllGlobals());
describe('multi-site middleware', () => {
  it('overwrites forged tenant context on the request', async () => {
    const response = await run('/', { 'x-site-id': 'forged', 'x-forwarded-host': 'kimmyphungmakeup.localhost' });
    expect(response.headers.get('x-middleware-request-x-site-id')).toBe(site.id);
    expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBeNull();
    expect(response.headers.get('x-site-id')).toBeNull();
  });
  it('redirects default locale preserving query and validated host', async () => {
    const response = await run('/vi/gioi-thieu?from=test', { 'x-forwarded-host': 'attacker.example' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('http://demo.localhost:3000/gioi-thieu?from=test');
  });
  it('serves the default language by rewrite without a browser redirect', async () => {
    const response = await run('/?from=test', { 'accept-language': 'en-US,en;q=0.9', cookie: 'NEXT_LOCALE=en' });
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://demo.localhost:3000/vi?from=test');
    expect(response.headers.get('x-middleware-request-x-site-locale')).toBe('vi');
  });
  it('keeps the non-default locale path', async () => {
    const response = await run('/en/about');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-site-locale')).toBe('en');
  });
  it('preserves the internal server origin instead of proxying to the tenant hostname', async () => {
    const response = await run('/gioi-thieu?from=test', {}, 200, 'http://localhost:3000');
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/vi/gioi-thieu?from=test');
    expect(response.headers.get('x-middleware-request-host')).toBe('demo.localhost:3000');
  });
  it('returns 404 for unknown domains', async () => { expect((await run('/vi', {}, 404)).status).toBe(404); });
  it('returns 404 for unsupported locales', async () => { expect((await run('/fr')).status).toBe(404); });
  it('returns 503 with retry guidance for API outages', async () => {
    const response = await run('/vi', {}, 500);
    expect(response.status).toBe(503); expect(response.headers.get('retry-after')).toBe('5'); expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects invalid hosts before lookup', async () => { expect((await run('/vi', { host: 'bad/host' })).status).toBe(404); expect(fetch).not.toHaveBeenCalled(); });
});
