// =============================================================================
// src/database/database.config.ts
// BlockLand Zimbabwe — TypeORM DataSource Configuration
// =============================================================================
//
// MODULE:  Database Layer — Configuration
// PURPOSE: Defines the TypeORM DataSource used by both:
//            1. The NestJS application (imported in DatabaseModule)
//            2. The TypeORM CLI (referenced in data-source.ts at root)
//
// IMPORTANT — synchronize: false in PRODUCTION:
//   TypeORM's synchronize: true auto-creates/alters tables to match entities.
//   This is DANGEROUS in production — it can DROP columns, truncate data,
//   or cause schema drift. Always use migrations in production.
//
//   Development workflow:
//     synchronize: true  → entities auto-sync (fast iteration, data loss risk)
//   Production workflow:
//     synchronize: false → run `npm run migration:run` explicitly
//
// ENVIRONMENT VARIABLES (see .env.example):
//   DATABASE_HOST     — PostgreSQL host (default: localhost)
//   DATABASE_PORT     — PostgreSQL port (default: 5432)
//   DATABASE_NAME     — Database name (e.g., blockland_db)
//   DATABASE_USER     — PostgreSQL username
//   DATABASE_PASSWORD — PostgreSQL password
//   NODE_ENV          — 'development' | 'production' | 'test'
// =============================================================================

import { DataSourceOptions } from 'typeorm';

// Entity imports — every entity must be listed here OR use the glob pattern below.
// Explicit imports are preferred for production (avoids glob overhead at startup).
import { User }               from './entities/user.entity';
import { Role }               from './entities/role.entity';
import { UserRole }           from './entities/user-role.entity';
import { AuthToken }          from './entities/auth-token.entity';
import { Property }           from './entities/property.entity';
import { PropertyDocument }   from './entities/property-document.entity';
import { OwnershipRecord }    from './entities/ownership-record.entity';
import { Transfer }           from './entities/transfer.entity';
import { TransferApproval }   from './entities/transfer-approval.entity';
import { Dispute }            from './entities/dispute.entity';
import { DisputeEvidence }    from './entities/dispute-evidence.entity';
import { DisputeResolution }  from './entities/dispute-resolution.entity';
import { VerificationLog }    from './entities/verification-log.entity';
import { ActivityLog }        from './entities/activity-log.entity';

/**
 * Returns the TypeORM DataSourceOptions based on the current environment.
 * Called by DatabaseModule.forRootAsync() in NestJS and by data-source.ts for CLI.
 *
 * The function reads from process.env — ensure .env is loaded before calling.
 */
export function getDatabaseConfig(): DataSourceOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest       = process.env.NODE_ENV === 'test';

  return {
    // TypeORM driver: PostgreSQL only (not MySQL, SQLite, etc.)
    type: 'postgres',

    // Connection parameters — loaded from environment variables.
    // Never hardcode credentials. Use .env.local for development.
    host:     process.env.DATABASE_HOST     ?? 'localhost',
    port:     parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    database: process.env.DATABASE_NAME     ?? 'blockland_db',
    username: process.env.DATABASE_USER     ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? '',

    // SSL: required for cloud PostgreSQL (Render, Railway, Supabase, AWS RDS).
    // In development with local PostgreSQL, ssl should be false.
    ssl: isProduction
      ? { rejectUnauthorized: false }
      : false,

    // ---------------------------------------------------------------------------
    // ENTITY REGISTRATION
    // All 15 entity classes must be listed here.
    // TypeORM reads these to build the schema metadata it uses for queries.
    // ---------------------------------------------------------------------------
    entities: [
      User,
      Role,
      UserRole,
      AuthToken,
      Property,
      PropertyDocument,
      OwnershipRecord,
      Transfer,
      TransferApproval,
      Dispute,
      DisputeEvidence,
      DisputeResolution,
      VerificationLog,
      ActivityLog,
    ],

    // ---------------------------------------------------------------------------
    // MIGRATIONS
    // ---------------------------------------------------------------------------
    // Path to compiled migration files (TypeScript → JavaScript after tsc build).
    // The TypeORM CLI runs migrations from this location.
    migrations: ['dist/database/migrations/*.js'],

    // Migrations table name in the database — TypeORM uses this to track
    // which migrations have been applied.
    migrationsTableName: 'typeorm_migrations',

    // ---------------------------------------------------------------------------
    // SYNCHRONIZE — CRITICAL PRODUCTION SETTING
    // ---------------------------------------------------------------------------
    // Development: true allows fast iteration (entities auto-sync with DB).
    // Production:  MUST be false — use `npm run migration:run` instead.
    // Test:        false — migrations are run in test setup scripts.
    //
    // WARNING: synchronize: true will DROP columns that no longer exist in
    // entity definitions without warning, permanently deleting data.
    synchronize: !isProduction && !isTest,

    // Log all SQL queries in development — helpful for debugging.
    // Set to false in production to avoid sensitive data in logs.
    logging: !isProduction,

    // ---------------------------------------------------------------------------
    // CONNECTION POOL
    // TypeORM uses a connection pool to reuse database connections.
    // These values are tuned for a NestJS application on a small VPS.
    // ---------------------------------------------------------------------------
    extra: {
      // Maximum connections in the pool (adjust based on PostgreSQL max_connections)
      max: isProduction ? 20 : 5,
      // Minimum connections kept alive in the pool
      min: 1,
      // Time (ms) a connection can sit idle before being released
      idleTimeoutMillis: 30_000,
      // Time (ms) to wait for a connection before throwing an error
      connectionTimeoutMillis: 5_000,
    },
  };
}
