import { describe, expect, it } from 'vitest';
import { pagePath, parseHost, routeLocale } from './routing';
describe('hostname parsing', () => {
  it.each(['kimmyphungmakeup.localhost:3000', 'KIMMYPHUNGMAKEUP.LOCALHOST'])('normalizes %s', (host) => { expect(parseHost(host)).toBe('kimmyphungmakeup.localhost'); });
  it.each([null, '', 'user@host', 'https://host', 'host/path', 'a..b', '-host', 'host-', 'host:0', 'host:65536', 'host:abc', 'host\r\nx-site-id:abc'])('rejects %s', (host) => { expect(parseHost(host)).toBeNull(); });
});
describe('locale routing', () => {
  const site = { defaultLocale: 'vi' as const, locales: ['vi', 'en'] as ('vi' | 'en')[] };
  it('redirects root to default locale', () => { expect(routeLocale('/', site)).toEqual({ kind: 'redirect', pathname: '/vi' }); });
  it('preserves unprefixed content path', () => { expect(routeLocale('/gioi-thieu', site)).toEqual({ kind: 'redirect', pathname: '/vi/gioi-thieu' }); });
  it('renders supported locale', () => { expect(routeLocale('/en/about', site)).toEqual({ kind: 'render', locale: 'en' }); });
  it('does not silently fall back from unsupported locale', () => { expect(routeLocale('/fr/about', site)).toEqual({ kind: 'not-found' }); });
  it('rejects a supported app locale disabled on the site', () => { expect(routeLocale('/en', { defaultLocale: 'vi', locales: ['vi'] })).toEqual({ kind: 'not-found' }); });
  it('uses actual translation slugs', () => { expect(pagePath('en', 'about')).toBe('/en/about'); expect(pagePath('vi', 'home')).toBe('/vi'); });
});
