'use client';
import { useEffect } from 'react';

// The root layout is retained during client navigation between locale segments.
export function DocumentLocale({ locale }: { locale: string }) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return null;
}
