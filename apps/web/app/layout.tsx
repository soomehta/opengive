import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Providers } from '../lib/providers';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
  // Provide all messages to client components via NextIntlClientProvider.
  const messages = await getMessages();

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
    >
      <body
        className={`${dmSans.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
