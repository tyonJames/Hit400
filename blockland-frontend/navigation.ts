// =============================================================================
// src/lib/navigation.ts — BlockLand Zimbabwe Navigation Configuration
// =============================================================================
//
// PURPOSE: Defines the route structure, sidebar navigation items, and
//          role-based redirection logic for all four user roles.
//
// ROUTE ARCHITECTURE (Next.js App Router):
//   /app
//   ├── layout.tsx              — Root: hydrates auth, wraps in providers
//   ├── page.tsx                — Redirects to /auth/login or /dashboard
//   ├── auth/
//   │   ├── layout.tsx          — Centered card, no sidebar
//   │   ├── login/page.tsx
//   │   ├── register/page.tsx
//   │   ├── forgot-password/page.tsx
//   │   └── reset-password/page.tsx
//   ├── verify/                 — PUBLIC: no auth required
//   │   ├── page.tsx            — Verification search form + results
//   │   └── [propertyId]/page.tsx
//   └── (dashboard)/            — Route group: requires auth, has sidebar
//       ├── layout.tsx          — Sidebar + topbar + role-based guard
//       ├── dashboard/page.tsx  — Role-specific summary
//       ├── properties/
//       │   ├── page.tsx        — Property list (REGISTRAR/ADMIN) or portfolio (OWNER)
//       │   ├── new/page.tsx    — Register property (REGISTRAR only)
//       │   └── [id]/
//       │       ├── page.tsx    — Property detail
//       │       └── edit/page.tsx — Edit property (REGISTRAR only)
//       ├── transfers/
//       │   ├── page.tsx        — Transfer list + incoming approvals
//       │   ├── new/page.tsx    — Initiate transfer (OWNER)
//       │   └── [id]/page.tsx   — Transfer detail + approval action
//       ├── disputes/
//       │   ├── page.tsx        — Dispute list
//       │   ├── new/page.tsx    — Raise dispute
//       │   └── [id]/page.tsx   — Dispute detail + evidence + resolution
//       ├── ownership/
//       │   └── [propertyId]/page.tsx — Ownership history (DB + on-chain)
//       ├── profile/page.tsx    — Own profile, wallet, password
//       └── admin/
//           ├── page.tsx        — Admin dashboard overview
//           ├── users/page.tsx  — User management table
//           ├── registrars/page.tsx — Registrar management
//           └── logs/page.tsx   — Activity log viewer
// =============================================================================

import type { UserRole } from '@/types';

// ---------------------------------------------------------------------------
// ROUTE CONSTANTS
// ---------------------------------------------------------------------------

export const ROUTES = {
  // Public
  HOME:            '/',
  VERIFY:          '/verify',

  // Auth (no sidebar)
  LOGIN:           '/auth/login',
  REGISTER:        '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD:  '/auth/reset-password',

  // Dashboard (requires auth)
  DASHBOARD:       '/dashboard',

  // Properties
  PROPERTIES:      '/properties',
  NEW_PROPERTY:    '/properties/new',
  PROPERTY:        (id: string) => `/properties/${id}`,

  // Transfers
  TRANSFERS:       '/transfers',
  NEW_TRANSFER:    '/transfers/new',
  TRANSFER:        (id: string) => `/transfers/${id}`,

  // Disputes
  DISPUTES:        '/disputes',
  NEW_DISPUTE:     '/disputes/new',
  DISPUTE:         (id: string) => `/disputes/${id}`,

  // Ownership
  OWNERSHIP:       (propertyId: string) => `/ownership/${propertyId}`,

  // Profile
  PROFILE:         '/profile',

  // Admin
  ADMIN:           '/admin',
  ADMIN_USERS:     '/admin/users',
  ADMIN_REGISTRARS:'/admin/registrars',
  ADMIN_LOGS:      '/admin/logs',
} as const;

// ---------------------------------------------------------------------------
// ROLE-BASED REDIRECT AFTER LOGIN
// ---------------------------------------------------------------------------

/**
 * getPostLoginRedirect — returns the route the user should land on after login.
 * Each role has a distinct landing screen optimised for their primary workflow.
 *
 * REGISTRAR → /dashboard (transfer queue + registration queue)
 * ADMIN     → /admin (user management overview)
 * OWNER     → /properties (their property portfolio)
 * BUYER     → /transfers (incoming transfer approvals)
 * PUBLIC    → /verify (the only thing they can do)
 */
export function getPostLoginRedirect(roles: UserRole[]): string {
  if (roles.includes('ADMIN'))     return ROUTES.ADMIN;
  if (roles.includes('REGISTRAR')) return ROUTES.DASHBOARD;
  if (roles.includes('OWNER'))     return ROUTES.PROPERTIES;
  if (roles.includes('BUYER'))     return ROUTES.TRANSFERS;
  return ROUTES.VERIFY;
}

// ---------------------------------------------------------------------------
// SIDEBAR NAVIGATION ITEMS
// ---------------------------------------------------------------------------

export interface NavItem {
  label:      string;
  href:       string;
  icon:       string;           // Lucide icon name (e.g. 'Home', 'FileText')
  badge?:     'pendingTransfers' | 'activeDisputes'; // Dynamic badge from dashboard summary
  roles?:     UserRole[];       // Which roles see this item (undefined = all auth roles)
  children?:  NavItem[];
}

/**
 * SIDEBAR_NAV — the complete navigation definition.
 * The sidebar component filters this list by the authenticated user's roles.
 *
 * ICON NAMES: Use Lucide React icon names exactly (PascalCase).
 * Import in the sidebar component: import { Home, FileText, ... } from 'lucide-react';
 */
export const SIDEBAR_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href:  ROUTES.DASHBOARD,
    icon:  'LayoutDashboard',
    // All roles see the dashboard — content differs per role
  },
  {
    label: 'Properties',
    href:  ROUTES.PROPERTIES,
    icon:  'MapPin',
    // REGISTRAR sees all; OWNER sees portfolio; ADMIN sees all
    children: [
      {
        label: 'All Properties',
        href:  ROUTES.PROPERTIES,
        icon:  'List',
        roles: ['REGISTRAR', 'ADMIN'],
      },
      {
        label: 'My Portfolio',
        href:  ROUTES.PROPERTIES,
        icon:  'Briefcase',
        roles: ['OWNER'],
      },
      {
        label: 'Register Property',
        href:  ROUTES.NEW_PROPERTY,
        icon:  'FilePlus',
        roles: ['REGISTRAR'],
      },
    ],
  },
  {
    label: 'Transfers',
    href:  ROUTES.TRANSFERS,
    icon:  'ArrowLeftRight',
    badge: 'pendingTransfers',
    children: [
      {
        label: 'All Transfers',
        href:  ROUTES.TRANSFERS,
        icon:  'List',
        roles: ['REGISTRAR', 'ADMIN'],
      },
      {
        label: 'My Transfers',
        href:  ROUTES.TRANSFERS,
        icon:  'Repeat',
        roles: ['OWNER', 'BUYER'],
      },
      {
        label: 'Initiate Transfer',
        href:  ROUTES.NEW_TRANSFER,
        icon:  'Send',
        roles: ['OWNER'],
      },
    ],
  },
  {
    label: 'Disputes',
    href:  ROUTES.DISPUTES,
    icon:  'AlertTriangle',
    badge: 'activeDisputes',
    children: [
      {
        label: 'All Disputes',
        href:  ROUTES.DISPUTES,
        icon:  'List',
        roles: ['REGISTRAR', 'ADMIN'],
      },
      {
        label: 'My Disputes',
        href:  ROUTES.DISPUTES,
        icon:  'MessageSquareWarning',
        roles: ['OWNER'],
      },
      {
        label: 'Raise Dispute',
        href:  ROUTES.NEW_DISPUTE,
        icon:  'PlusCircle',
        roles: ['OWNER', 'REGISTRAR'],
      },
    ],
  },
  {
    label: 'Admin Panel',
    href:  ROUTES.ADMIN,
    icon:  'ShieldCheck',
    roles: ['ADMIN'],
    children: [
      { label: 'User Management',   href: ROUTES.ADMIN_USERS,      icon: 'Users',     roles: ['ADMIN'] },
      { label: 'Registrar Control', href: ROUTES.ADMIN_REGISTRARS, icon: 'UserCheck', roles: ['ADMIN'] },
      { label: 'Activity Logs',     href: ROUTES.ADMIN_LOGS,       icon: 'Activity',  roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Verification Portal',
    href:  ROUTES.VERIFY,
    icon:  'Search',
    // Available to all roles — this is the public portal
  },
  {
    label: 'My Profile',
    href:  ROUTES.PROFILE,
    icon:  'User',
  },
];

// ---------------------------------------------------------------------------
// ROUTE GUARD HELPER
// ---------------------------------------------------------------------------

/**
 * canAccessRoute — checks whether a user with given roles can access a route.
 * Used by the middleware and the ProtectedLayout component.
 *
 * Routes accessible to all authenticated users have no role restriction.
 * Routes with a roles array require at least one matching role.
 */
export function canAccessRoute(path: string, userRoles: UserRole[]): boolean {
  // Admin routes — ADMIN only
  if (path.startsWith('/admin') && !userRoles.includes('ADMIN')) return false;

  // Property registration — REGISTRAR only
  if (path === ROUTES.NEW_PROPERTY && !userRoles.includes('REGISTRAR')) return false;

  // Dispute resolution — REGISTRAR only (the resolve action — not the detail page)
  // (handled at component level, not route level)

  // All other authenticated routes are accessible to any authenticated user
  return true;
}
