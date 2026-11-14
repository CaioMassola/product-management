import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg', permanent: true },
    ];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
