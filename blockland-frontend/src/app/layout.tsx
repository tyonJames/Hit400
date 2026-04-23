import type { Metadata } from 'next';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import { Toaster }      from 'sonner';
import './globals.css';
import { AuthHydrator } from '@/components/shared/auth-hydrator';

const dmSerifDisplay = DM_Serif_Display({
  weight:   ['400'],
  style:    ['normal', 'italic'],
  subsets:  ['latin'],
  variable: '--font-display',
  display:  'swap',
});

const dmSans = DM_Sans({
  weight:   ['300', '400', '500', '600', '700'],
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

export const metadata: Metadata = {
  title: {
    default:  'BlockLand Zimbabwe — Blockchain Land Registry',
    template: '%s | BlockLand Zimbabwe',
  },
  description:
    'A blockchain-based land administration system for Zimbabwe. ' +
    'Built on the Stacks blockchain with Clarity smart contracts.',
  keywords: ['blockchain', 'land registry', 'Zimbabwe', 'property', 'Stacks'],
  openGraph: {
    title:       'BlockLand Zimbabwe',
    description: 'Secure, transparent land administration on the blockchain.',
    type:        'website',
    locale:      'en_ZW',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans bg-surface-muted text-slate-900 antialiased">
        <AuthHydrator>
          {children}
        </AuthHydrator>
        <Toaster
          position="top-right"
          duration={4000}
          richColors
          toastOptions={{
            style: { fontFamily: 'var(--font-sans)', borderRadius: '0.5rem' },
          }}
        />
      </body>
    </html>
  );
}
