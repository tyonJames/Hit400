// =============================================================================
// src/stores/auth.store.ts — BlockLand Zimbabwe Auth State Store (Zustand)
// =============================================================================

import { create }            from 'zustand';
import { devtools }          from 'zustand/middleware';
import type { AuthUser }     from '@/types';
import { tokenStorage }      from '@/lib/api/client';
import { authService }       from '@/lib/api/services';

interface AuthState {
  user:          AuthUser | null;
  accessToken:   string | null;
  isLoading:     boolean;

  setAuth:       (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth:     () => void;
  setUser:       (user: Partial<AuthUser>) => void;
  hydrateFromRefreshToken: () => Promise<boolean>;

  isAuthenticated: () => boolean;
  isRegistrar:     () => boolean;
  isAdmin:         () => boolean;
  isUser:          () => boolean;
  hasRole:         (role: AuthUser['roles'][number]) => boolean;
  primaryRole:     () => AuthUser['roles'][number] | null;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user:        null,
      accessToken: null,
      isLoading:   true,

      setAuth: (user, accessToken, refreshToken) => {
        tokenStorage.setTokens(accessToken, refreshToken);
        set({ user, accessToken, isLoading: false });
      },

      clearAuth: () => {
        tokenStorage.clear();
        set({ user: null, accessToken: null, isLoading: false });
      },

      setUser: (updates) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...updates } });
      },

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
          get().clearAuth();
          return false;
        }
      },

      isAuthenticated: () => get().user !== null && get().accessToken !== null,
      hasRole:         (role) => get().user?.roles.includes(role) ?? false,
      isRegistrar:     () => get().user?.roles.includes('REGISTRAR') ?? false,
      isAdmin:         () => get().user?.roles.includes('ADMIN') ?? false,
      isUser:          () => get().user?.roles.includes('USER') ?? false,

      primaryRole: () => {
        const roles = get().user?.roles ?? [];
        if (roles.includes('ADMIN'))     return 'ADMIN';
        if (roles.includes('REGISTRAR')) return 'REGISTRAR';
        if (roles.includes('USER'))      return 'USER';
        if (roles.includes('PUBLIC'))    return 'PUBLIC';
        return null;
      },
    }),
    { name: 'BlockLand:Auth' }
  )
);
