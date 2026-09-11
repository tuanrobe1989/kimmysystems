import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getApiUrl } from './env';
import { siteSchema, pageSchema } from './contracts';
import { parseHost } from './routing';

export const getSite = cache(async () => {
  const requestHeaders = await headers();
  const host = parseHost(requestHeaders.get('host'));
  if (!host) notFound();
  // Resolve the actual host again in the server boundary; forged tenant headers
  // cannot select a different tenant even if middleware is bypassed.
  const response = await fetch(`${getApiUrl()}/sites/resolve?domain=${encodeURIComponent(host)}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Site service unavailable');
  const site = siteSchema.parse(await response.json());
  const claimedId = requestHeaders.get('x-site-id');
  if (claimedId && claimedId !== site.id) notFound();
  return site;
});

export const getPage = cache(async (locale: string, slug: string) => {
  const site = await getSite();
  if (!site.locales.some((value) => value === locale)) notFound();
  const response = await fetch(`${getApiUrl()}/sites/${encodeURIComponent(site.id)}/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
  if (response.status === 404 || response.status === 400) notFound();
  if (!response.ok) throw new Error('Page service unavailable');
  return pageSchema.parse(await response.json());
});
