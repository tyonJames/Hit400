// =============================================================================
// src/lib/api/services.ts — BlockLand Zimbabwe API Service Functions
// =============================================================================

import { api } from './client';
import type {
  AuthTokensResponse, AuthUser, Property, PaginatedResponse,
  Transfer, Dispute, OwnershipRecord, VerificationResult,
  DashboardSummary, ActivityLog, PropertyDocument, DisputeEvidence,
} from '@/types';

export const authService = {
  register: (data: {
    fullName: string; nationalId: string; email: string;
    phone: string; password: string; walletAddress?: string;
  }) => api.post<AuthTokensResponse>('/auth/register', data),

  login: (email: string, password: string) =>
    api.post<AuthTokensResponse>('/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    api.post<AuthTokensResponse>('/auth/refresh', { refreshToken }),

  logout: () => api.post<{ message: string }>('/auth/logout'),
};

export const userService = {
  getMe: () => api.get<AuthUser>('/users/me'),

  updateProfile: (data: { fullName?: string; phone?: string }) =>
    api.patch<AuthUser>('/users/me', data),

  linkWallet: (walletAddress: string) =>
    api.patch<{ message: string }>('/users/me/wallet', { walletAddress }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ message: string }>('/users/me/password', { currentPassword, newPassword }),

  list: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AuthUser>>('/users', params),

  assignRole: (userId: string, role: string) =>
    api.patch<{ message: string }>(`/users/${userId}/role`, { role }),

  updateStatus: (userId: string, isActive: boolean) =>
    api.patch<{ message: string }>(`/users/${userId}/status`, { isActive }),
};

export const propertyService = {
  submit: (formData: FormData) =>
    api.upload<Property>('/properties', formData),

  approve: (id: string) =>
    api.patch<Property>(`/properties/${id}/approve`, {}),

  decline: (id: string, comment: string) =>
    api.patch<Property>(`/properties/${id}/decline`, { comment }),

  list: (params?: {
    page?: number; limit?: number; status?: string;
    zoningType?: string; search?: string;
  }) => api.get<PaginatedResponse<Property>>('/properties', params),

  getById: (id: string) => api.get<Property & { onChainState?: any }>(`/properties/${id}`),

  getByOwner: (userId: string, params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Property>>(`/properties/owner/${userId}`, params),

  getMyPortfolio: () => api.get<{
    properties: Property[]; totalOwned: number;
    pendingTransfers: number; activeDisputes: number;
  }>('/properties/my'),

  uploadDocument: (propertyId: string, formData: FormData) =>
    api.upload<PropertyDocument>(`/properties/${propertyId}/documents`, formData),

  getDocuments: (propertyId: string) =>
    api.get<PropertyDocument[]>(`/properties/${propertyId}/documents`),

  openDocumentFile: async (propertyId: string, docId: string, fileName: string) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const { tokenStorage } = await import('./client');
    const token = tokenStorage.getAccessToken();
    const res   = await fetch(`${BASE_URL}/properties/${propertyId}/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not load file.');
    const blob    = await res.blob();
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.target      = '_blank';
    a.rel         = 'noopener noreferrer';
    a.download    = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

export const transferService = {
  initiate: (data: { propertyId: string; buyerId: string; saleValue?: number; notes?: string }) =>
    api.post<Transfer>('/transfers', data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Transfer>>('/transfers', params),

  getMine: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Transfer>>('/transfers/mine', params),

  getById: (id: string) => api.get<Transfer>(`/transfers/${id}`),

  getByProperty: (propertyId: string) =>
    api.get<Transfer[]>(`/transfers/property/${propertyId}/history`),

  buyerApprove: (id: string, notes?: string) =>
    api.patch<Transfer>(`/transfers/${id}/buyer-approve`, { notes }),

  registrarApprove: (id: string, notes?: string) =>
    api.patch<{ transfer: Transfer; blockchainTxHash: string }>(
      `/transfers/${id}/registrar-approve`, { notes }
    ),

  cancel: (id: string, notes?: string) =>
    api.patch<Transfer>(`/transfers/${id}/cancel`, { notes }),
};

export const disputeService = {
  create: (data: { propertyId: string; disputeType: string; description: string }) =>
    api.post<{ dispute: Dispute; blockchainTxHash: string }>('/disputes', data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Dispute>>('/disputes', params),

  getMine: () => api.get<Dispute[]>('/disputes/mine'),

  getById: (id: string) => api.get<Dispute>(`/disputes/${id}`),

  addEvidence: (disputeId: string, formData: FormData) =>
    api.upload<DisputeEvidence>(`/disputes/${disputeId}/evidence`, formData),

  resolve: (id: string, resolutionNotes: string) =>
    api.patch<{ dispute: Dispute; blockchainTxHash: string }>(
      `/disputes/${id}/resolve`, { resolutionNotes }
    ),
};

export const ownershipService = {
  getHistory: (propertyId: string, params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<OwnershipRecord>>(
      `/ownership/${propertyId}/history`, params
    ),

  getOnChainHistory: (propertyId: string) =>
    api.get<{
      propertyId: string; tokenId: string; count: number;
      history: Array<{ seq: number; owner: string; acquiredAt: number }>;
      mismatch: boolean;
    }>(`/ownership/${propertyId}/history/onchain`),
};

export const verificationService = {
  verify: (params: {
    plotNumber?: string; titleDeedNumber?: string; ownerId?: string;
  }) => api.get<VerificationResult>('/verify', params),

  verifyById: (propertyId: string) =>
    api.get<VerificationResult>(`/verify/${propertyId}`),
};

export const dashboardService = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/summary'),

  getActivity: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<ActivityLog>>('/dashboard/activity', params),
};

export const adminService = {
  getRegistrars: () => api.get<AuthUser[]>('/admin/registrars'),

  addRegistrar: (userId: string) =>
    api.post<{ message: string }>('/admin/registrars', { userId }),

  removeRegistrar: (userId: string) =>
    api.del<{ message: string }>(`/admin/registrars/${userId}`),

  getLogs: (params?: {
    page?: number; limit?: number;
    userId?: string; entityType?: string; from?: string; to?: string;
  }) => api.get<PaginatedResponse<ActivityLog>>('/admin/logs', params),

  getStats: () => api.get<{
    totalUsers: number; totalProperties: number;
    totalTransfers: number; confirmedTransfers: number;
    openDisputes: number; verificationCount: number;
  }>('/admin/stats'),

  getPendingUsers: () => api.get<PendingUser[]>('/admin/users/pending'),

  approveUser: (userId: string, roles: string[]) =>
    api.post<{ message: string }>(`/admin/users/${userId}/approve`, { roles }),
};

export interface PendingUser {
  id: string;
  fullName: string;
  nationalId: string;
  email: string;
  phone: string;
  createdAt: string;
}
