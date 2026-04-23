// =============================================================================
// src/database/enums/index.ts
// BlockLand Zimbabwe — Database Enum Definitions
// =============================================================================
//
// MODULE:  Database Layer — Shared Enum Types
// PURPOSE: Defines every PostgreSQL enum type used across the database schema.
//          These enums serve two purposes simultaneously:
//            1. TypeScript compile-time type safety in entity files and services
//            2. PostgreSQL native enum types (enforced at the DB column level)
//
// USAGE IN ENTITIES:
//   @Column({ type: 'enum', enum: PropertyStatus, default: PropertyStatus.ACTIVE })
//   status: PropertyStatus;
//
// USAGE IN SERVICES:
//   if (property.status !== PropertyStatus.ACTIVE) throw new ConflictException(...)
//
// CONSISTENCY WITH SMART CONTRACT:
//   The Clarity contract uses lowercase string-ascii status values:
//     "active" | "pending-transfer" | "disputed"
//   These TypeScript enums use SCREAMING_SNAKE_CASE — they are the DB layer values.
//   The NestJS BlockchainService is responsible for translating between them.
//
// RELATED FILES:
//   contracts/blockland.clar         → On-chain status strings (lowercase)
//   src/database/entities/*.ts       → Entity classes that use these enums
//   src/modules/*/dto/*.ts           → DTO validation uses these enum values
// =============================================================================


// =============================================================================
// USER & ACCESS CONTROL ENUMS
// =============================================================================

/**
 * UserRole — the five roles a user can hold in BlockLand Zimbabwe.
 *
 * REGISTRAR : Land officer at the Deeds Registry. Can register properties,
 *             approve transfers, flag and resolve disputes. Corresponds to
 *             the 'authorized-registrars' map in the Clarity contract.
 *
 * OWNER     : Current property owner / seller. Can initiate transfers and
 *             view their own properties.
 *
 * BUYER     : Incoming transfer recipient. Must approve a transfer before
 *             the registrar can finalize it.
 *
 * PUBLIC    : Read-only viewer. Can perform verification queries and search
 *             the property registry. No write access.
 *
 * ADMIN     : System administrator. Can manage user accounts and registrar
 *             assignments. Calls initialize-registrar on the Clarity contract.
 */
export enum UserRole {
  REGISTRAR = 'REGISTRAR',
  OWNER     = 'OWNER',
  BUYER     = 'BUYER',
  PUBLIC    = 'PUBLIC',
  ADMIN     = 'ADMIN',
}


// =============================================================================
// PROPERTY ENUMS
// =============================================================================

/**
 * PropertyStatus — the lifecycle state of a land property record.
 *
 * Mirrors the on-chain status in the Clarity contract (property-registry.status):
 *   ACTIVE           ↔ "active"           (normal, transferable state)
 *   PENDING_TRANSFER ↔ "pending-transfer" (transfer initiated, locked)
 *   DISPUTED         ↔ "disputed"         (flagged, all transfers blocked)
 *   INACTIVE         — off-chain only (soft-delete / decommissioned)
 *
 * When the Clarity contract changes status on-chain, the NestJS polling job
 * must update this field in PostgreSQL to keep both layers in sync.
 */
export enum PropertyStatus {
  ACTIVE           = 'ACTIVE',
  PENDING_TRANSFER = 'PENDING_TRANSFER',
  DISPUTED         = 'DISPUTED',
  INACTIVE         = 'INACTIVE',
}

/**
 * LandSizeUnit — the unit of measurement for the land_size column.
 * Zimbabwe commonly uses hectares for farm land and square metres for plots.
 */
export enum LandSizeUnit {
  SQM     = 'SQM',     // Square metres — used for urban residential plots
  HECTARE = 'HECTARE', // Hectares — used for farms and large commercial land
  ACRE    = 'ACRE',    // Acres — legacy colonial measurement still in use
}

/**
 * ZoningType — how the land is zoned / approved for use under Zimbabwean law.
 * Defined at the local authority level. Affects valid transaction types.
 */
export enum ZoningType {
  RESIDENTIAL  = 'RESIDENTIAL',  // Housing, flats, townhouses
  COMMERCIAL   = 'COMMERCIAL',   // Shops, offices, business premises
  AGRICULTURAL = 'AGRICULTURAL', // Farming, grazing, irrigation land
  INDUSTRIAL   = 'INDUSTRIAL',   // Manufacturing, warehousing, factories
}

/**
 * FileType — the document formats accepted by the system.
 * IPFS stores the actual file; this enum records its MIME category.
 */
export enum FileType {
  PDF = 'PDF', // Primary format for title deeds and legal documents
  JPG = 'JPG', // Photo evidence (site inspections, boundary markers)
  PNG = 'PNG', // Screenshots, survey maps, digital documents
}


// =============================================================================
// OWNERSHIP ENUMS
// =============================================================================

/**
 * AcquisitionType — how a particular ownership record was created.
 * Every row in ownership_records must have one of these to explain WHY
 * the ownership changed, providing a full audit trail.
 *
 * INITIAL_REGISTRATION : First registration — created by register-property tx
 * TRANSFER             : Ownership changed via the 3-step transfer workflow
 * DISPUTE_RESOLUTION   : Registrar reassigned ownership when resolving a dispute
 */
export enum AcquisitionType {
  INITIAL_REGISTRATION = 'INITIAL_REGISTRATION',
  TRANSFER             = 'TRANSFER',
  DISPUTE_RESOLUTION   = 'DISPUTE_RESOLUTION',
}


// =============================================================================
// TRANSFER ENUMS
// =============================================================================

/**
 * TransferStatus — tracks which step of the 3-step transfer workflow is active.
 *
 * Mirrors the 3-step Clarity workflow:
 *   PENDING_BUYER     → initiate-transfer called, waiting for buyer-approve-transfer
 *   PENDING_REGISTRAR → buyer approved, waiting for registrar-finalize-transfer
 *   CONFIRMED         → registrar finalized — blockchain_tx_hash is populated
 *   CANCELLED         → cancelled by owner or registrar via cancel-transfer
 *
 * The NestJS TransferService updates this status after each on-chain confirmation.
 */
export enum TransferStatus {
  PENDING_BUYER     = 'PENDING_BUYER',     // Step 1 done — awaiting buyer approval
  PENDING_REGISTRAR = 'PENDING_REGISTRAR', // Step 2 done — awaiting registrar finalization
  CONFIRMED         = 'CONFIRMED',         // Step 3 done — ownership changed on-chain
  CANCELLED         = 'CANCELLED',         // Transfer was cancelled at any point
}

/**
 * ApproverRole — which role performed an approval action on a transfer.
 * Stored in transfer_approvals to identify who did what at each step.
 */
export enum ApproverRole {
  BUYER     = 'BUYER',     // buyer-approve-transfer — buyer consent step
  REGISTRAR = 'REGISTRAR', // registrar-finalize-transfer — official approval
}

/**
 * ApprovalAction — the decision made by an approver on a transfer step.
 * APPROVED → proceed to next step
 * REJECTED → treat as cancelled
 */
export enum ApprovalAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}


// =============================================================================
// DISPUTE ENUMS
// =============================================================================

/**
 * DisputeType — the category of a land dispute.
 * Determines the type of evidence required and resolution process.
 */
export enum DisputeType {
  OWNERSHIP_CLAIM   = 'OWNERSHIP_CLAIM',   // Two parties claim the same land
  BOUNDARY_DISPUTE  = 'BOUNDARY_DISPUTE',  // Disagreement over where boundaries lie
  FRAUD             = 'FRAUD',             // Suspected fraudulent registration or transfer
  OTHER             = 'OTHER',             // Any other dispute type not covered above
}

/**
 * DisputeStatus — the lifecycle state of a dispute record.
 *
 * Mirrors on-chain dispute flag (Clarity disputes map):
 *   OPEN         → flag-dispute called — disputes map entry = true
 *   UNDER_REVIEW → registrar is actively reviewing (off-chain state only)
 *   RESOLVED     → resolve-dispute called — disputes map entry deleted
 *   DISMISSED    → registrar dismissed without on-chain resolution (off-chain only)
 */
export enum DisputeStatus {
  OPEN         = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED     = 'RESOLVED',
  DISMISSED    = 'DISMISSED',
}


// =============================================================================
// VERIFICATION & LOGGING ENUMS
// =============================================================================

/**
 * VerificationQueryType — the type of identifier used in a public verification query.
 * Public viewers can verify ownership using any of these three identifiers.
 */
export enum VerificationQueryType {
  PROPERTY_ID  = 'PROPERTY_ID',  // Look up by the system UUID (properties.id)
  TITLE_DEED   = 'TITLE_DEED',   // Look up by title deed number (human-readable)
  OWNER_ID     = 'OWNER_ID',     // Look up all properties owned by a user UUID
}

/**
 * VerificationResultStatus — the outcome of an on-chain + off-chain cross-verification.
 *
 * VERIFIED   : DB owner and on-chain owner (from verify-owner) match — record is authentic
 * MISMATCH   : DB owner differs from on-chain owner — data integrity issue, needs investigation
 * NOT_FOUND  : No on-chain record found for this property — not yet registered or wrong ID
 */
export enum VerificationResultStatus {
  VERIFIED  = 'VERIFIED',
  MISMATCH  = 'MISMATCH',
  NOT_FOUND = 'NOT_FOUND',
}
