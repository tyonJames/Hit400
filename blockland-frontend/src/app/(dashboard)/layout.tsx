'use client';

// Dashboard layout — sidebar + topbar, with auth guard.
// Redirects unauthenticated users to /auth/login.

import { useEffect }   from 'react';
import { useRouter }   from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Sidebar }     from '@/components/layout/sidebar';
import { Topbar }      from '@/components/layout/topbar';
import { ROUTES }      from '@/lib/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(ROUTES.LOGIN);
    }
  }, [user, isLoading, router]);

  // While auth is being checked or user is not yet confirmed, show nothing
  if (isLoading || !user) return null;

  return (
    <>
      <Sidebar />
      <Topbar />
      <main className="page-content">
        {children}
      </main>
    </>
  );
}
