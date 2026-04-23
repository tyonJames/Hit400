// =============================================================================
// src/database/index.ts
// BlockLand Zimbabwe — Database Layer Barrel Export
// =============================================================================
//
// PURPOSE: Single entry point for importing anything from the database layer.
//          Feature modules (PropertyModule, AuthModule, etc.) import from here
//          rather than reaching into the deep file paths directly.
//
// USAGE IN FEATURE MODULES:
//   import { Property, PropertyStatus, DatabaseModule } from '../database';
//   import { User, UserRole, Transfer, TransferStatus } from '../database';
//
// WHY BARREL EXPORTS?
//   - Shorter import paths in feature modules
//   - Easy to refactor file locations without changing every import site
//   - Explicit public API surface — if it's not exported here, it's internal
// =============================================================================

// ---------------------------------------------------------------------------
// Enums — import these everywhere instead of from the enums file directly
// ---------------------------------------------------------------------------
export * from './enums';

// ---------------------------------------------------------------------------
// Entities — all 15 TypeORM entity classes
// ---------------------------------------------------------------------------
export { BaseEntity }        from './entities/base.entity';
export { User }              from './entities/user.entity';
export { Role }              from './entities/role.entity';
export { UserRole }          from './entities/user-role.entity';
export { AuthToken }         from './entities/auth-token.entity';
export { Property }          from './entities/property.entity';
export { PropertyDocument }  from './entities/property-document.entity';
export { OwnershipRecord }   from './entities/ownership-record.entity';
export { Transfer }          from './entities/transfer.entity';
export { TransferApproval }  from './entities/transfer-approval.entity';
export { Dispute }           from './entities/dispute.entity';
export { DisputeEvidence }   from './entities/dispute-evidence.entity';
export { DisputeResolution } from './entities/dispute-resolution.entity';
export { VerificationLog }   from './entities/verification-log.entity';
export { ActivityLog }       from './entities/activity-log.entity';

// ---------------------------------------------------------------------------
// Configuration & Module
// ---------------------------------------------------------------------------
export { getDatabaseConfig } from './database.config';
export { DatabaseModule }    from './database.module';
