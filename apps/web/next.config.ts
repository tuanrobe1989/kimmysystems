import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { getApiUrl } from './lib/env';

getApiUrl();
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Resolve SEO/page existence before streaming so missing pages send HTTP 404.
  htmlLimitedBots: /.*/,
  allowedDevOrigins: ['*.localhost'],
};
export default createNextIntlPlugin('./i18n/request.ts')(config);
