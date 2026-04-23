// =============================================================================
// src/database/database.module.ts
// BlockLand Zimbabwe — NestJS Database Module
// =============================================================================
//
// MODULE:  Database Layer — NestJS Module Wrapper
// PURPOSE: Integrates TypeORM into the NestJS dependency injection container.
//          This module is imported ONCE in AppModule as a global module — all
//          other feature modules (PropertyModule, TransferModule, etc.) receive
//          their repositories via @InjectRepository() without importing this again.
//
// TYPEORM PATTERN IN NESTJS:
//   TypeOrmModule.forRootAsync() — registers the DataSource globally (done here)
//   TypeOrmModule.forFeature([Entity]) — registers repositories per feature module
//
//   Example in PropertyModule:
//     TypeOrmModule.forFeature([Property, OwnershipRecord, ActivityLog])
//   Then in PropertyService:
//     constructor(@InjectRepository(Property) private repo: Repository<Property>) {}
//
// HOW forRootAsync() WORKS:
//   - inject: [ConfigService] — uses NestJS ConfigService to read env vars
//   - useFactory: () => {...} — factory function returns DataSourceOptions
//   - This pattern ensures env vars are loaded before TypeORM initialises
//   - ConfigModule.forRoot() must be imported in AppModule BEFORE DatabaseModule
//
// IMPORTS:
//   In AppModule:
//     imports: [
//       ConfigModule.forRoot({ isGlobal: true }),
//       DatabaseModule,  ← this module
//       AuthModule,
//       PropertyModule,
//       ...
//     ]
// =============================================================================

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from './database.config';

/**
 * @Global() — makes this module's exports (TypeOrmModule) available
 * throughout the entire application without re-importing in every feature module.
 * This is appropriate because the database connection is a singleton shared resource.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // ConfigModule provides access to process.env via ConfigService.
      // It must be available (imported globally) before this runs.
      imports: [ConfigModule],

      // The factory function returns TypeORM DataSourceOptions.
      // Using ConfigService ensures env vars are fully loaded before the
      // TypeORM DataSource is initialised — avoids race conditions on startup.
      useFactory: (_configService: ConfigService) => {
        // getDatabaseConfig() reads process.env directly for simplicity.
        // In production, use configService.get<string>('DATABASE_HOST') etc.
        // for typed, validated configuration.
        return getDatabaseConfig();
      },

      // Inject ConfigService into the factory function.
      inject: [ConfigService],
    }),
  ],
  // TypeOrmModule is re-exported so that feature modules can use
  // TypeOrmModule.forFeature([Entity]) without importing TypeOrmModule separately.
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
