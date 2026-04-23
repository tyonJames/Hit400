// =============================================================================
// src/lib/api/client.ts — BlockLand Zimbabwe Typed API Client
// =============================================================================
//
// PURPOSE: A thin, typed wrapper around the native fetch API that:
//   1. Injects the JWT access token from the auth store on every request
//   2. Handles the standard API response envelope (unwraps data)
//   3. Throws typed ApiError objects that UI components can handle uniformly
//   4. Automatically refreshes the access token on 401 responses
//   5. Handles multipart/form-data for file upload endpoints
//
// USAGE:
//   import { api } from '@/lib/api/client';
//
//   // Simple GET
//   const summary = await api.get<DashboardSummary>('/dashboard/summary');
//
//   // POST with body
//   const transfer = await api.post<Transfer>('/transfers', { propertyId, buyerId });
//
//   // File upload (multipart)
//   const property = await api.upload<Property>('/properties', formData);
//
// WHY NOT AXIOS?
//   The native fetch API (available in both browser and Node.js 18+) is
//   sufficient and reduces the dependency footprint. The wrapper below
//   provides all the convenience of axios with zero extra bytes.
//
// TOKEN REFRESH FLOW:
//   1. Request fails with 401
//   2. Client calls POST /auth/refresh with the stored refreshToken
//   3. On success: new tokens saved to auth store; original request retried
//   4. On refresh failure: user redirected to /auth/login
// =============================================================================

import type { ApiResponse, ApiError } from '@/types';

// The base URL for all API calls — set via NEXT_PUBLIC_API_URL in .env
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// TOKEN STORAGE HELPERS
// ---------------------------------------------------------------------------
// Tokens are stored in memory (Zustand store) during the session for XSS safety.
// The refresh token is also stored in localStorage for persistence across tabs.
// Access tokens are NEVER stored in localStorage — only in memory.

let _accessToken: string | null  = null;
let _refreshToken: string | null = null;
let _isRefreshing                = false;
let _refreshQueue: Array<(token: string) => void> = [];

export const tokenStorage = {
  setTokens: (accessToken: string, refreshToken: string) => {
    _accessToken  = accessToken;
    _refreshToken = refreshToken;
    // Persist refresh token across page refreshes (not sessionStorage — that clears on tab close)
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

// ---------------------------------------------------------------------------
// CORE REQUEST FUNCTION
// ---------------------------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?:    unknown;
  isUpload?: boolean; // true for multipart/form-data (file uploads)
}

/**
 * request — the internal fetch wrapper used by all api.* methods.
 * Handles: auth headers, response unwrapping, error normalisation, 401 retry.
 */
async function request<T>(
  endpoint: string,
  options:  RequestOptions = {},
): Promise<T> {
  const { body, isUpload = false, ...fetchOptions } = options;

  // Build headers
  const headers: Record<string, string> = {};
  if (!isUpload) {
    headers['Content-Type'] = 'application/json';
  }

  const accessToken = tokenStorage.getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string> ?? {}) },
    body: isUpload
      ? (body as FormData)          // FormData — browser sets boundary automatically
      : body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — attempt token refresh then retry once
  if (response.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      // Retry the original request with the new access token
      return request<T>(endpoint, options);
    }
    // Refresh failed — redirect to login
    redirectToLogin();
    throw new Error('Session expired. Please log in again.');
  }

  // Parse the response body
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    // Surface the API error with the standard error shape
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

  // Unwrap the standard success envelope { success: true, data: T }
  if (json && 'data' in json) {
    return json.data as T;
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// TOKEN REFRESH LOGIC
// ---------------------------------------------------------------------------

/**
 * attemptRefresh — tries to exchange the stored refresh token for a new pair.
 * Queues concurrent refresh attempts to prevent multiple simultaneous calls.
 * Returns true if refresh succeeded, false if it failed.
 */
async function attemptRefresh(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  // If already refreshing, wait in the queue
  if (_isRefreshing) {
    return new Promise((resolve) => {
      _refreshQueue.push((newToken) => {
        resolve(!!newToken);
      });
    });
  }

  _isRefreshing = true;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      tokenStorage.clear();
      return false;
    }

    const json = await response.json();
    const { accessToken: newAccess, refreshToken: newRefresh } = json.data;

    tokenStorage.setTokens(newAccess, newRefresh);

    // Notify all queued requests that the new token is available
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

// ---------------------------------------------------------------------------
// PUBLIC API SURFACE
// ---------------------------------------------------------------------------

/**
 * api — the public client object used throughout the application.
 * All methods return the unwrapped data (not the envelope).
 */
export const api = {
  /**
   * get — fetches data from a GET endpoint.
   * Appends query parameters via the params object.
   */
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

  /**
   * post — sends a POST request with a JSON body.
   * Returns 201/200 response data.
   */
  post: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, { method: 'POST', body }),

  /**
   * patch — sends a PATCH request with a JSON body.
   */
  patch: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, { method: 'PATCH', body }),

  /**
   * del — sends a DELETE request.
   */
  del: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: 'DELETE' }),

  /**
   * upload — sends a multipart/form-data POST request.
   * Used for file upload endpoints (property registration, dispute evidence).
   * The FormData object must include all form fields AND the file.
   */
  upload: <T>(endpoint: string, formData: FormData): Promise<T> =>
    request<T>(endpoint, { method: 'POST', body: formData, isUpload: true }),

  /**
   * uploadPatch — multipart PATCH (for updating a resource with a file).
   */
  uploadPatch: <T>(endpoint: string, formData: FormData): Promise<T> =>
    request<T>(endpoint, { method: 'PATCH', body: formData, isUpload: true }),
};
