import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // For Phase 1 we support English only.
  // In future sprints, locale will be detected from the request via next-intl routing.
  const locale = 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
