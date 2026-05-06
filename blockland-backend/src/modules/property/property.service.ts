import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
  StreamableFile, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, In, ILike } from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import * as crypto          from 'crypto';
import * as fs              from 'fs';
import * as path            from 'path';
import PDFDocument          from 'pdfkit';
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
  private readonly logger = new Logger(PropertyService.name);

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

    // Persist file buffers to disk so registrars can view them later
    const uploadDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    for (const { file, hash } of taggedHashes) {
      const ext      = (file.originalname.split('.').pop() ?? 'bin').toLowerCase();
      const diskPath = path.join(uploadDir, `${hash}.${ext}`);
      if (!fs.existsSync(diskPath)) fs.writeFileSync(diskPath, file.buffer);
    }

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

  // ── Title deed PDF + IPFS upload ─────────────────────────────────────────

  private generateTitleDeedPdf(
    property: Property,
    owner:    User,
    txid:     string,
    tokenId:  number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];
      doc.on('data',  (c) => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fmt = (d?: Date | string | null) =>
        d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

      const row = (label: string, value: string) => {
        doc.fontSize(10).font('Helvetica-Bold').text(label, { continued: true });
        doc.font('Helvetica').text(`  ${value}`);
        doc.moveDown(0.4);
      };

      const rule = () => {
        doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(1);
      };

      // Header
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#000')
        .text('BLOCKLAND ZIMBABWE', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(12).font('Helvetica').fillColor('#555')
        .text('LAND REGISTRY', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000')
        .text('CERTIFICATE OF TITLE DEED', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').fillColor('#555')
        .text(property.titleDeedNumber, { align: 'center' });
      doc.fillColor('#000').moveDown(1);
      rule();

      // Property Details
      doc.fontSize(11).font('Helvetica-Bold').text('PROPERTY DETAILS');
      doc.moveDown(0.5);
      row('Plot Number:',        property.plotNumber);
      row('Title Deed No.:',     property.titleDeedNumber);
      row('Address:',            property.address);
      row('Land Size:',          `${Number(property.landSize).toFixed(4)} ${property.unit}`);
      row('Zoning:',             property.zoningType?.replace(/_/g, ' ') ?? '—');
      row('Registration Date:',  fmt(property.registrationDate));
      doc.moveDown(0.5);
      rule();

      // Registered Owner
      doc.fontSize(11).font('Helvetica-Bold').text('REGISTERED OWNER');
      doc.moveDown(0.5);
      row('Full Name:',    owner.fullName);
      row('National ID:',  owner.nationalId);
      if (owner.blocklandId)   row('Blockland ID:',   owner.blocklandId);
      if (owner.walletAddress) row('Wallet Address:', owner.walletAddress);
      doc.moveDown(0.5);
      rule();

      // Blockchain Record
      doc.fontSize(11).font('Helvetica-Bold').text('BLOCKCHAIN RECORD');
      doc.moveDown(0.5);
      row('Token ID:',          String(tokenId));
      row('Transaction Hash:',  txid);
      row('Network:',           this.configService.get('STACKS_NETWORK', 'testnet') === 'mainnet'
                                  ? 'Stacks Mainnet' : 'Stacks Testnet');
      row('Approved Date:',     fmt(new Date()));
      doc.moveDown(0.5);
      rule();

      // Footer
      doc.fontSize(9).fillColor('#555').text(
        'This is an official title deed issued by BlockLand Zimbabwe Land Registry. ' +
        'It is stored on IPFS and anchored on the Stacks blockchain, making it ' +
        'tamper-evident and publicly verifiable.',
        { align: 'center' },
      );

      doc.end();
    });
  }

  private async uploadToIpfs(buffer: Buffer, fileName: string): Promise<string> {
    const apiKey    = this.configService.get<string>('PINATA_API_KEY', '');
    const secretKey = this.configService.get<string>('PINATA_SECRET_API_KEY', '');
    if (!apiKey || !secretKey) throw new Error('Pinata credentials not configured');

    const FormData = require('form-data');
    const form     = new FormData();
    form.append('file', buffer, { filename: fileName, contentType: 'application/pdf' });

    // getBuffer() is required — native fetch in Node 24 cannot consume a
    // form-data readable stream directly (boundary strings cause Buffer.concat errors).
    const body = form.getBuffer();

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method:  'POST',
      headers: { pinata_api_key: apiKey, pinata_secret_api_key: secretKey, ...form.getHeaders() },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => String(res.status));
      throw new Error(`Pinata upload failed (${res.status}): ${detail}`);
    }
    const json: any = await res.json();
    return json.IpfsHash as string;
  }

  async regenerateTitleDeed(id: string): Promise<{ ipfsHash: string }> {
    const property = await this.propertyRepo.findOne({
      where: { id, status: PropertyStatus.ACTIVE },
      relations: ['currentOwner'],
    });
    if (!property) throw new NotFoundException('Active property not found.');

    const owner = await this.userRepo.findOne({ where: { id: property.currentOwnerId } });
    if (!owner) throw new NotFoundException('Property owner not found.');

    const tokenId = parseInt(property.tokenId ?? '0', 10) || 0;
    const txid    = property.blockchainTxHash ?? 'Not registered on-chain';

    const pdf      = await this.generateTitleDeedPdf(property, owner, txid, tokenId);
    const ipfsHash = await this.uploadToIpfs(pdf, `title-deed-${property.plotNumber}.pdf`);

    await this.propertyRepo.update({ id }, { ipfsHash });
    return { ipfsHash };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async approve(id: string, registrar: JwtPayload) {
    const property = await this.propertyRepo.findOne({
      where: { id, status: PropertyStatus.PENDING_APPROVAL },
      relations: ['currentOwner'],
    });
    if (!property) throw new NotFoundException('Pending property not found.');

    const owner = await this.userRepo.findOne({ where: { id: property.currentOwnerId } });
    if (!owner) throw new NotFoundException('Property owner not found.');

    // Derive next tokenId from the actual max numeric tokenId already in use,
    // so approval never conflicts with previously assigned ids.
    const maxRow = await this.propertyRepo
      .createQueryBuilder('p')
      .select("MAX(CAST(p.tokenId AS INTEGER))", 'max')
      .where("p.tokenId ~ '^[0-9]+$'")
      .getRawOne<{ max: string | null }>();
    const tokenId = (parseInt(maxRow?.max ?? '0', 10) || 0) + 1;

    // Use the comprehensive record hash (property fields + doc hashes) as the
    // on-chain fingerprint. Falls back to titleDeedNumber hash for legacy records.
    const recordHash = property.recordHash
      ?? crypto.createHash('sha256').update(property.titleDeedNumber).digest('hex');

    const registrarKey =
      this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY') ??
      this.configService.get<string>('STACKS_DEPLOYER_PRIVATE_KEY', '');
    const ownerAddress = owner.walletAddress && /^S[PT][A-Z0-9]{38,39}$/.test(owner.walletAddress)
      ? owner.walletAddress
      : 'SP000000000000000000002Q6VF78';

    const ipfsHash = `ipfs-${recordHash.slice(0, 40)}`;

    let txid: string;
    if (!registrarKey || !this.configService.get<string>('STACKS_CONTRACT_ADDRESS', '')) {
      txid = `sim-${Date.now()}-${id.slice(0, 8)}`;
    } else {
      try {
        txid = await this.blockchainService.registerProperty({
          propertyId:    tokenId,
          titleDeedHash: recordHash,
          ownerAddress,
          ipfsHash,
          senderKey:     registrarKey,
        });
      } catch (err: any) {
        this.logger.warn(`Blockchain register failed (continuing off-chain): ${err?.message}`);
        txid = `sim-${Date.now()}-${id.slice(0, 8)}`;
      }
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

    // Generate title deed PDF and upload to IPFS. Non-blocking — approval
    // is already committed; a Pinata failure just leaves ipfsHash as the
    // deterministic placeholder so the link stays hidden until it succeeds.
    try {
      const pdf          = await this.generateTitleDeedPdf(property, owner, txid, tokenId);
      const realIpfsHash = await this.uploadToIpfs(pdf, `title-deed-${property.plotNumber}.pdf`);
      await this.propertyRepo.update({ id }, { ipfsHash: realIpfsHash });
    } catch (err: any) {
      this.logger.warn(`Title deed IPFS upload failed (non-critical): ${err?.message}`);
    }

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

  async serveDocument(propertyId: string, docId: string): Promise<{ stream: StreamableFile; contentType: string; fileName: string }> {
    const doc = await this.docRepo.findOne({ where: { id: docId, propertyId } });
    if (!doc) throw new NotFoundException('Document not found.');

    const uploadDir = path.join(process.cwd(), 'uploads');
    // Try the stored fileType extension, then common alternatives
    const candidates = [
      doc.fileType.toLowerCase(),
      doc.fileType === 'JPG' ? 'jpeg' : null,
    ].filter(Boolean) as string[];

    // Also try scanning for the hash with any extension
    let filePath: string | null = null;
    for (const ext of candidates) {
      const candidate = path.join(uploadDir, `${doc.fileHash}.${ext}`);
      if (fs.existsSync(candidate)) { filePath = candidate; break; }
    }

    if (!filePath) {
      // Fallback: glob for any file with this hash prefix
      const entries = fs.readdirSync(uploadDir).filter(f => f.startsWith(doc.fileHash));
      if (entries.length > 0) filePath = path.join(uploadDir, entries[0]);
    }

    if (!filePath) throw new NotFoundException('File not found on disk.');

    const contentTypeMap: Record<string, string> = {
      pdf:  'application/pdf',
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      png:  'image/png',
    };
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const contentType = contentTypeMap[ext] ?? 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    return { stream: new StreamableFile(stream), contentType, fileName: doc.fileName };
  }

  async findAll(params: {
    page?: number; limit?: number;
    status?: PropertyStatus; zoningType?: string; search?: string;
  }) {
    const page  = +(params.page  ?? 1) || 1;
    const limit = +(params.limit ?? 20) || 20;

    const base: FindOptionsWhere<Property> = {};
    if (params.status)     base.status     = params.status;
    if (params.zoningType) base.zoningType = params.zoningType as any;

    const where: FindOptionsWhere<Property>[] = params.search
      ? [
          { ...base, plotNumber:      ILike(`%${params.search}%`) },
          { ...base, address:         ILike(`%${params.search}%`) },
          { ...base, titleDeedNumber: ILike(`%${params.search}%`) },
        ]
      : [base];

    const [data, total] = await this.propertyRepo.findAndCount({
      where,
      order:     { createdAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['currentOwner'],
    });
    return { data, total, page, limit };
  }

  async resubmit(id: string, userId: string) {
    const property = await this.propertyRepo.findOne({
      where: { id, status: PropertyStatus.DECLINED, currentOwnerId: userId },
    });
    if (!property) throw new NotFoundException('Property not found, not in declined state, or you are not the owner.');

    await this.propertyRepo.update({ id }, {
      status:              PropertyStatus.PENDING_APPROVAL,
      registrationComment: null,
    });

    await this.activityLogService.log({
      userId, action: 'PROPERTY_RESUBMITTED',
      entityType: 'Property', entityId: id,
      metadata: { plotNumber: property.plotNumber },
    });

    return this.propertyRepo.findOne({ where: { id }, relations: ['currentOwner', 'documents'] });
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
