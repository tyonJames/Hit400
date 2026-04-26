// =============================================================================
// src/types/index.ts — BlockLand Zimbabwe Shared TypeScript Types
// =============================================================================

export type UserRole = 'REGISTRAR' | 'USER' | 'PUBLIC' | 'ADMIN';

export interface AuthUser {
  id:            string;
  email:         string;
  fullName:      string;
  nationalId?:   string;
  phone?:        string;
  roles:         UserRole[];
  walletAddress: string | null;
  isActive?:     boolean;
  isApproved?:   boolean;
  createdAt?:    string;
}

export interface AuthTokensResponse {
  accessToken:  string;
  refreshToken: string;
  user:         AuthUser;
}

export type PropertyStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'PENDING_TRANSFER' | 'DISPUTED' | 'INACTIVE' | 'DECLINED';
export type LandSizeUnit   = 'SQM' | 'HECTARE' | 'ACRE';
export type ZoningType     = 'RESIDENTIAL' | 'COMMERCIAL' | 'AGRICULTURAL' | 'INDUSTRIAL';

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
  registrationDate: string;
  status:           PropertyStatus;
  tokenId:              string | null;
  blockchainTxHash:     string | null;
  ipfsHash:             string | null;
  notes:                string | null;
  registrationComment:  string | null;
  recordHash:           string | null;
  currentOwnerId:   string;
  createdById:      string;
  currentOwner?:    PublicUser;
  documents?:       PropertyDocument[];
  createdAt:        string;
  updatedAt:        string;
  onChainState?: {
    owner:        string;
    status:       string;
    registeredAt: number;
  } | null;
}

export type DocumentCategory = 'IMAGE' | 'DOCUMENT';
export type DocumentType     =
  | 'TITLE_DEED'
  | 'SURVEY_DIAGRAM'
  | 'BUILDING_PLAN'
  | 'DEED_OF_TRANSFER'
  | 'TAX_CLEARANCE'
  | 'LAND_DISPUTE_AFFIDAVIT'
  | 'PHOTO';

export interface PropertyDocument {
  id:            string;
  propertyId:    string;
  fileName:      string;
  fileType:      'PDF' | 'JPG' | 'PNG';
  category:      DocumentCategory;
  documentType:  DocumentType;
  fileSizeBytes: number;
  ipfsHash:      string;
  fileHash:      string;
  uploadedAt:    string;
}

export type TransferStatus =
  | 'PENDING_BUYER' | 'PENDING_REGISTRAR'
  | 'PENDING_REGISTRAR_TERMS' | 'AWAITING_POP'
  | 'PENDING_SELLER_CONFIRMATION' | 'PENDING_REGISTRAR_FINAL'
  | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';

export type ListingStatus  = 'ACTIVE' | 'SOLD' | 'CANCELLED';
export type InterestStatus = 'PENDING' | 'SELECTED' | 'NOT_SELECTED' | 'WITHDRAWN';
export type ApproverRole   = 'BUYER' | 'REGISTRAR';
export type ApprovalAction = 'APPROVED' | 'REJECTED';

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
  // Marketplace-flow fields
  marketplaceListingId?: string | null;
  paymentMethod?:        string | null;
  minPrice?:             number | null;
  maxPrice?:             number | null;
  rejectionNote?:        string | null;
  cancellationNote?:     string | null;
  popFileName?:          string | null;
  popUploadedAt?:        string | null;
  sellerConfirmedAt?:    string | null;
  paymentInstructions?:  string | null;
  property?:        Property;
  seller?:          PublicUser;
  buyer?:           PublicUser;
  approvals?:       TransferApproval[];
  createdAt:        string;
  updatedAt:        string;
}

export interface MarketplaceListing {
  id:             string;
  propertyId:     string;
  sellerId:       string;
  minPrice:       number;
  maxPrice:       number;
  paymentMethods: string[];
  description:    string;
  status:         ListingStatus;
  property?:      Property;
  seller?:        PublicUser;
  interests?:     BuyerInterest[];
  myInterest?:    BuyerInterest | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface BuyerInterest {
  id:        string;
  listingId: string;
  buyerId:   string;
  message:   string | null;
  status:    InterestStatus;
  buyer?:    PublicUser;
  createdAt: string;
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

export type AcquisitionType = 'INITIAL_REGISTRATION' | 'TRANSFER' | 'DISPUTE_RESOLUTION';

export interface OwnershipRecord {
  id:               string;
  propertyId:       string;
  ownerId:          string;
  transferId:       string | null;
  acquiredAt:       string;
  releasedAt:       string | null;
  acquisitionType:  AcquisitionType;
  blockchainTxHash: string;
  owner?:           PublicUser;
}

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
  role:               UserRole | string;
  totalProperties:    number;
  pendingTransfers:   number;
  activeDisputes:     number;
  pendingApprovals?:  number;
  recentActivity:     ActivityLog[];
}

export interface PublicUser {
  id:            string;
  fullName:      string;
  walletAddress: string | null;
}

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

export interface ApiResponse<T> {
  success:   boolean;
  data:      T;
  timestamp: string;
}

export interface ApiError {
  success:    false;
  statusCode: number;
  error:      string;
  message:    string;
  timestamp:  string;
  path:       string;
}

export interface MessageRecipient {
  id:          string;
  messageId:   string;
  recipientId: string;
  readAt:      string | null;
  recipient?:  PublicUser;
}

export interface Message {
  id:                   string;
  senderId:             string;
  transferId:           string | null;
  subject:              string;
  body:                 string;
  attachmentFileName:   string | null;
  attachmentFileSize:   number | null;
  readAt?:              string | null;
  sender?:              PublicUser;
  transfer?:            { id: string; property?: { plotNumber: string; address: string } } | null;
  recipients?:          MessageRecipient[];
  createdAt:            string;
  updatedAt:            string;
}

export interface BlockchainTxState {
  txid:       string;
  status:     'pending' | 'confirmed' | 'failed';
  action:     string;
  entityId:   string;
  entityType: string;
  startedAt:  string;
}

export type TransferStep =
  | 'INITIATE'
  | 'BUYER_APPROVE'
  | 'REGISTRAR_APPROVE'
  | 'CONFIRMED'
  | 'CANCELLED';

export const stacksExplorerTxUrl = (txid: string, network: 'testnet' | 'mainnet' = 'testnet') =>
  `https://explorer.hiro.so/txid/${txid}?chain=${network}`;

export const stacksExplorerAddressUrl = (address: string, network: 'testnet' | 'mainnet' = 'testnet') =>
  `https://explorer.hiro.so/address/${address}?chain=${network}`;

export const ipfsGatewayUrl = (cid: string) =>
  `https://gateway.pinata.cloud/ipfs/${cid}`;
