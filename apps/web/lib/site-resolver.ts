import { siteSchema, type Site } from './contracts';

// A bounded cache avoids unbounded growth from arbitrary Host headers.
export function createSiteResolver(apiUrl: string, fetcher: typeof fetch = fetch, now = Date.now, ttl = 60_000) {
  const cache = new Map<string, { expires: number; site: Site | null }>();
  return async (host: string): Promise<Site | null> => {
    const hit = cache.get(host);
    if (hit && hit.expires > now()) return hit.site;
    const response = await fetcher(`${apiUrl}/sites/resolve?domain=${encodeURIComponent(host)}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok && response.status !== 404) throw new Error('Site service unavailable');
    const site = response.status === 404 ? null : siteSchema.parse(await response.json());
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(host, { site, expires: now() + ttl });
    return site;
  };
}
