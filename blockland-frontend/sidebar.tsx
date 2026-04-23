// =============================================================================
// src/components/layout/sidebar.tsx — BlockLand Sidebar Navigation
// =============================================================================
//
// PURPOSE: The persistent dark sidebar displayed on every authenticated page.
//          Renders role-filtered navigation items from lib/navigation.ts.
//
// DESIGN:
//   - Background: #0F172A (sidebar token — near-black navy)
//   - Active item: left border teal accent + lighter background
//   - Logo: "BL" monogram on teal square, "BlockLand" wordmark
//   - Bottom: wallet connection status + user avatar / role badge
//
// ROLE FILTERING:
//   NavItems with a `roles` array are only shown to users with matching roles.
//   Items without a `roles` array are shown to all authenticated users.
//   This filtering runs in the component — no separate nav config per role.
// =============================================================================

'use client';

import Link        from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MapPin, ArrowLeftRight, AlertTriangle,
  ShieldCheck, Search, User, FilePlus, List, Briefcase,
  Send, Repeat, MessageSquareWarning, PlusCircle, UserCheck,
  Users, Activity, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore }       from '@/stores/auth.store';
import { SIDEBAR_NAV, type NavItem } from '@/lib/navigation';
import type { UserRole } from '@/types';

// Map Lucide icon name strings → actual components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, MapPin, ArrowLeftRight, AlertTriangle,
  ShieldCheck, Search, User, FilePlus, List, Briefcase,
  Send, Repeat, MessageSquareWarning, PlusCircle, UserCheck,
  Users, Activity,
};

// ---------------------------------------------------------------------------
// SIDEBAR COMPONENT
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname   = usePathname();
  const user       = useAuthStore((s) => s.user);
  const primaryRole = useAuthStore((s) => s.primaryRole());
  const roles      = (user?.roles ?? []) as UserRole[];

  // Track which parent nav items are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  // Filter nav items based on the user's roles
  const filteredNav = SIDEBAR_NAV.filter((item) =>
    !item.roles || item.roles.some((r) => roles.includes(r))
  );

  return (
    <aside className="sidebar scrollbar-thin overflow-y-auto">
      {/* ------------------------------------------------------------------- */}
      {/* LOGO & BRANDING                                                      */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        {/* Teal square monogram */}
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <span className="font-display text-white text-base font-bold">B</span>
        </div>
        <div>
          <p className="font-display text-white text-base leading-none">BlockLand</p>
          <p className="text-sidebar-muted text-xs mt-0.5">Zimbabwe Registry</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* NAVIGATION ITEMS                                                     */}
      {/* ------------------------------------------------------------------- */}
      <nav className="flex-1 py-4 space-y-0.5">
        {filteredNav.map((item) => (
          <NavItemRow
            key={item.label}
            item={item}
            pathname={pathname}
            roles={roles}
            isExpanded={!!expanded[item.label]}
            onToggle={() => toggle(item.label)}
          />
        ))}
      </nav>

      {/* ------------------------------------------------------------------- */}
      {/* BOTTOM: USER INFO                                                    */}
      {/* ------------------------------------------------------------------- */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          {/* Avatar: initials on a slate circle */}
          <div className="w-8 h-8 rounded-full bg-sidebar-surface border border-sidebar-border
                          flex items-center justify-center flex-shrink-0">
            <span className="text-sidebar-text text-xs font-medium">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.fullName ?? 'User'}
            </p>
            <p className="text-sidebar-muted text-xs capitalize">
              {primaryRole?.toLowerCase() ?? 'user'}
            </p>
          </div>
        </div>

        {/* Wallet connection status */}
        {user?.walletAddress ? (
          <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-surface">
            <span className="on-chain-dot" />
            <span className="text-sidebar-text text-xs font-mono truncate">
              {user.walletAddress.slice(0, 8)}...
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-md
                          bg-amber-900/30 border border-amber-800/40">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-amber-400 text-xs">Wallet not connected</span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// NAV ITEM ROW — handles single items and collapsible parent items
// ---------------------------------------------------------------------------

function NavItemRow({
  item, pathname, roles, isExpanded, onToggle,
}: {
  item:       NavItem;
  pathname:   string;
  roles:      UserRole[];
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const Icon    = ICON_MAP[item.icon];
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

  // Items with children render as collapsible sections
  if (item.children) {
    const visibleChildren = item.children.filter(
      (c) => !c.roles || c.roles.some((r) => roles.includes(r))
    );
    if (visibleChildren.length === 0) return null;

    return (
      <div>
        <button
          onClick={onToggle}
          className={`nav-item w-full ${isActive ? 'nav-item-active' : ''}`}
        >
          {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1 text-left">{item.label}</span>
          {isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-sidebar-muted" />
            : <ChevronRight className="w-3.5 h-3.5 text-sidebar-muted" />
          }
        </button>
        {isExpanded && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border/60 pl-3">
            {visibleChildren.map((child) => {
              const ChildIcon = ICON_MAP[child.icon];
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.label}
                  href={child.href}
                  className={`nav-item text-xs ${childActive ? 'nav-item-active' : ''}`}
                >
                  {ChildIcon && <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Single nav item
  return (
    <Link
      href={item.href}
      className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}
