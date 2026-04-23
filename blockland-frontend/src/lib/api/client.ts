// =============================================================================
// src/lib/api/client.ts — BlockLand Zimbabwe Typed API Client
// =============================================================================

import type { ApiError } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

let _accessToken: string | null  = null;
let _refreshToken: string | null = null;
let _isRefreshing                = false;
let _refreshQueue: Array<(token: string) => void> = [];

export const tokenStorage = {
  setTokens: (accessToken: string, refreshToken: string) => {
    _accessToken  = accessToken;
    _refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('blockland_refresh', refreshToken);
    }
  },
  getAccessToken:  () => _accessToken,
  getRefreshToken: () => {
    if (_refreshToken) return _refreshToken;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('blockland_refresh');
    }
    return null;
  },
  clear: () => {
    _accessToken  = null;
    _refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('blockland_refresh');
    }
  },
};

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?:    unknown;
  isUpload?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, isUpload = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {};
  if (!isUpload) headers['Content-Type'] = 'application/json';

  const accessToken = tokenStorage.getAccessToken();
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string> ?? {}) },
    body: isUpload
      ? (body as FormData)
      : body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) return request<T>(endpoint, options);
    redirectToLogin();
    throw new Error('Session expired. Please log in again.');
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError: ApiError = json ?? {
      success:    false,
      statusCode: response.status,
      error:      response.statusText,
      message:    'An unexpected error occurred.',
      timestamp:  new Date().toISOString(),
      path:       endpoint,
    };
    throw apiError;
  }

  if (json && 'data' in json) return json.data as T;
  return json as T;
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  if (_isRefreshing) {
    return new Promise((resolve) => {
      _refreshQueue.push((newToken) => resolve(!!newToken));
    });
  }

  _isRefreshing = true;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) { tokenStorage.clear(); return false; }

    const json = await response.json();
    const { accessToken: newAccess, refreshToken: newRefresh } = json.data;

    tokenStorage.setTokens(newAccess, newRefresh);
    _refreshQueue.forEach((cb) => cb(newAccess));
    _refreshQueue = [];
    return true;
  } catch {
    tokenStorage.clear();
    return false;
  } finally {
    _isRefreshing = false;
  }
}

function redirectToLogin() {
  tokenStorage.clear();
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login?session=expired';
  }
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> => {
    const url = params
      ? `${endpoint}?${new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)])
          )
        ).toString()}`
      : endpoint;
    return request<T>(url, { method: 'GET' });
  },

  post: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, { method: 'POST', body }),

  patch: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, { method: 'PATCH', body }),

  del: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: 'DELETE' }),

  upload: <T>(endpoint: string, formData: FormData): Promise<T> =>
    request<T>(endpoint, { method: 'POST', body: formData, isUpload: true }),

  uploadPatch: <T>(endpoint: string, formData: FormData): Promise<T> =>
    request<T>(endpoint, { method: 'PATCH', body: formData, isUpload: true }),
};
