import type { Metadata } from 'next';
import { Fraunces, Nunito, IBM_Plex_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '../lib/providers';
import { RTL_LOCALES } from '../i18n/locales';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OpenGive — Follow the money. Demand transparency.',
  description:
    'Open-source global charity accountability dashboard. Track donations, detect anomalies, and visualize money flows across 30+ national registries.',
  openGraph: {
    title: 'OpenGive — Follow the money. Demand transparency.',
    description:
      'Open-source global charity accountability dashboard. Track donations, detect anomalies, and visualize money flows across 30+ national registries.',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale is resolved by next-intl/server via i18n/request.ts (cookie-based).
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = RTL_LOCALES.includes(locale as 'ar') ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme="light"
      suppressHydrationWarning
    >
      <body
        className={`${fraunces.variable} ${nunito.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
