'use client';

// =============================================================================
// src/components/shared/auth-hydrator.tsx
// =============================================================================
// Client component that runs hydrateFromRefreshToken() once on mount.
// Wraps the entire app — shows a full-screen spinner while checking for a
// stored refresh token, then renders children once auth state is resolved.
// This prevents the flash of the login page for users who are already logged in.

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function AuthHydrator({ children }: { children: React.ReactNode }) {
  const isLoading  = useAuthStore((s) => s.isLoading);
  const hydrate    = useAuthStore((s) => s.hydrateFromRefreshToken);

  useEffect(() => {
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface-muted">
        <div className="flex flex-col items-center gap-4">
          {/* BlockLand logo mark */}
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-teal">
            <span className="font-display text-white text-2xl font-bold">B</span>
          </div>
          {/* Pulsing loading indicator */}
          <div className="flex items-center gap-1.5">
            {[0, 0.15, 0.3].map((delay, i) => (
              <span
                key={i}
                className="inline-block w-2 h-2 rounded-full bg-primary animate-chain-pulse"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
          <p className="text-sm text-slate-500">Loading BlockLand...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
