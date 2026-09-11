import type { Site } from './contracts';

export function parseHost(authority: string | null): string | null {
  if (!authority || authority.length > 260) return null;
  const match = /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?$/i.exec(authority);
  if (!match || (match[2] && (+match[2] < 1 || +match[2] > 65535))) return null;
  const host = match[1].toLowerCase();
  if (host.length > 253 || host.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return host;
}

export function routeLocale(pathname: string, site: Pick<Site, 'locales' | 'defaultLocale'>) {
  const segment = pathname.split('/')[1];
  if (segment === site.defaultLocale) {
    return { kind: 'redirect' as const, pathname: pathname.slice(segment.length + 1) || '/' };
  }
  if (site.locales.some((locale) => locale === segment)) return { kind: 'render' as const, locale: segment };
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment)) return { kind: 'not-found' as const };
  return { kind: 'rewrite' as const, locale: site.defaultLocale, pathname: `/${site.defaultLocale}${pathname === '/' ? '' : pathname}` };
}

export function pagePath(locale: string, slug: string, defaultLocale: string) {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${prefix}${slug === 'home' ? '' : `/${slug}`}` || '/';
}

export function languagePaths(translations: { locale: string; slug: string }[], defaultLocale: string) {
  const paths = Object.fromEntries(translations.map((item) => [item.locale, pagePath(item.locale, item.slug, defaultLocale)]));
  // A missing default translation must not produce a link to an unavailable page.
  if (paths[defaultLocale]) paths['x-default'] = paths[defaultLocale];
  return paths;
}
