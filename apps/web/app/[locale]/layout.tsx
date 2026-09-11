import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getSite } from '@/lib/api';
import { DocumentLocale } from '@/components/document-locale';

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const site = await getSite();
  if (!site.locales.some((value) => value === locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}><DocumentLocale locale={locale} />{children}</NextIntlClientProvider>;
}
