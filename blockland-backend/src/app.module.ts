import { Module }               from '@nestjs/common';
import { ConfigModule }         from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD }            from '@nestjs/core';
import { DatabaseModule }       from './database/database.module';
import { BlockchainModule }     from './modules/blockchain/blockchain.module';
import { ActivityLogModule }    from './modules/activity-log/activity-log.module';
import { AuthModule }           from './modules/auth/auth.module';
import { PropertyModule }       from './modules/property/property.module';
import { TransferModule }       from './modules/transfer/transfer.module';
import { DisputeModule }        from './modules/dispute/dispute.module';
import { VerificationModule }   from './modules/verification/verification.module';
import { AdminModule }          from './modules/admin/admin.module';
import { DocumentModule }       from './modules/document/document.module';
import { DashboardModule }      from './modules/dashboard/dashboard.module';
import { OwnershipModule }      from './modules/ownership/ownership.module';
import { JwtAuthGuard }         from './common/guards/jwt-auth.guard';
import { RolesGuard }           from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    BlockchainModule,
    ActivityLogModule,
    AuthModule,
    PropertyModule,
    TransferModule,
    DisputeModule,
    VerificationModule,
    AdminModule,
    DocumentModule,
    DashboardModule,
    OwnershipModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
