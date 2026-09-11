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
  if (site.locales.some((locale) => locale === segment)) return { kind: 'render' as const, locale: segment };
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment)) return { kind: 'not-found' as const };
  return { kind: 'redirect' as const, pathname: `/${site.defaultLocale}${pathname === '/' ? '' : pathname}` };
}

export function pagePath(locale: string, slug: string) {
  return `/${locale}${slug === 'home' ? '' : `/${slug}`}`;
}
