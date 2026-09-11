import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import './globals.css';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await headers()).get('x-site-locale') === 'en' ? 'en' : 'vi';
  return <html lang={locale}><body className="min-h-[100dvh] bg-canvas font-sans text-ink antialiased">{children}</body></html>;
}
