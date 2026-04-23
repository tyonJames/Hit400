'use client';

// Root page — redirects authenticated users to their role-based home,
// unauthenticated users to /auth/login.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getPostLoginRedirect, ROUTES } from '@/lib/navigation';

export default function RootPage() {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(getPostLoginRedirect(user.roles));
    } else {
      router.replace(ROUTES.LOGIN);
    }
  }, [user, isLoading, router]);

  return null;
}
