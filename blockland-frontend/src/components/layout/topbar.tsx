'use client';

import Link              from 'next/link';
import { usePathname }   from 'next/navigation';
import { useRouter }     from 'next/navigation';
import { LogOut, User, Wallet, ChevronDown, ExternalLink } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast }         from 'sonner';
import { useAuthStore }  from '@/stores/auth.store';
import { authService }   from '@/lib/api/services';
import { ROUTES }        from '@/lib/navigation';

const PATH_LABELS: Record<string, string> = {
  dashboard:    'Dashboard',
  properties:   'Properties',
  transfers:    'Transfers',
  disputes:     'Disputes',
  ownership:    'Ownership History',
  verification: 'Verification',
  profile:      'My Profile',
  admin:        'Admin Panel',
  users:        'User Management',
  registrars:   'Registrar Control',
  logs:         'Activity Logs',
  new:          'New',
  verify:       'Verify',
};

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

export function Topbar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const segments = pathname.split('/').filter(Boolean);
  const pageTitle = segments.length > 0
    ? PATH_LABELS[segments[segments.length - 1]] ?? segments[segments.length - 1]
    : 'Dashboard';

  async function handleLogout() {
    try { await authService.logout(); } catch { /* ignore */ }
    clearAuth();
    router.replace(ROUTES.LOGIN);
    toast.success('Logged out successfully.');
  }

  return (
    <header className="topbar">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-lg text-slate-900 leading-none">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
          ${NETWORK === 'mainnet'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'}
        `}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${
            NETWORK === 'mainnet' ? 'bg-emerald-500' : 'bg-amber-500 animate-chain-pulse'
          }`} />
          Stacks {NETWORK}
        </span>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                       hover:bg-slate-100 transition-colors duration-150"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20
                            flex items-center justify-center">
              <span className="text-primary text-xs font-semibold">
                {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <span className="text-sm text-slate-700 font-medium hidden sm:block">
              {user?.fullName?.split(' ')[0] ?? 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl
                            shadow-modal border border-surface-border py-1 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900">{user?.fullName}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">
                  {user?.roles.join(', ').toLowerCase()}
                </p>
              </div>

              <Link
                href={ROUTES.PROFILE}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700
                           hover:bg-slate-50 transition-colors"
              >
                <User className="w-4 h-4 text-slate-400" />
                My Profile
              </Link>

              {user?.walletAddress ? (
                <a
                  href={`https://explorer.hiro.so/address/${user.walletAddress}?chain=${NETWORK}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700
                             hover:bg-slate-50 transition-colors"
                >
                  <Wallet className="w-4 h-4 text-slate-400" />
                  View Wallet
                  <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
                </a>
              ) : (
                <Link
                  href={ROUTES.PROFILE + '?connect=wallet'}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-600
                             hover:bg-amber-50 transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </Link>
              )}

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600
                             hover:bg-red-50 transition-colors w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
