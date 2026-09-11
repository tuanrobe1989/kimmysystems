import { describe, expect, it } from 'vitest';
import { languagePaths, pagePath, parseHost, routeLocale } from './routing';
describe('hostname parsing', () => {
  it.each(['kimmyphungmakeup.localhost:3000', 'KIMMYPHUNGMAKEUP.LOCALHOST'])('normalizes %s', (host) => { expect(parseHost(host)).toBe('kimmyphungmakeup.localhost'); });
  it.each([null, '', 'user@host', 'https://host', 'host/path', 'a..b', '-host', 'host-', 'host:0', 'host:65536', 'host:abc', 'host\r\nx-site-id:abc'])('rejects %s', (host) => { expect(parseHost(host)).toBeNull(); });
});
describe('locale routing', () => {
  const site = { defaultLocale: 'vi' as const, locales: ['vi', 'en'] as ('vi' | 'en')[] };
  it('rewrites root internally to the default locale', () => { expect(routeLocale('/', site)).toEqual({ kind: 'rewrite', locale: 'vi', pathname: '/vi' }); });
  it('rewrites unprefixed content internally', () => { expect(routeLocale('/gioi-thieu', site)).toEqual({ kind: 'rewrite', locale: 'vi', pathname: '/vi/gioi-thieu' }); });
  it.each([['/vi', '/'], ['/vi/', '/'], ['/vi/gioi-thieu', '/gioi-thieu']])('strips explicit default prefix from %s', (input, output) => { expect(routeLocale(input, site)).toEqual({ kind: 'redirect', pathname: output }); });
  it('renders supported locale', () => { expect(routeLocale('/en/about', site)).toEqual({ kind: 'render', locale: 'en' }); });
  it('does not silently fall back from unsupported locale', () => { expect(routeLocale('/fr/about', site)).toEqual({ kind: 'not-found' }); });
  it('rejects a supported app locale disabled on the site', () => { expect(routeLocale('/en', { defaultLocale: 'vi', locales: ['vi'] })).toEqual({ kind: 'not-found' }); });
  it('uses actual translation slugs and omits only the default locale', () => { expect(pagePath('en', 'about', 'vi')).toBe('/en/about'); expect(pagePath('vi', 'home', 'vi')).toBe('/'); expect(pagePath('vi', 'gioi-thieu', 'vi')).toBe('/gioi-thieu'); });
  it('supports a site whose default language is English', () => {
    const englishSite = { defaultLocale: 'en' as const, locales: site.locales };
    expect(routeLocale('/about', englishSite)).toEqual({ kind: 'rewrite', locale: 'en', pathname: '/en/about' });
    expect(routeLocale('/en/about', englishSite)).toEqual({ kind: 'redirect', pathname: '/about' });
    expect(routeLocale('/vi/gioi-thieu', englishSite)).toEqual({ kind: 'render', locale: 'vi' });
    expect(pagePath('en', 'home', 'en')).toBe('/');
    expect(pagePath('vi', 'home', 'en')).toBe('/vi');
  });
  it('builds hreflang and x-default from actual translations', () => {
    const translations = [{ locale: 'vi', slug: 'gioi-thieu' }, { locale: 'en', slug: 'about' }];
    expect(languagePaths(translations, 'vi')).toEqual({ vi: '/gioi-thieu', en: '/en/about', 'x-default': '/gioi-thieu' });
    expect(languagePaths(translations, 'en')).toEqual({ vi: '/vi/gioi-thieu', en: '/about', 'x-default': '/about' });
  });
  it('does not invent an x-default link when the default translation is missing', () => {
    expect(languagePaths([{ locale: 'en', slug: 'about' }], 'vi')).toEqual({ en: '/en/about' });
  });
});
