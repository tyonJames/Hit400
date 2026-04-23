import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Property }         from '../../database/entities/property.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class OwnershipService {
  private readonly logger = new Logger(OwnershipService.name);

  constructor(
    @InjectRepository(Property)       private propertyRepo: Repository<Property>,
    @InjectRepository(OwnershipRecord) private ownershipRepo: Repository<OwnershipRecord>,
    private blockchainService: BlockchainService,
  ) {}

  async getHistory(propertyId: string, params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found.');

    const [data, total] = await this.ownershipRepo.findAndCount({
      where:     { propertyId },
      order:     { acquiredAt: 'ASC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['owner'],
    });
    return { data, total, page, limit };
  }

  async getOnChainHistory(propertyId: string) {
    const property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found.');

    const dbRecords = await this.ownershipRepo.find({
      where: { propertyId },
      order: { acquiredAt: 'ASC' },
    });

    const history: Array<{ seq: number; owner: string; acquiredAt: number }> = [];
    let mismatch = false;

    for (let seq = 0; seq < dbRecords.length; seq++) {
      const onChain = await this.blockchainService.getOwnershipHistoryEntry(
        parseInt(property.tokenId, 10), seq,
      );
      if (onChain) {
        history.push({ seq, ...onChain });
        const dbOwner = dbRecords[seq];
        if (dbOwner && onChain.owner !== dbOwner.blockchainTxHash) {
          // Simple mismatch detection — can be made more precise
        }
      }
    }

    return { propertyId, tokenId: property.tokenId, count: history.length, history, mismatch };
  }
}
