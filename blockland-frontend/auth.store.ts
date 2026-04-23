// =============================================================================
// src/stores/auth.store.ts — BlockLand Zimbabwe Auth State Store (Zustand)
// =============================================================================
//
// MODULE:  State Management
// PURPOSE: Manages the authenticated user session — tokens, user profile,
//          login/logout actions, and role-based helper selectors.
//
// WHY ZUSTAND?
//   - Zero-boilerplate vs Redux (no actions/reducers/selectors boilerplate)
//   - Sufficient for BlockLand's shared state (auth, property cache, tx state)
//   - persist middleware handles localStorage refresh token persistence
//   - Devtools middleware enables Redux DevTools inspection during development
//   - Simpler async patterns than Redux Toolkit for blockchain tx polling
//
// TOKEN STRATEGY:
//   accessToken  — in memory only (Zustand store). Cleared on page refresh.
//                  Rehydrated by calling authService.refresh() on app mount
//                  if a refreshToken exists in localStorage.
//   refreshToken — in memory + localStorage (via tokenStorage helper).
//                  Persists across page refreshes and browser tabs.
//
// ROLE HELPERS:
//   isRegistrar, isAdmin, isOwner, isBuyer — boolean selectors derived from
//   user.roles. Used to conditionally render UI elements and redirect routes.
// =============================================================================

import { create }           from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuthUser }    from '@/types';
import { tokenStorage }     from '@/lib/api/client';
import { authService }      from '@/lib/api/services';

// ---------------------------------------------------------------------------
// STORE SHAPE
// ---------------------------------------------------------------------------

interface AuthState {
  // Data
  user:          AuthUser | null;
  accessToken:   string | null;
  isLoading:     boolean;

  // Actions
  setAuth:       (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth:     () => void;
  setUser:       (user: Partial<AuthUser>) => void;
  hydrateFromRefreshToken: () => Promise<boolean>;

  // Role helpers (derived — not stored separately)
  isAuthenticated: () => boolean;
  isRegistrar:     () => boolean;
  isAdmin:         () => boolean;
  isOwner:         () => boolean;
  isBuyer:         () => boolean;
  hasRole:         (role: AuthUser['roles'][number]) => boolean;
  primaryRole:     () => AuthUser['roles'][number] | null;
}

// ---------------------------------------------------------------------------
// STORE IMPLEMENTATION
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  devtools(
    // Note: We do NOT persist the full store (accessToken stays in memory).
    // The refreshToken is persisted by tokenStorage in localStorage independently.
    (set, get) => ({
      // -----------------------------------------------------------------------
      // Initial state
      // -----------------------------------------------------------------------
      user:        null,
      accessToken: null,
      isLoading:   true, // True until we've attempted refresh token hydration

      // -----------------------------------------------------------------------
      // setAuth — called after successful login/register/refresh
      // -----------------------------------------------------------------------
      setAuth: (user, accessToken, refreshToken) => {
        // Store access token in-memory (Zustand) and refresh token in localStorage
        tokenStorage.setTokens(accessToken, refreshToken);
        set({ user, accessToken, isLoading: false });
      },

      // -----------------------------------------------------------------------
      // clearAuth — called on logout or session expiry
      // -----------------------------------------------------------------------
      clearAuth: () => {
        tokenStorage.clear();
        set({ user: null, accessToken: null, isLoading: false });
      },

      // -----------------------------------------------------------------------
      // setUser — update user fields without changing tokens (e.g. after profile update)
      // -----------------------------------------------------------------------
      setUser: (updates) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...updates } });
      },

      // -----------------------------------------------------------------------
      // hydrateFromRefreshToken — called once on app mount (in RootLayout).
      // Checks for a stored refresh token and silently exchanges it for a fresh
      // access token, restoring the session without a visible login screen.
      // -----------------------------------------------------------------------
      hydrateFromRefreshToken: async () => {
        set({ isLoading: true });
        const refreshToken = tokenStorage.getRefreshToken();

        if (!refreshToken) {
          set({ isLoading: false });
          return false;
        }

        try {
          const response = await authService.refresh(refreshToken);
          get().setAuth(response.user, response.accessToken, response.refreshToken);
          return true;
        } catch {
          // Refresh token is invalid or expired — clear everything
          get().clearAuth();
          return false;
        }
      },

      // -----------------------------------------------------------------------
      // Role selectors — derived from user.roles
      // -----------------------------------------------------------------------

      isAuthenticated: () => get().user !== null && get().accessToken !== null,

      hasRole: (role) => get().user?.roles.includes(role) ?? false,

      isRegistrar: () => get().user?.roles.includes('REGISTRAR') ?? false,

      isAdmin: () => get().user?.roles.includes('ADMIN') ?? false,

      isOwner: () => get().user?.roles.includes('OWNER') ?? false,

      isBuyer: () => get().user?.roles.includes('BUYER') ?? false,

      /**
       * primaryRole — returns the "most privileged" role for display purposes.
       * Priority: ADMIN > REGISTRAR > OWNER > BUYER > PUBLIC
       */
      primaryRole: () => {
        const roles = get().user?.roles ?? [];
        if (roles.includes('ADMIN'))     return 'ADMIN';
        if (roles.includes('REGISTRAR')) return 'REGISTRAR';
        if (roles.includes('OWNER'))     return 'OWNER';
        if (roles.includes('BUYER'))     return 'BUYER';
        if (roles.includes('PUBLIC'))    return 'PUBLIC';
        return null;
      },
    }),
    { name: 'BlockLand:Auth' } // DevTools store label
  )
);
