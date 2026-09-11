import { z } from 'zod';

export const siteSchema = z.object({
  id: z.string().cuid(), slug: z.string(), name: z.string(),
  defaultLocale: z.enum(['vi', 'en']), locales: z.array(z.enum(['vi', 'en'])).min(1),
  settings: z.object({ theme: z.enum(['rose', 'forest']).optional(), descriptor: z.string().optional(), navigation: z.record(z.array(z.object({ label: z.string(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }))).optional() }).passthrough(),
}).refine((site) => site.locales.includes(site.defaultLocale));
export type Site = z.infer<typeof siteSchema>;
export const pageSchema = z.object({
  title: z.string(), slug: z.string(), seoTitle: z.string().nullable(), seoDescription: z.string().nullable(),
  content: z.array(z.object({ type: z.literal('paragraph'), text: z.string() })),
  availableLocales: z.array(z.enum(['vi', 'en'])),
  translations: z.array(z.object({ locale: z.enum(['vi', 'en']), slug: z.string() })),
});
export type PageData = z.infer<typeof pageSchema>;
