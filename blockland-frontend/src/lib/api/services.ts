// =============================================================================
// src/lib/api/services.ts — BlockLand Zimbabwe API Service Functions
// =============================================================================

import { api, tokenStorage } from './client';
import type {
  AuthTokensResponse, AuthUser, Property, PaginatedResponse,
  Transfer, Dispute, OwnershipRecord, VerificationResult,
  DashboardSummary, ActivityLog, PropertyDocument, DisputeEvidence,
  MarketplaceListing, BuyerInterest,
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

  searchByBlocklandId: (blocklandId: string) =>
    api.get<{ id: string; fullName: string; blocklandId: string; roles: string[] } | null>(
      '/users/search', { blocklandId }
    ),

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

  resubmit: (id: string) =>
    api.patch<Property>(`/properties/${id}/resubmit`, {}),

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
    const token = tokenStorage.getAccessToken();
    const res = await fetch(
      `${BASE_URL}/properties/${propertyId}/documents/${docId}/file`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new Error('Could not load file.');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

export const transferService = {
  initiate: (data: {
    propertyId: string; buyerId: string; saleValue?: number;
    paymentMethod?: string; paymentInstructions?: string;
    marketplaceListingId?: string; minPrice?: number; maxPrice?: number;
    notes?: string;
  }) => api.post<Transfer>('/transfers', data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Transfer>>('/transfers', params),

  getMine: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Transfer>>('/transfers/mine', params),

  getById: (id: string) => api.get<Transfer>(`/transfers/${id}`),

  /** Step 1: registrar approves or rejects the transfer application */
  registrarReview: (id: string, action: 'APPROVE' | 'REJECT', note: string) =>
    api.patch<Transfer>(`/transfers/${id}/registrar-review`, { action, note }),

  cancel: (id: string, note: string) =>
    api.patch<Transfer>(`/transfers/${id}/cancel`, { note }),

  uploadPop: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<Transfer>(`/transfers/${id}/pop`, form);
  },

  sellerConfirm: (id: string, confirmed: boolean, note: string) =>
    api.patch<Transfer>(`/transfers/${id}/seller-confirm`, { confirmed, note }),

  registrarComplete: (id: string, notes?: string) =>
    api.patch<{ transfer: Transfer; blockchainTxHash: string }>(
      `/transfers/${id}/registrar-complete`, { notes }
    ),

  getPopUrl: (id: string) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    return `${BASE_URL}/transfers/${id}/pop`;
  },

  getCertificateUrl: (id: string) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    return `${BASE_URL}/transfers/${id}/certificate`;
  },
};

export const marketplaceService = {
  list: (params?: { page?: number; limit?: number; search?: string; minPrice?: number; maxPrice?: number }) =>
    api.get<PaginatedResponse<MarketplaceListing>>('/marketplace', params),

  getMy: () => api.get<MarketplaceListing[]>('/marketplace/my'),

  getById: (id: string) =>
    api.get<MarketplaceListing & { myInterest: BuyerInterest | null }>(`/marketplace/${id}`),

  create: (data: { propertyId: string; minPrice: number; maxPrice: number; paymentMethods: string[]; description: string }) =>
    api.post<MarketplaceListing>('/marketplace', data),

  update: (id: string, data: Partial<{ minPrice: number; maxPrice: number; paymentMethods: string[]; description: string }>) =>
    api.patch<MarketplaceListing>(`/marketplace/${id}`, data),

  delist: (id: string) => api.del<{ message: string }>(`/marketplace/${id}`),

  getInterests: (id: string) =>
    api.get<BuyerInterest[]>(`/marketplace/${id}/interests`),

  expressInterest: (id: string, message?: string) =>
    api.post<BuyerInterest>(`/marketplace/${id}/interest`, { message }),

  withdrawInterest: (id: string) =>
    api.del<{ message: string }>(`/marketplace/${id}/interest`),

  selectBuyer: (listingId: string, interestId: string, paymentMethod: string, paymentInstructions: string) =>
    api.post<Transfer>(`/marketplace/${listingId}/select/${interestId}`, { paymentMethod, paymentInstructions }),
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

export const messageService = {
  send: (data: { transferId?: string; subject: string; body: string }, file?: File) => {
    if (file) {
      const form = new FormData();
      if (data.transferId) form.append('transferId', data.transferId);
      form.append('subject', data.subject);
      form.append('body', data.body);
      form.append('attachment', file);
      return api.upload<import('@/types').Message>('/messages', form);
    }
    return api.post<import('@/types').Message>('/messages', data);
  },

  getInbox: () =>
    api.get<import('@/types').Message[]>('/messages/inbox'),

  getSent: () =>
    api.get<import('@/types').Message[]>('/messages/sent'),

  getUnreadCount: () =>
    api.get<number>('/messages/unread-count'),

  getById: (id: string) =>
    api.get<import('@/types').Message>(`/messages/${id}`),

  getAttachmentUrl: (id: string) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    return `${BASE_URL}/messages/${id}/attachment`;
  },
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

  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<AuthUser>>('/admin/users', params),

  updateStatus: (userId: string, isActive: boolean) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/status`, { isActive }),

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
