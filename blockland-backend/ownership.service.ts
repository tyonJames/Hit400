// =============================================================================
// src/modules/ownership/ownership.service.ts
// BlockLand Zimbabwe — Ownership History Service
// =============================================================================
//
// MODULE:  OwnershipModule
// PURPOSE: Provides two ownership history views for a property:
//   1. DB history — from ownership_records table (fast, rich metadata)
//   2. On-chain history — from Clarity contract (authoritative, slower)
//
// CROSS-REFERENCING:
//   The DB and on-chain histories should always agree in sequence and owner.
//   If they differ, a MISMATCH is logged and flagged for admin investigation.
//   The on-chain sequence number (seq 0, 1, 2...) maps to the DB rows ordered
//   by acquired_at ascending.
// =============================================================================

import {
  Injectable, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Property }         from '../../database/entities/property.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { JwtPayload }       from '../auth/strategies/jwt.strategy';

@Injectable()
export class OwnershipService {
  private readonly logger = new Logger(OwnershipService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo:  Repository<Property>,
    @InjectRepository(OwnershipRecord)
    private readonly ownershipRepo: Repository<OwnershipRecord>,
    private readonly blockchain:    BlockchainService,
  ) {}

  /**
   * getDbHistory — retrieves ownership history from the PostgreSQL database.
   * Ordered chronologically (oldest first) with full owner metadata.
   * Paginated for properties with long histories.
   *
   * Access: PUBLIC gets limited fields; REGISTRAR/ADMIN/OWNER gets full records.
   *
   * @param propertyId — UUID of the property
   * @param page       — page number (1-based)
   * @param limit      — records per page
   */
  async getDbHistory(
    propertyId: string,
    page  = 1,
    limit = 20,
  ): Promise<{
    data:  OwnershipRecord[];
    total: number;
    page:  number;
    limit: number;
  }> {
    // Verify the property exists
    const exists = await this.propertyRepo.existsBy({ id: propertyId });
    if (!exists) throw new NotFoundException(`Property '${propertyId}' not found.`);

    const [data, total] = await this.ownershipRepo.findAndCount({
      where:     { propertyId },
      relations: ['owner'],       // Join to get owner name/wallet for display
      order:     { acquiredAt: 'ASC' }, // Chronological — oldest first
      skip:      (page - 1) * limit,
      take:      limit,
    });

    return { data, total, page, limit };
  }

  /**
   * getOnChainHistory — fetches ownership history directly from the Clarity contract.
   * Uses get-ownership-history-count → N × get-ownership-history-entry.
   * This is the authoritative ground truth — used for audit and cross-verification.
   *
   * Access: REGISTRAR / ADMIN only (involves multiple read-only calls).
   *
   * @param propertyId — UUID of the property (used to look up tokenId)
   */
  async getOnChainHistory(propertyId: string): Promise<{
    propertyId: string;
    tokenId:    string;
    count:      number;
    history:    Array<{ seq: number; owner: string; acquiredAt: number }>;
    mismatch:   boolean;
  }> {
    const property = await this.propertyRepo.findOneBy({ id: propertyId });
    if (!property) throw new NotFoundException(`Property '${propertyId}' not found.`);

    const tokenIdNum = parseInt(property.tokenId, 10);

    // Fetch the complete on-chain history via BlockchainService
    const onChainEntries = await this.blockchain.getOwnershipHistory(tokenIdNum);

    // Cross-reference with DB history to detect mismatches
    const dbHistory = await this.ownershipRepo.find({
      where:     { propertyId },
      order:     { acquiredAt: 'ASC' },
      relations: ['owner'],
    });

    // Check for count mismatch (simple integrity indicator)
    const mismatch = onChainEntries.length !== dbHistory.length;
    if (mismatch) {
      this.logger.warn(
        `OWNERSHIP MISMATCH for property ${propertyId}: ` +
        `on-chain ${onChainEntries.length} entries vs DB ${dbHistory.length} entries`,
      );
    }

    return {
      propertyId,
      tokenId:  property.tokenId,
      count:    onChainEntries.length,
      history:  onChainEntries.map((entry, seq) => ({ seq, ...entry })),
      mismatch,
    };
  }
}
