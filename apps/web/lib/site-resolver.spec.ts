import { describe, expect, it, vi } from 'vitest';
import { createSiteResolver } from './site-resolver';
const site = { id: 'cmf1234560000abcdef1234567', slug: 'demo', name: 'Demo', defaultLocale: 'vi', locales: ['vi'], settings: {} };
describe('bounded site cache', () => {
  it('caches by host and expires after 60 seconds', async () => {
    let now = 0;
    const fetcher = vi.fn().mockImplementation(async () => Response.json(site));
    const resolve = createSiteResolver('http://api', fetcher, () => now);
    await resolve('a.localhost'); await resolve('a.localhost');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await resolve('b.localhost'); expect(fetcher).toHaveBeenCalledTimes(2);
    now = 60_001; await resolve('a.localhost'); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('caches unknown sites as 404', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 404 }));
    const resolve = createSiteResolver('http://api', fetcher);
    expect(await resolve('unknown.localhost')).toBeNull();
    await resolve('unknown.localhost'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not turn outages into cached unknown sites', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(Response.json(site));
    const resolve = createSiteResolver('http://api', fetcher);
    await expect(resolve('demo.localhost')).rejects.toThrow('unavailable');
    expect(await resolve('demo.localhost')).toMatchObject({ slug: 'demo' });
  });
  it('bounds cache size under arbitrary host traffic', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(site));
    const resolve = createSiteResolver('http://api', fetcher);
    for (let i = 0; i < 257; i++) await resolve(`site-${i}.localhost`);
    await resolve('site-0.localhost'); expect(fetcher).toHaveBeenCalledTimes(258);
  });
  it('rejects malformed API contracts', async () => {
    const resolve = createSiteResolver('http://api', vi.fn().mockResolvedValue(Response.json({ id: 'bad' })));
    await expect(resolve('demo.localhost')).rejects.toThrow();
  });
});
