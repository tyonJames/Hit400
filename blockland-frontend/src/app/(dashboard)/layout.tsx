'use client';

import { useEffect, useState } from 'react';
import { useRouter }   from 'next/navigation';
import Link            from 'next/link';
import { Wallet, X }   from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { Sidebar }     from '@/components/layout/sidebar';
import { Topbar }      from '@/components/layout/topbar';
import { ROUTES }      from '@/lib/navigation';
import { getConnectedWalletAddress } from '@/lib/stacks';
import { userService } from '@/lib/api/services';

const BANNER_KEY = 'blockland:wallet-banner-dismissed';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const setUser   = useAuthStore((s) => s.setUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [bannerDismissed, setBannerDismissed] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace(ROUTES.LOGIN);
  }, [user, isLoading, router]);

  // Silent auto-link: if already signed into Hiro wallet, save address without popup
  useEffect(() => {
    if (!user || user.walletAddress) return;
    const address = getConnectedWalletAddress();
    if (!address) return;
    userService.linkWallet(address)
      .then(() => setUser({ walletAddress: address }))
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Banner: only show for USER role, no wallet linked, not dismissed
  useEffect(() => {
    if (!user) return;
    setBannerDismissed(localStorage.getItem(BANNER_KEY) === '1');
  }, [user?.id]);

  function dismissBanner() {
    localStorage.setItem(BANNER_KEY, '1');
    setBannerDismissed(true);
  }

  const isPropertyUser = user?.roles.includes('USER') ?? false;
  const showBanner     = isPropertyUser && !user?.walletAddress && !bannerDismissed;

  if (isLoading || !user) return null;

  return (
    <>
      <Sidebar />
      <Topbar />
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2.5
                        bg-primary text-white text-sm shadow-lg">
          <Wallet className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            Connect your Hiro wallet to anchor property ownership on the Stacks blockchain.
          </span>
          <Link href="/profile" className="underline underline-offset-2 font-medium hover:text-white/80 shrink-0">
            Go to Profile
          </Link>
          <button onClick={dismissBanner} aria-label="Dismiss" className="ml-1 hover:text-white/70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <main className={`page-content${showBanner ? ' pt-10' : ''}`}>
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </>
  );
}
