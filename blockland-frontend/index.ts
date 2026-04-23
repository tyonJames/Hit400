// =============================================================================
// src/types/index.ts — BlockLand Zimbabwe Shared TypeScript Types
// =============================================================================
//
// PURPOSE: Defines every shared type and interface used across the frontend.
//          Types mirror the NestJS backend API response shapes from P5.
//          These are the contracts between the UI and the API.
//
// RULE: Every type here should have a 1-to-1 correspondence with either:
//   a) A backend DTO response (from docs/api-reference.md)
//   b) A Clarity contract value (from blockland.clar)
//   c) A UI-only state shape (clearly labelled)
// =============================================================================

// =============================================================================
// USER & AUTH TYPES
// =============================================================================

export type UserRole = 'REGISTRAR' | 'OWNER' | 'BUYER' | 'PUBLIC' | 'ADMIN';

/** The shape of the authenticated user stored in Zustand auth store */
export interface AuthUser {
  id:            string;
  email:         string;
  fullName:      string;
  roles:         UserRole[];
  walletAddress: string | null;
}

/** The response shape from POST /auth/login and POST /auth/refresh */
export interface AuthTokensResponse {
  accessToken:  string;
  refreshToken: string;
  user:         AuthUser;
}

// =============================================================================
// PROPERTY TYPES
// =============================================================================

export type PropertyStatus = 'ACTIVE' | 'PENDING_TRANSFER' | 'DISPUTED' | 'INACTIVE';
export type LandSizeUnit   = 'SQM' | 'HECTARE' | 'ACRE';
export type ZoningType     = 'RESIDENTIAL' | 'COMMERCIAL' | 'AGRICULTURAL' | 'INDUSTRIAL';

/** A land property record from GET /properties/:id */
export interface Property {
  id:               string;
  plotNumber:       string;
  titleDeedNumber:  string;
  address:          string;
  gpsLat:           number | null;
  gpsLng:           number | null;
  landSize:         number;
  unit:             LandSizeUnit;
  zoningType:       ZoningType;
  registrationDate: string;       // 'YYYY-MM-DD'
  status:           PropertyStatus;
  // Mandatory blockchain fields — always populated
  tokenId:          string;
  blockchainTxHash: string;
  ipfsHash:         string;
  notes:            string | null;
  currentOwnerId:   string;
  createdById:      string;
  currentOwner?:    PublicUser;
  createdAt:        string;
  updatedAt:        string;
  // Enriched on-chain state (from GET /properties/:id)
  onChainState?: {
    owner:        string;
    status:       string;
    registeredAt: number; // block height
  } | null;
}

/** Document attached to a property */
export interface PropertyDocument {
  id:            string;
  propertyId:    string;
  fileName:      string;
  fileType:      'PDF' | 'JPG' | 'PNG';
  fileSizeBytes: number;
  ipfsHash:      string;
  fileHash:      string;
  uploadedAt:    string;
}

// =============================================================================
// TRANSFER TYPES
// =============================================================================

export type TransferStatus = 'PENDING_BUYER' | 'PENDING_REGISTRAR' | 'CONFIRMED' | 'CANCELLED';
export type ApproverRole   = 'BUYER' | 'REGISTRAR';
export type ApprovalAction = 'APPROVED' | 'REJECTED';

/** A transfer record from the transfers table */
export interface Transfer {
  id:               string;
  propertyId:       string;
  sellerId:         string;
  buyerId:          string;
  status:           TransferStatus;
  initiatedAt:      string;
  confirmedAt:      string | null;
  cancelledAt:      string | null;
  saleValue:        number | null;
  blockchainTxHash: string | null;
  notes:            string | null;
  property?:        Property;
  seller?:          PublicUser;
  buyer?:           PublicUser;
  approvals?:       TransferApproval[];
  createdAt:        string;
  updatedAt:        string;
}

export interface TransferApproval {
  id:           string;
  transferId:   string;
  approvedById: string;
  approverRole: ApproverRole;
  approvedAt:   string;
  action:       ApprovalAction;
  notes:        string | null;
  approvedBy?:  PublicUser;
}

// =============================================================================
// DISPUTE TYPES
// =============================================================================

export type DisputeType   = 'OWNERSHIP_CLAIM' | 'BOUNDARY_DISPUTE' | 'FRAUD' | 'OTHER';
export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface Dispute {
  id:               string;
  propertyId:       string;
  raisedById:       string;
  disputeType:      DisputeType;
  description:      string;
  status:           DisputeStatus;
  raisedAt:         string;
  resolvedAt:       string | null;
  blockchainTxHash: string;
  property?:        Property;
  raisedBy?:        PublicUser;
  evidence?:        DisputeEvidence[];
  resolution?:      DisputeResolution | null;
  createdAt:        string;
}

export interface DisputeEvidence {
  id:            string;
  disputeId:     string;
  fileName:      string;
  fileType:      'PDF' | 'JPG' | 'PNG';
  fileSizeBytes: number;
  ipfsHash:      string;
  fileHash:      string;
  uploadedAt:    string;
  uploadedBy?:   PublicUser;
}

export interface DisputeResolution {
  id:               string;
  disputeId:        string;
  resolvedById:     string;
  resolutionNotes:  string;
  resolvedAt:       string;
  blockchainTxHash: string;
  resolvedBy?:      PublicUser;
}

// =============================================================================
// OWNERSHIP TYPES
// =============================================================================

export type AcquisitionType = 'INITIAL_REGISTRATION' | 'TRANSFER' | 'DISPUTE_RESOLUTION';

export interface OwnershipRecord {
  id:               string;
  propertyId:       string;
  ownerId:          string;
  transferId:       string | null;
  acquiredAt:       string;
  releasedAt:       string | null;  // null = currently owned
  acquisitionType:  AcquisitionType;
  blockchainTxHash: string;
  owner?:           PublicUser;
}

// =============================================================================
// VERIFICATION TYPES
// =============================================================================

export type VerificationStatus = 'VERIFIED' | 'MISMATCH' | 'NOT_FOUND';

export interface VerificationResult {
  status:       VerificationStatus;
  message:      string;
  property?: {
    id:               string;
    plotNumber:       string;
    address:          string;
    status:           PropertyStatus;
    registrationDate: string;
    tokenId:          string;
    blockchainTxHash: string;
  };
  owner?: {
    fullName:      string;
    walletAddress: string | null;
  };
  onChainOwner?: string | null;
}

// =============================================================================
// ACTIVITY & DASHBOARD TYPES
// =============================================================================

export interface ActivityLog {
  id:          string;
  userId:      string | null;
  action:      string;
  entityType:  string;
  entityId:    string;
  metadata:    Record<string, unknown> | null;
  performedAt: string;
  user?:       PublicUser | null;
}

export interface DashboardSummary {
  role:                     UserRole | string;
  totalProperties:          number;
  pendingTransfers:         number;
  activeDisputes:           number;
  recentActivity:           ActivityLog[];
  incomingPendingApprovals?: number;
}

// =============================================================================
// SHARED / UTILITY TYPES
// =============================================================================

/**
 * PublicUser — the safe public fields of a user returned in API responses.
 * NEVER includes: password_hash, national_id, raw email in public contexts.
 */
export interface PublicUser {
  id:            string;
  fullName:      string;
  walletAddress: string | null;
}

/** Standard paginated API response wrapper */
export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

/** Standard API success envelope (matches ResponseInterceptor shape) */
export interface ApiResponse<T> {
  success:   boolean;
  data:      T;
  timestamp: string;
}

/** API error response shape (matches HttpExceptionFilter) */
export interface ApiError {
  success:    false;
  statusCode: number;
  error:      string;
  message:    string;
  timestamp:  string;
  path:       string;
}

/** Blockchain transaction pending state — UI-only type */
export interface BlockchainTxState {
  txid:       string;
  status:     'pending' | 'confirmed' | 'failed';
  action:     string;  // e.g. 'register-property', 'initiate-transfer'
  entityId:   string;  // The DB UUID of the entity being acted on
  entityType: string;  // 'Property', 'Transfer', 'Dispute'
  startedAt:  string;
}

/** The step indicator state for the transfer workflow */
export type TransferStep =
  | 'INITIATE'          // Step 1 complete
  | 'BUYER_APPROVE'     // Step 2 complete
  | 'REGISTRAR_APPROVE' // Step 3 complete
  | 'CONFIRMED'
  | 'CANCELLED';

/** Stacks Explorer URL builder */
export const stacksExplorerTxUrl = (txid: string, network: 'testnet' | 'mainnet' = 'testnet') =>
  `https://explorer.hiro.so/txid/${txid}?chain=${network}`;

export const stacksExplorerAddressUrl = (address: string, network: 'testnet' | 'mainnet' = 'testnet') =>
  `https://explorer.hiro.so/address/${address}?chain=${network}`;

/** IPFS gateway URL builder */
export const ipfsGatewayUrl = (cid: string) =>
  `https://gateway.pinata.cloud/ipfs/${cid}`;
