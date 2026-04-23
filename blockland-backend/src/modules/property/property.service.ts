import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, FindOptionsWhere } from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import * as crypto          from 'crypto';
import { Property }         from '../../database/entities/property.entity';
import { User }             from '../../database/entities/user.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  PropertyStatus, AcquisitionType, UserRole,
} from '../../database/enums';
import { RegisterPropertyDto } from './dto/register-property.dto';
import { JwtPayload }          from '../auth/strategies/jwt.strategy';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)       private propertyRepo: Repository<Property>,
    @InjectRepository(User)           private userRepo: Repository<User>,
    @InjectRepository(OwnershipRecord) private ownershipRepo: Repository<OwnershipRecord>,
    private blockchainService: BlockchainService,
    private activityLogService: ActivityLogService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async register(dto: RegisterPropertyDto, ipfsHash: string, registrar: JwtPayload) {
    const existing = await this.propertyRepo.findOne({
      where: [{ plotNumber: dto.plotNumber }, { titleDeedNumber: dto.titleDeedNumber }],
    });
    if (existing) throw new ConflictException('Plot number or title deed number already registered.');

    const owner = await this.userRepo.findOne({ where: { id: dto.ownerId, isActive: true } });
    if (!owner) throw new NotFoundException('Owner user not found.');

    // Next token ID = count + 1
    const count   = await this.propertyRepo.count();
    const tokenId = count + 1;

    const titleDeedHash = crypto
      .createHash('sha256')
      .update(dto.titleDeedNumber)
      .digest('hex');

    const registrarKey  = this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY', '');
    const ownerAddress  = owner.walletAddress ?? owner.id;

    const txid = await this.blockchainService.registerProperty({
      propertyId:    tokenId,
      titleDeedHash,
      ownerAddress,
      ipfsHash,
      senderKey:     registrarKey,
    });

    const property = await this.dataSource.transaction(async (em) => {
      const prop = em.create(Property, {
        plotNumber:       dto.plotNumber,
        titleDeedNumber:  dto.titleDeedNumber,
        address:          dto.address,
        landSize:         dto.landSize,
        unit:             dto.unit,
        zoningType:       dto.zoningType,
        registrationDate: dto.registrationDate,
        gpsLat:           dto.gpsLat ?? null,
        gpsLng:           dto.gpsLng ?? null,
        notes:            dto.notes ?? null,
        tokenId:          String(tokenId),
        blockchainTxHash: txid,
        ipfsHash,
        currentOwnerId:   dto.ownerId,
        createdById:      registrar.sub,
      });
      await em.save(prop);

      await em.save(em.create(OwnershipRecord, {
        propertyId:       prop.id,
        ownerId:          dto.ownerId,
        acquiredAt:       new Date(),
        acquisitionType:  AcquisitionType.INITIAL_REGISTRATION,
        blockchainTxHash: txid,
      }));

      return prop;
    });

    await this.activityLogService.log({
      userId: registrar.sub, action: 'PROPERTY_REGISTERED',
      entityType: 'Property', entityId: property.id,
      metadata: { tokenId, txid },
    });

    return { property, txid };
  }

  async findAll(params: {
    page?: number; limit?: number;
    status?: PropertyStatus; zoningType?: string; search?: string;
  }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const where: FindOptionsWhere<Property> = {};
    if (params.status)     where.status     = params.status;
    if (params.zoningType) where.zoningType = params.zoningType as any;
    if (params.search) {
      // Simple search on address
    }

    const [data, total] = await this.propertyRepo.findAndCount({
      where,
      order:     { createdAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['currentOwner'],
    });
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const property = await this.propertyRepo.findOne({
      where:     { id },
      relations: ['currentOwner', 'createdBy'],
    });
    if (!property) throw new NotFoundException('Property not found.');

    // Enrich with on-chain state
    const onChainState = await this.blockchainService.verifyOwner(parseInt(property.tokenId, 10));
    return { ...property, onChainState };
  }

  async findByOwner(userId: string, params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.propertyRepo.findAndCount({
      where:     { currentOwnerId: userId },
      order:     { createdAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['currentOwner'],
    });
    return { data, total, page, limit };
  }

  async getMyPortfolio(userId: string) {
    const properties = await this.propertyRepo.find({
      where: { currentOwnerId: userId, status: PropertyStatus.ACTIVE },
    });
    return {
      properties,
      totalOwned:       properties.length,
      pendingTransfers: 0,
      activeDisputes:   0,
    };
  }
}
