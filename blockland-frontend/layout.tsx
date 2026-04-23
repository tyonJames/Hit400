// =============================================================================
// src/app/layout.tsx — Next.js Root Layout
// =============================================================================
//
// PURPOSE: The outermost layout that wraps the entire application.
//          Responsibilities:
//            1. Load Google Fonts (DM Serif Display, DM Sans, JetBrains Mono)
//            2. Wrap the app in any React context providers
//            3. Hydrate the auth store from localStorage on first render
//               (restores session without a visible login screen on page refresh)
//            4. Set global HTML metadata (title, description, Open Graph)
//
// FONT STRATEGY:
//   Using next/font/google — fonts are downloaded at build time and served
//   from the same domain (no third-party font requests in production).
//   This improves performance and avoids GDPR issues with external font CDNs.
//
// AUTH HYDRATION:
//   The <AuthHydrator> component (client component) calls
//   useAuthStore.hydrateFromRefreshToken() once on mount. This exchanges
//   the stored refresh token for a fresh access token silently.
//   While hydrating, a full-screen skeleton is shown to prevent a flash
//   of the login page for authenticated users.
// =============================================================================

import type { Metadata } from 'next';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import { Toaster }    from 'sonner';
import './globals.css';
import { AuthHydrator } from '@/components/shared/auth-hydrator';

// ---------------------------------------------------------------------------
// FONT LOADING (next/font/google — zero external requests at runtime)
// ---------------------------------------------------------------------------

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

// JetBrains Mono loaded via CSS @font-face in globals.css (not in Google Fonts)
// Alternative: use the 'JetBrains_Mono' next/font/google entry if available

// ---------------------------------------------------------------------------
// APP METADATA
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ROOT LAYOUT COMPONENT
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans bg-surface-muted text-slate-900 antialiased">
        {/*
          AuthHydrator — a Client Component that runs hydrateFromRefreshToken()
          on mount. It shows a full-screen spinner during hydration to prevent
          the flash of the login page for authenticated users.
        */}
        <AuthHydrator>
          {children}
        </AuthHydrator>

        {/*
          Sonner — the global toast notification system.
          Position: top-right. Duration: 4 seconds.
          Styled to match the BlockLand design system via CSS variables.
        */}
        <Toaster
          position="top-right"
          duration={4000}
          richColors
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
              borderRadius: '0.5rem',
            },
          }}
        />
      </body>
    </html>
  );
}
