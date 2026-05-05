import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Property }          from '../../database/entities/property.entity';
import { User }              from '../../database/entities/user.entity';
import { VerificationLog }   from '../../database/entities/verification-log.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { VerificationQueryType, VerificationResultStatus } from '../../database/enums';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Property)        private propertyRepo: Repository<Property>,
    @InjectRepository(User)            private userRepo: Repository<User>,
    @InjectRepository(VerificationLog) private logRepo: Repository<VerificationLog>,
    private blockchainService: BlockchainService,
  ) {}

  async verify(params: {
    plotNumber?:      string;
    titleDeedNumber?: string;
    nationalId?:      string;
    ownerName?:       string;
  }, ipAddress?: string) {
    let property: Property | null = null;
    let properties: Property[]    = [];
    let queryType  = VerificationQueryType.PROPERTY_ID;
    let queryValue = '';
    let multiResult = false;

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
    } else if (params.nationalId) {
      queryType  = VerificationQueryType.OWNER_ID;
      queryValue = params.nationalId;
      const owner = await this.userRepo.findOne({ where: { nationalId: params.nationalId } });
      if (owner) {
        properties = await this.propertyRepo.find({
          where: { currentOwnerId: owner.id },
          relations: ['currentOwner'],
        });
        multiResult = true;
      }
    } else if (params.ownerName) {
      queryType  = VerificationQueryType.OWNER_ID;
      queryValue = params.ownerName;
      const owners = await this.userRepo.find({ where: { fullName: ILike(`%${params.ownerName}%`) } });
      if (owners.length) {
        const ownerIds = owners.map(o => o.id);
        properties = await this.propertyRepo
          .createQueryBuilder('p')
          .leftJoinAndSelect('p.currentOwner', 'owner')
          .where('p.current_owner_id = ANY(:ids)', { ids: ownerIds })
          .getMany();
        multiResult = true;
      }
    }

    // Multi-property result (nationalId / ownerName search)
    if (multiResult) {
      await this.logRepo.save(this.logRepo.create({
        queryType, queryValue,
        resultStatus: properties.length ? VerificationResultStatus.VERIFIED : VerificationResultStatus.NOT_FOUND,
        ipAddress,
      }));
      if (!properties.length) {
        return { status: VerificationResultStatus.NOT_FOUND, message: 'No properties found for this owner.' };
      }
      return {
        status: VerificationResultStatus.VERIFIED,
        message: `Found ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} registered to this owner.`,
        properties: properties.map(p => ({
          id:               p.id,
          plotNumber:       p.plotNumber,
          titleDeedNumber:  p.titleDeedNumber,
          address:          p.address,
          status:           p.status,
          registrationDate: p.registrationDate,
          blockchainTxHash: p.blockchainTxHash,
          owner:            p.currentOwner ? { fullName: p.currentOwner.fullName } : undefined,
        })),
      };
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
        titleDeedNumber:  property.titleDeedNumber,
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
