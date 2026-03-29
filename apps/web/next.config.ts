import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@opengive/ui', '@opengive/types', '@opengive/config'],
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(nextConfig);
