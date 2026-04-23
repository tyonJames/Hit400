import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { Property }          from '../../database/entities/property.entity';
import { VerificationLog }   from '../../database/entities/verification-log.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { VerificationQueryType, VerificationResultStatus } from '../../database/enums';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Property)        private propertyRepo: Repository<Property>,
    @InjectRepository(VerificationLog) private logRepo: Repository<VerificationLog>,
    private blockchainService: BlockchainService,
  ) {}

  async verify(params: {
    plotNumber?:       string;
    titleDeedNumber?:  string;
    ownerId?:          string;
  }, ipAddress?: string) {
    let property: Property | null = null;
    let queryType = VerificationQueryType.PROPERTY_ID;
    let queryValue = '';

    if (params.plotNumber) {
      queryType  = VerificationQueryType.TITLE_DEED;
      queryValue = params.plotNumber;
      property   = await this.propertyRepo.findOne({
        where: { plotNumber: params.plotNumber },
        relations: ['currentOwner'],
      });
    } else if (params.titleDeedNumber) {
      queryType  = VerificationQueryType.TITLE_DEED;
      queryValue = params.titleDeedNumber;
      property   = await this.propertyRepo.findOne({
        where: { titleDeedNumber: params.titleDeedNumber },
        relations: ['currentOwner'],
      });
    } else if (params.ownerId) {
      queryType  = VerificationQueryType.OWNER_ID;
      queryValue = params.ownerId;
      property   = await this.propertyRepo.findOne({
        where: { currentOwnerId: params.ownerId },
        relations: ['currentOwner'],
      });
    }

    if (!property) {
      await this.logRepo.save(this.logRepo.create({
        queryType, queryValue, resultStatus: VerificationResultStatus.NOT_FOUND, ipAddress,
      }));
      return { status: VerificationResultStatus.NOT_FOUND, message: 'Property not found.' };
    }

    const onChain = await this.blockchainService.verifyOwner(parseInt(property.tokenId, 10));
    const dbOwnerWallet = property.currentOwner?.walletAddress;
    const status = onChain.owner && dbOwnerWallet && onChain.owner === dbOwnerWallet
      ? VerificationResultStatus.VERIFIED
      : VerificationResultStatus.MISMATCH;

    await this.logRepo.save(this.logRepo.create({ queryType, queryValue, resultStatus: status, ipAddress }));

    return {
      status,
      message: status === VerificationResultStatus.VERIFIED
        ? 'Property ownership verified on-chain.'
        : 'On-chain and off-chain ownership mismatch detected.',
      property: {
        id:               property.id,
        plotNumber:       property.plotNumber,
        address:          property.address,
        status:           property.status,
        registrationDate: property.registrationDate,
        tokenId:          property.tokenId,
        blockchainTxHash: property.blockchainTxHash,
      },
      owner: property.currentOwner
        ? { fullName: property.currentOwner.fullName, walletAddress: property.currentOwner.walletAddress }
        : undefined,
      onChainOwner: onChain.owner,
    };
  }

  async verifyById(propertyId: string, ipAddress?: string) {
    const property = await this.propertyRepo.findOne({
      where: { id: propertyId },
      relations: ['currentOwner'],
    });
    if (!property) throw new NotFoundException('Property not found.');
    return this.verify({ plotNumber: property.plotNumber }, ipAddress);
  }
}
