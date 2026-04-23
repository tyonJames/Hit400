// =============================================================================
// data-source.ts  (project root — alongside package.json)
// BlockLand Zimbabwe — TypeORM CLI DataSource
// =============================================================================
//
// PURPOSE: Provides a standalone DataSource instance that the TypeORM CLI uses
//          to run migrations. This is SEPARATE from the NestJS-managed DataSource
//          in DatabaseModule — the CLI cannot use NestJS DI.
//
// USAGE (add these scripts to package.json):
//   "migration:generate": "typeorm-ts-node-esm migration:generate -d data-source.ts src/database/migrations/$(name)"
//   "migration:run":      "typeorm-ts-node-esm migration:run -d data-source.ts"
//   "migration:revert":   "typeorm-ts-node-esm migration:revert -d data-source.ts"
//   "migration:show":     "typeorm-ts-node-esm migration:show -d data-source.ts"
//
// EXAMPLE COMMANDS:
//   # Generate a new migration (after changing entities):
//   npx ts-node -r tsconfig-paths/register data-source.ts
//   npm run migration:generate -- AddWalletAddressIndex
//
//   # Run all pending migrations:
//   npm run migration:run
//
//   # Revert the last applied migration:
//   npm run migration:revert
//
// DOTENV:
//   This file loads .env manually because it runs outside the NestJS context.
//   The 'dotenv' package reads .env before TypeORM connects to the database.
//
// IMPORTANT: This file uses TypeScript entities directly (not compiled JS).
//            The TypeORM CLI command must be 'typeorm-ts-node-esm' (not 'typeorm').
//            Install: npm install -D ts-node typeorm-ts-node-esm
// =============================================================================

import 'dotenv/config'; // Load .env variables into process.env BEFORE anything else
import { DataSource }     from 'typeorm';
import { getDatabaseConfig } from './database.config';

/**
 * AppDataSource — the DataSource instance used by the TypeORM CLI.
 * It shares the same getDatabaseConfig() function as the NestJS module,
 * ensuring migrations always use the same entity list and settings.
 *
 * Note: The migrations path here points to TypeScript source files
 * (src/database/migrations/*.ts) so the CLI can run them without a prior build.
 * The database.config.ts uses 'dist/...' for the NestJS runtime (compiled JS).
 */
export const AppDataSource = new DataSource({
  ...getDatabaseConfig(),

  // Override migrations path for CLI — points to TypeScript source directly.
  // The CLI uses ts-node so it can execute TypeScript files without compiling.
  migrations: ['src/database/migrations/*.ts'],

  // Override entities path for CLI — also TypeScript source.
  entities: ['src/database/entities/*.entity.ts'],

  // Do NOT synchronize in migration CLI context — always use explicit migrations.
  synchronize: false,

  // Verbose logging for migration runs — shows each SQL statement executed.
  logging: ['migration', 'error'],
});
