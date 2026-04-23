// =============================================================================
// src/lib/navigation.ts — BlockLand Zimbabwe Navigation Configuration
// =============================================================================

import type { UserRole } from '@/types';

export const ROUTES = {
  HOME:            '/',
  VERIFY:          '/verify',
  LOGIN:           '/auth/login',
  REGISTER:        '/auth/register',
  DASHBOARD:       '/dashboard',
  PROPERTIES:      '/properties',
  NEW_PROPERTY:    '/properties/new',
  PROPERTY:        (id: string) => `/properties/${id}`,
  TRANSFERS:       '/transfers',
  NEW_TRANSFER:    '/transfers/new',
  TRANSFER:        (id: string) => `/transfers/${id}`,
  DISPUTES:        '/disputes',
  NEW_DISPUTE:     '/disputes/new',
  DISPUTE:         (id: string) => `/disputes/${id}`,
  OWNERSHIP:       (propertyId: string) => `/ownership/${propertyId}`,
  PROFILE:         '/profile',
  ADMIN:            '/admin',
  ADMIN_USERS:      '/admin/users',
  ADMIN_REGISTRARS: '/admin/registrars',
  ADMIN_LOGS:       '/admin/logs',
  ADMIN_APPROVALS:  '/admin/approvals',
} as const;

export function getPostLoginRedirect(roles: UserRole[]): string {
  if (roles.includes('ADMIN'))     return ROUTES.ADMIN;
  if (roles.includes('REGISTRAR')) return ROUTES.DASHBOARD;
  if (roles.includes('OWNER'))     return ROUTES.PROPERTIES;
  if (roles.includes('BUYER'))     return ROUTES.TRANSFERS;
  return ROUTES.VERIFY;
}

export interface NavItem {
  label:      string;
  href:       string;
  icon:       string;
  badge?:     'pendingTransfers' | 'activeDisputes';
  roles?:     UserRole[];
  children?:  NavItem[];
}

export const SIDEBAR_NAV: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.DASHBOARD, icon: 'LayoutDashboard' },
  {
    label: 'Properties', href: ROUTES.PROPERTIES, icon: 'MapPin',
    children: [
      { label: 'All Properties',    href: ROUTES.PROPERTIES,  icon: 'List',      roles: ['REGISTRAR', 'ADMIN'] },
      { label: 'My Portfolio',      href: ROUTES.PROPERTIES,  icon: 'Briefcase', roles: ['OWNER'] },
      { label: 'Register Property', href: ROUTES.NEW_PROPERTY,icon: 'FilePlus',  roles: ['REGISTRAR'] },
    ],
  },
  {
    label: 'Transfers', href: ROUTES.TRANSFERS, icon: 'ArrowLeftRight', badge: 'pendingTransfers',
    children: [
      { label: 'All Transfers',    href: ROUTES.TRANSFERS,    icon: 'List',   roles: ['REGISTRAR', 'ADMIN'] },
      { label: 'My Transfers',     href: ROUTES.TRANSFERS,    icon: 'Repeat', roles: ['OWNER', 'BUYER'] },
      { label: 'Initiate Transfer',href: ROUTES.NEW_TRANSFER, icon: 'Send',   roles: ['OWNER'] },
    ],
  },
  {
    label: 'Disputes', href: ROUTES.DISPUTES, icon: 'AlertTriangle', badge: 'activeDisputes',
    children: [
      { label: 'All Disputes', href: ROUTES.DISPUTES,    icon: 'List',                 roles: ['REGISTRAR', 'ADMIN'] },
      { label: 'My Disputes',  href: ROUTES.DISPUTES,    icon: 'MessageSquareWarning', roles: ['OWNER'] },
      { label: 'Raise Dispute',href: ROUTES.NEW_DISPUTE, icon: 'PlusCircle',           roles: ['OWNER', 'REGISTRAR'] },
    ],
  },
  {
    label: 'Admin Panel', href: ROUTES.ADMIN, icon: 'ShieldCheck', roles: ['ADMIN'],
    children: [
      { label: 'Pending Approvals', href: ROUTES.ADMIN_APPROVALS,  icon: 'UserPlus',  roles: ['ADMIN'], badge: 'pendingApprovals' as any },
      { label: 'User Management',   href: ROUTES.ADMIN_USERS,      icon: 'Users',     roles: ['ADMIN'] },
      { label: 'Registrar Control', href: ROUTES.ADMIN_REGISTRARS, icon: 'UserCheck', roles: ['ADMIN'] },
      { label: 'Activity Logs',     href: ROUTES.ADMIN_LOGS,       icon: 'Activity',  roles: ['ADMIN'] },
    ],
  },
  { label: 'Verification Portal', href: ROUTES.VERIFY,   icon: 'Search' },
  { label: 'My Profile',          href: ROUTES.PROFILE,  icon: 'User' },
];

export function canAccessRoute(path: string, userRoles: UserRole[]): boolean {
  if (path.startsWith('/admin') && !userRoles.includes('ADMIN')) return false;
  if (path === ROUTES.NEW_PROPERTY && !userRoles.includes('REGISTRAR')) return false;
  return true;
}
