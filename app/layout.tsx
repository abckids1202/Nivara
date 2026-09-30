import type { Metadata } from 'next';
import './globals.css';
import { ExperienceTools } from '@/components/experience-tools';
import { CartProvider } from '@/components/cart-provider';
import { AuthSessionRefresh } from '@/components/auth-session-refresh';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nivara.example',
  ),
  title: 'Nivara — everyday living, considered well',
  description:
    'A calm home and everyday-living store for first homes and fresh starts.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Nivara — everyday living, considered well',
    description:
      'A calm home and everyday-living store for first homes and fresh starts.',
    type: 'website',
    siteName: 'Nivara',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <ExperienceTools />
          <AuthSessionRefresh />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
