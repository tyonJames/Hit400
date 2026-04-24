import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, In } from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import * as crypto          from 'crypto';
import { Property }         from '../../database/entities/property.entity';
import { User }             from '../../database/entities/user.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { PropertyDocument } from '../../database/entities/property-document.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  PropertyStatus, AcquisitionType, FileType, DocumentCategory, DocumentType,
} from '../../database/enums';
import { RegisterPropertyDto } from './dto/register-property.dto';
import { JwtPayload }          from '../auth/strategies/jwt.strategy';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)         private propertyRepo: Repository<Property>,
    @InjectRepository(User)             private userRepo: Repository<User>,
    @InjectRepository(OwnershipRecord)  private ownershipRepo: Repository<OwnershipRecord>,
    @InjectRepository(PropertyDocument) private docRepo: Repository<PropertyDocument>,
    private blockchainService: BlockchainService,
    private activityLogService: ActivityLogService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  private fileHash(buf: Buffer) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private toFileType(originalname: string): FileType {
    const ext = originalname.split('.').pop()?.toUpperCase();
    return (Object.values(FileType) as string[]).includes(ext ?? '')
      ? (ext as FileType)
      : FileType.JPG;
  }

  private computeRecordHash(
    dto: RegisterPropertyDto,
    submitterId: string,
    taggedHashes: Array<{ tag: string; hash: string }>,
  ): string {
    const filePart = [...taggedHashes]
      .sort((a, b) => a.tag.localeCompare(b.tag))
      .map(({ tag, hash }) => `${tag}:${hash}`)
      .join('|');

    const parts = [
      dto.plotNumber, dto.titleDeedNumber, dto.address,
      String(dto.landSize), dto.unit, dto.zoningType, dto.registrationDate,
      dto.gpsLat != null ? String(dto.gpsLat) : '',
      dto.gpsLng != null ? String(dto.gpsLng) : '',
      dto.notes ?? '', submitterId, filePart,
    ];
    return crypto.createHash('sha256').update(parts.join('||')).digest('hex');
  }

  async submit(
    dto: RegisterPropertyDto,
    files: {
      images?:               Express.Multer.File[];
      titleDeed?:            Express.Multer.File[];
      surveyDiagram?:        Express.Multer.File[];
      buildingPlan?:         Express.Multer.File[];
      deedOfTransfer?:       Express.Multer.File[];
      taxClearance?:         Express.Multer.File[];
      landDisputeAffidavit?: Express.Multer.File[];
    },
    submitter: JwtPayload,
  ) {
    const existing = await this.propertyRepo.findOne({
      where: [{ plotNumber: dto.plotNumber }, { titleDeedNumber: dto.titleDeedNumber }],
    });
    if (existing) throw new ConflictException('Plot number or title deed already registered.');

    // Build tagged file list for deterministic hashing
    const taggedHashes: Array<{ tag: string; hash: string; file: Express.Multer.File; category: DocumentCategory; docType: DocumentType }> = [];

    const addFiles = (field: string, list: Express.Multer.File[] | undefined, category: DocumentCategory, docType: DocumentType) => {
      (list ?? []).forEach((f, i) => taggedHashes.push({
        tag:      `${field}[${i}]`,
        hash:     this.fileHash(f.buffer),
        file:     f,
        category,
        docType,
      }));
    };

    addFiles('images',               files.images,               DocumentCategory.IMAGE,    DocumentType.PHOTO);
    addFiles('titleDeed',            files.titleDeed,            DocumentCategory.DOCUMENT, DocumentType.TITLE_DEED);
    addFiles('surveyDiagram',        files.surveyDiagram,        DocumentCategory.DOCUMENT, DocumentType.SURVEY_DIAGRAM);
    addFiles('buildingPlan',         files.buildingPlan,         DocumentCategory.DOCUMENT, DocumentType.BUILDING_PLAN);
    addFiles('deedOfTransfer',       files.deedOfTransfer,       DocumentCategory.DOCUMENT, DocumentType.DEED_OF_TRANSFER);
    addFiles('taxClearance',         files.taxClearance,         DocumentCategory.DOCUMENT, DocumentType.TAX_CLEARANCE);
    addFiles('landDisputeAffidavit', files.landDisputeAffidavit, DocumentCategory.DOCUMENT, DocumentType.LAND_DISPUTE_AFFIDAVIT);

    const recordHash = this.computeRecordHash(dto, submitter.sub, taggedHashes);

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
        status:           PropertyStatus.PENDING_APPROVAL,
        tokenId:          null,
        blockchainTxHash: null,
        ipfsHash:         null,
        recordHash,
        currentOwnerId:   submitter.sub,
        createdById:      submitter.sub,
      });
      await em.save(prop);

      for (const { file, hash, category, docType } of taggedHashes) {
        await em.save(em.create(PropertyDocument, {
          propertyId:    prop.id,
          uploadedById:  submitter.sub,
          fileName:      file.originalname,
          fileType:      this.toFileType(file.originalname),
          fileSizeBytes: file.size,
          ipfsHash:      `pending-${hash.slice(0, 40)}`,
          fileHash:      hash,
          category,
          documentType:  docType,
        }));
      }

      return prop;
    });

    await this.activityLogService.log({
      userId: submitter.sub, action: 'PROPERTY_SUBMITTED',
      entityType: 'Property', entityId: property.id,
      metadata: { plotNumber: dto.plotNumber, recordHash, fileCount: taggedHashes.length },
    });

    return property;
  }

  async approve(id: string, registrar: JwtPayload) {
    const property = await this.propertyRepo.findOne({
      where: { id, status: PropertyStatus.PENDING_APPROVAL },
      relations: ['currentOwner'],
    });
    if (!property) throw new NotFoundException('Pending property not found.');

    const owner = await this.userRepo.findOne({ where: { id: property.currentOwnerId } });
    if (!owner) throw new NotFoundException('Property owner not found.');

    const count   = await this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE } });
    const tokenId = count + 1;

    // Use the comprehensive record hash (property fields + doc hashes) as the
    // on-chain fingerprint. Falls back to titleDeedNumber hash for legacy records.
    const recordHash = property.recordHash
      ?? crypto.createHash('sha256').update(property.titleDeedNumber).digest('hex');

    const registrarKey = this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY', '');
    const ownerAddress = owner.walletAddress && /^S[PT][A-Z0-9]{38,39}$/.test(owner.walletAddress)
      ? owner.walletAddress
      : 'SP000000000000000000002Q6VF78';

    const ipfsHash = `ipfs-${recordHash.slice(0, 40)}`;

    let txid: string;
    if (!registrarKey || !this.configService.get<string>('CLARITY_CONTRACT_ADDRESS', '')) {
      txid = `mock-tx-${crypto.randomBytes(16).toString('hex')}`;
    } else {
      txid = await this.blockchainService.registerProperty({
        propertyId:    tokenId,
        titleDeedHash: recordHash,
        ownerAddress,
        ipfsHash,
        senderKey:     registrarKey,
      });
    }

    await this.dataSource.transaction(async (em) => {
      await em.update(Property, { id }, {
        status:           PropertyStatus.ACTIVE,
        tokenId:          String(tokenId),
        blockchainTxHash: txid,
        ipfsHash,
        registrationComment: null,
      });

      await em.save(em.create(OwnershipRecord, {
        propertyId:       id,
        ownerId:          property.currentOwnerId,
        acquiredAt:       new Date(),
        acquisitionType:  AcquisitionType.INITIAL_REGISTRATION,
        blockchainTxHash: txid,
      }));
    });

    await this.activityLogService.log({
      userId: registrar.sub, action: 'PROPERTY_APPROVED',
      entityType: 'Property', entityId: id,
      metadata: { tokenId, txid, recordHash },
    });

    return this.propertyRepo.findOne({ where: { id }, relations: ['currentOwner'] });
  }

  async decline(id: string, comment: string, registrar: JwtPayload) {
    const property = await this.propertyRepo.findOne({
      where: { id, status: PropertyStatus.PENDING_APPROVAL },
    });
    if (!property) throw new NotFoundException('Pending property not found.');

    await this.propertyRepo.update({ id }, {
      status:              PropertyStatus.DECLINED,
      registrationComment: comment,
    });

    await this.activityLogService.log({
      userId: registrar.sub, action: 'PROPERTY_DECLINED',
      entityType: 'Property', entityId: id,
      metadata: { comment },
    });

    return this.propertyRepo.findOne({ where: { id } });
  }

  async findAll(params: {
    page?: number; limit?: number;
    status?: PropertyStatus; zoningType?: string; search?: string;
  }) {
    const page  = +(params.page  ?? 1) || 1;
    const limit = +(params.limit ?? 20) || 20;
    const where: FindOptionsWhere<Property> = {};
    if (params.status)     where.status     = params.status;
    if (params.zoningType) where.zoningType = params.zoningType as any;

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
      relations: ['currentOwner', 'createdBy', 'documents'],
    });
    if (!property) throw new NotFoundException('Property not found.');

    if (property.status === PropertyStatus.ACTIVE && property.tokenId) {
      try {
        const onChainState = await this.blockchainService.verifyOwner(parseInt(property.tokenId, 10));
        return { ...property, onChainState };
      } catch {
        return { ...property, onChainState: null };
      }
    }

    return { ...property, onChainState: null };
  }

  async findByOwner(userId: string, params: { page?: number; limit?: number }) {
    const page  = +(params.page  ?? 1) || 1;
    const limit = +(params.limit ?? 20) || 20;
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
      where: { currentOwnerId: userId, status: In([
        PropertyStatus.ACTIVE,
        PropertyStatus.PENDING_APPROVAL,
        PropertyStatus.DECLINED,
        PropertyStatus.PENDING_TRANSFER,
        PropertyStatus.DISPUTED,
      ]) },
    });
    return {
      properties,
      totalOwned:       properties.filter(p => p.status === PropertyStatus.ACTIVE).length,
      pendingApproval:  properties.filter(p => p.status === PropertyStatus.PENDING_APPROVAL).length,
      pendingTransfers: 0,
      activeDisputes:   0,
    };
  }
}
