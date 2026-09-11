import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from './lib/env';
import { parseHost, routeLocale } from './lib/routing';
import { createSiteResolver } from './lib/site-resolver';

const resolveSite = createSiteResolver(getApiUrl());

export async function middleware(request: NextRequest) {
  const host = parseHost(request.headers.get('host'));
  const requestHeaders = new Headers(request.headers);
  for (const key of ['x-site-id', 'x-site-locale', 'x-forwarded-host']) requestHeaders.delete(key);
  const missing = () => NextResponse.rewrite(new URL('/site-not-found', request.url), { status: 404, request: { headers: requestHeaders } });
  if (!host) return missing();
  try {
    const site = await resolveSite(host);
    if (!site) return missing();
    const decision = routeLocale(request.nextUrl.pathname, site);
    if (decision.kind === 'not-found') return NextResponse.rewrite(new URL('/page-not-found', request.url), { status: 404, request: { headers: requestHeaders } });
    if (decision.kind === 'redirect') {
      const url = request.nextUrl.clone();
      // Redirect authority comes only from the validated Host, never forwarded headers.
      url.host = request.headers.get('host')!;
      url.pathname = decision.pathname;
      return NextResponse.redirect(url, 301);
    }
    requestHeaders.set('x-site-id', site.id);
    requestHeaders.set('x-site-locale', decision.locale);
    if (decision.kind === 'rewrite') {
      const url = request.nextUrl.clone();
      // Keep Next's internal origin; changing it to Host turns this into an
      // external proxy request on local/custom-domain deployments.
      url.pathname = decision.pathname;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return new NextResponse('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width"><title>Tạm thời gián đoạn</title><body><h1>Dịch vụ tạm thời gián đoạn</h1><p>Vui lòng thử lại sau. Service temporarily unavailable.</p></body></html>', {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' },
    });
  }
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|healthz|site-not-found|page-not-found).*)'] };
