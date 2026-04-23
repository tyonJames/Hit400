// =============================================================================
// tailwind.config.ts — BlockLand Zimbabwe Design System
// =============================================================================
//
// PURPOSE: Defines the BlockLand design system as Tailwind CSS tokens.
//          Every color, font, shadow, and animation used across the UI
//          is defined here — not scattered across components.
//
// DESIGN DIRECTION: "Institutional Precision"
//   Dark navy sidebar, slate surfaces, teal accent — the aesthetic of a
//   government institution that has embraced modern fintech tooling.
//   Think: Zimbabwean Deeds Registry meets Bloomberg Terminal.
//   Trustworthy, legible, data-dense, with deliberate teal accents on
//   blockchain-verified states.
//
// COLOR SYSTEM:
//   Sidebar:   #0F172A  (slate-900 — near-black navy)
//   Surface:   #1E293B  (slate-800 — card backgrounds in sidebar)
//   Page bg:   #F8FAFC  (slate-50  — off-white main content area)
//   Primary:   #0D9488  (teal-600  — CTAs, active states, blockchain badges)
//   Primary lt: #14B8A6 (teal-500  — hover states)
//   Warning:   #F59E0B  (amber-500 — PENDING status badges)
//   Error:     #EF4444  (red-500   — DISPUTED status, errors)
//   Success:   #10B981  (emerald-500 — VERIFIED, CONFIRMED badges)
//   Muted:     #64748B  (slate-500 — secondary text, placeholders)
//
// TYPOGRAPHY:
//   Display: 'DM Serif Display' — authoritative headings (government-formal)
//   Body:    'DM Sans'          — clean, modern, highly legible data text
//   Mono:    'JetBrains Mono'   — blockchain hashes, token IDs, tx hashes
// =============================================================================

import type { Config } from 'tailwindcss';

const config: Config = {
  // Only generate CSS for files that actually use Tailwind classes
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Dark mode toggled by a 'dark' class on the <html> element
  darkMode: 'class',

  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // COLOR PALETTE
      // -----------------------------------------------------------------------
      colors: {
        // Sidebar & navigation
        sidebar: {
          DEFAULT: '#0F172A', // Near-black navy — the authority foundation
          surface: '#1E293B', // Card/item background within sidebar
          border:  '#334155', // Dividers inside the sidebar
          text:    '#CBD5E1', // Sidebar text (slate-300)
          muted:   '#64748B', // Inactive nav items
          active:  '#0D9488', // Active nav item highlight
        },

        // Primary brand: teal — blockchain trust signal
        primary: {
          DEFAULT: '#0D9488', // teal-600 — primary CTA, active states
          light:   '#14B8A6', // teal-500 — hover state
          dark:    '#0F766E', // teal-700 — pressed state
          50:      '#F0FDFA',
          100:     '#CCFBF1',
          200:     '#99F6E4',
          500:     '#14B8A6',
          600:     '#0D9488',
          700:     '#0F766E',
          900:     '#134E4A',
        },

        // Status palette — maps directly to DB/on-chain statuses
        status: {
          active:    { bg: '#ECFDF5', text: '#065F46', border: '#6EE7B7' }, // emerald — ACTIVE
          pending:   { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' }, // amber  — PENDING*
          disputed:  { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' }, // red    — DISPUTED
          verified:  { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' }, // blue   — VERIFIED
          confirmed: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' }, // green  — CONFIRMED
          inactive:  { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' }, // slate  — INACTIVE
        },

        // Page layout surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          muted:   '#F8FAFC',  // Page background (slate-50)
          border:  '#E2E8F0',  // Card/section borders (slate-200)
        },
      },

      // -----------------------------------------------------------------------
      // TYPOGRAPHY
      // -----------------------------------------------------------------------
      fontFamily: {
        // Display: DM Serif Display — formal, authoritative, document-feel
        // Used for: page headings, property names, status headers
        display: ['"DM Serif Display"', 'Georgia', 'serif'],

        // Sans: DM Sans — modern, legible, data-friendly
        // Used for: body text, form labels, table cells, nav items
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],

        // Mono: JetBrains Mono — technical precision
        // Used for: blockchain hashes, token IDs, IPFS CIDs, wallet addresses
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      fontSize: {
        // Blockchain hash display — tight tracking for long hex strings
        hash: ['0.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        // Page section labels
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }],
      },

      // -----------------------------------------------------------------------
      // SHADOWS — layered depth system
      // -----------------------------------------------------------------------
      boxShadow: {
        card:   '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        modal:  '0 20px 60px -10px rgb(0 0 0 / 0.25)',
        teal:   '0 0 0 3px rgb(13 148 136 / 0.25)', // Focus ring for primary inputs
        sidebar: '4px 0 24px -4px rgb(0 0 0 / 0.4)',
      },

      // -----------------------------------------------------------------------
      // BORDER RADIUS
      // -----------------------------------------------------------------------
      borderRadius: {
        badge: '0.25rem',  // Status badges — square-ish
        card:  '0.75rem',  // Property cards
        modal: '1rem',     // Modals
      },

      // -----------------------------------------------------------------------
      // ANIMATIONS — deliberate, purposeful motion
      // -----------------------------------------------------------------------
      keyframes: {
        // Blockchain confirmation pulse — teal ripple on confirmed state
        'chain-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5', transform: 'scale(1.05)' },
        },
        // Skeleton loader sweep
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Slide in from left (sidebar open on mobile)
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        // Status badge entrance
        'badge-pop': {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '70%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
      },
      animation: {
        'chain-pulse':  'chain-pulse 2s ease-in-out infinite',
        shimmer:        'shimmer 2s linear infinite',
        'slide-in':     'slide-in 0.2s ease-out',
        'badge-pop':    'badge-pop 0.25s ease-out',
      },

      // -----------------------------------------------------------------------
      // SPACING OVERRIDES
      // -----------------------------------------------------------------------
      spacing: {
        sidebar: '16rem',     // Fixed sidebar width (256px)
        'sidebar-sm': '4rem', // Collapsed sidebar (icon-only mode)
        'topbar': '3.5rem',   // Top navigation bar height
      },
    },
  },

  plugins: [
    // Tailwind Typography — for prose blocks (API docs, legal text)
    require('@tailwindcss/typography'),
    // Tailwind Forms — sensible form element resets
    require('@tailwindcss/forms'),
  ],
};

export default config;
