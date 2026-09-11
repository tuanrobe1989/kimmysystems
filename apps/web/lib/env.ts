import { z } from 'zod';

const apiUrl = z.string().url().refine((value) => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } });
export function getApiUrl() {
  const parsed = apiUrl.safeParse(process.env.API_URL);
  if (!parsed.success) throw new Error('Invalid environment: API_URL');
  return parsed.data.replace(/\/$/, '');
}
