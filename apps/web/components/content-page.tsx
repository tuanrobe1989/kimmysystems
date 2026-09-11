import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getPage, getSite } from '@/lib/api';
import { languagePaths, pagePath } from '@/lib/routing';

export async function pageMetadata(locale: string, slug: string): Promise<Metadata> {
  const [page, site] = await Promise.all([getPage(locale, slug), getSite()]);
  const authority = (await headers()).get('host')!;
  const protocol = authority.split(':')[0].endsWith('.localhost') || authority.split(':')[0] === 'localhost' ? 'http' : 'https';
  const origin = `${protocol}://${authority}`;
  return {
    title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined,
    alternates: { canonical: `${origin}${pagePath(locale, slug, site.defaultLocale)}`, languages: Object.fromEntries(Object.entries(languagePaths(page.translations, site.defaultLocale)).map(([language, path]) => [language, `${origin}${path}`])) },
  };
}

export async function ContentPage({ locale, slug }: { locale: string; slug: string }) {
  const [site, page, nav, copy] = await Promise.all([getSite(), getPage(locale, slug), getTranslations({ locale, namespace: 'nav' }), getTranslations({ locale, namespace: 'page' })]);
  return (
    <div data-theme={site.settings.theme ?? 'rose'} className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-6 sm:px-10 lg:px-16">
      <a href="#content" className="sr-only focus:not-sr-only focus:py-4">{nav('skip')}</a>
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line py-7 sm:py-9">
        <Link href={pagePath(locale, 'home', site.defaultLocale)} className="text-lg font-semibold tracking-tight hover:text-primary sm:text-xl">{site.name}</Link>
        <nav aria-label={nav('language')} className="flex items-center gap-2 text-sm">
          {page.translations.map((item) => <Link key={item.locale} href={pagePath(item.locale, item.slug, site.defaultLocale)} hrefLang={item.locale} lang={item.locale} aria-current={item.locale === locale ? 'page' : undefined} className={`px-3 py-3 hover:text-primary ${item.locale === locale ? 'font-bold underline decoration-primary underline-offset-8' : 'text-muted'}`}>{item.locale === 'vi' ? 'Tiếng Việt' : 'English'}</Link>)}
        </nav>
      </header>
      <main id="content" className="flex-1 py-20 sm:py-28 lg:py-36">
        <p className="mb-8 text-xs font-semibold uppercase tracking-[.2em] text-primary">{site.settings.descriptor ?? site.name}</p>
        <h1 className="max-w-4xl text-5xl font-medium leading-[1.15] tracking-[-.055em] sm:text-7xl lg:text-8xl">{page.title}</h1>
        <div className="mt-10 max-w-xl space-y-4 text-base leading-8 text-muted sm:mt-12 sm:text-lg">
          {page.content.map((block, index) => <p key={index}>{block.text}</p>)}
        </div>
        {slug !== 'home' ? <Link className="mt-10 inline-flex min-h-12 items-center border-b border-primary font-semibold text-primary" href={pagePath(locale, 'home', site.defaultLocale)}>{copy('back')} <span aria-hidden="true" className="ml-5">↗</span></Link> : (site.settings.navigation?.[locale] ?? []).map((item) => <Link key={item.slug} className="mt-10 mr-8 inline-flex min-h-12 items-center border-b border-primary font-semibold text-primary" href={pagePath(locale, item.slug, site.defaultLocale)}>{item.label} <span aria-hidden="true" className="ml-5">↗</span></Link>)}
      </main>
      <footer className="flex flex-wrap justify-between gap-4 border-t border-line py-7 text-xs leading-6 text-muted"><span>{site.name}</span><span>{copy('sample')}</span></footer>
    </div>
  );
}
