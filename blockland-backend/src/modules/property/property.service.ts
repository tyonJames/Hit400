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

  // ─────────────────────────────────────────────────────────────────────────

  async generateTitleDeedCertificate(id: string): Promise<Buffer> {
    const property = await this.propertyRepo.findOne({
      where: { id, status: PropertyStatus.ACTIVE },
      relations: ['currentOwner'],
    });
    if (!property) throw new NotFoundException('Active property not found.');

    const owner = await this.userRepo.findOne({ where: { id: property.currentOwnerId } });
    if (!owner) throw new NotFoundException('Property owner not found.');

    const network = this.configService.get('STACKS_NETWORK', 'testnet') === 'mainnet'
      ? 'Stacks Mainnet' : 'Stacks Testnet';

    const fmt = (d?: Date | string | null) =>
      d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

    const amountInWords = (n: number): string => {
      if (!n || isNaN(n)) return 'Not disclosed';
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                    'Seventeen','Eighteen','Nineteen'];
      const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const convert = (num: number): string => {
        if (num === 0) return '';
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
        if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
        if (num < 1_000_000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
        return convert(Math.floor(num / 1_000_000)) + ' Million' + (num % 1_000_000 ? ' ' + convert(num % 1_000_000) : '');
      };
      const whole = Math.floor(n);
      const cents = Math.round((n - whole) * 100);
      return convert(whole) + ' US Dollars' + (cents ? ` and ${cents}/100` : '');
    };

    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data',  (c) => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const NAVY   = '#1a2d5a';
      const GOLD   = '#b8860b';
      const RULE_C = '#9aa0b0';
      const LEFT   = 50;
      const RIGHT  = 545;
      const COL    = 220;

      const rule = (color = RULE_C) => {
        doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor(color).lineWidth(0.5).stroke();
        doc.moveDown(0.6);
      };

      const sectionHeader = (title: string) => {
        doc.moveDown(0.4);
        doc.rect(LEFT, doc.y, RIGHT - LEFT, 16).fill(NAVY);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
          .text(title, LEFT + 6, doc.y - 13, { width: RIGHT - LEFT - 12 });
        doc.fillColor('#000000').moveDown(0.9);
      };

      const tableRow = (label: string, value: string, bold = false) => {
        const y = doc.y;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#444')
          .text(label, LEFT + 4, y, { width: COL - LEFT - 4, continued: false });
        doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000')
          .text(value || '—', COL + 4, y, { width: RIGHT - COL - 4 });
        doc.moveDown(0.55);
        doc.moveTo(LEFT, doc.y - 2).lineTo(RIGHT, doc.y - 2).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      };

      // ── Header ───────────────────────────────────────────────────────────
      doc.rect(LEFT, doc.y, RIGHT - LEFT, 70).fill(NAVY);
      const headerY = doc.y - 63;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff')
        .text('REPUBLIC OF ZIMBABWE', LEFT, headerY, { align: 'center', width: RIGHT - LEFT });
      doc.fontSize(11).font('Helvetica-Bold').fillColor(GOLD)
        .text('DEEDS REGISTRY — CERTIFICATE OF TITLE', LEFT, headerY + 20, { align: 'center', width: RIGHT - LEFT });
      doc.fontSize(7).font('Helvetica').fillColor('#ccd6f6')
        .text('Deeds Registries Act [Chapter 20:05]  —  Issued under authority of the Registrar of Deeds', LEFT, headerY + 36, { align: 'center', width: RIGHT - LEFT });
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      // ── Title ─────────────────────────────────────────────────────────────
      doc.fontSize(18).font('Helvetica-Bold').fillColor(NAVY)
        .text('CERTIFICATE OF TITLE DEED', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica').fillColor('#555')
        .text('This certificate confirms lawful ownership of the property described herein,', { align: 'center' });
      doc.text('as registered on the BlockLand Zimbabwe digital land registry.', { align: 'center' });
      doc.fillColor('#000').moveDown(0.5);

      // Deed No row
      doc.rect(LEFT, doc.y, RIGHT - LEFT, 18).fill('#f8f9fc');
      const deedY = doc.y - 14;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#444')
        .text('Title Deed No.:', LEFT + 6, deedY, { continued: false });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
        .text(property.titleDeedNumber ?? '—', LEFT + 90, deedY, { continued: false });
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#444')
        .text('Registration Date:', LEFT + 280, deedY, { continued: false });
      doc.fontSize(8).font('Helvetica').fillColor('#000')
        .text(fmt(property.registrationDate ?? property.createdAt), LEFT + 370, deedY, { continued: false });
      doc.fillColor('#000').moveDown(0.8);

      rule(GOLD);

      // ── Section 1: Registered Owner ───────────────────────────────────────
      sectionHeader('1.  REGISTERED OWNER PARTICULARS');
      tableRow('Full Name', (owner.fullName ?? '').toUpperCase(), true);
      tableRow('National ID Number', owner.nationalId ?? '—');
      tableRow('BlockLand ID', owner.blocklandId ?? 'Not assigned');
      tableRow('Stacks Wallet Address (BlockLand)', owner.walletAddress ?? 'Not linked');
      doc.moveDown(0.3);

      // ── Section 2: Property ───────────────────────────────────────────────
      sectionHeader('2.  PROPERTY PARTICULARS');
      tableRow('Stand / Plot Number', property.plotNumber ?? '—', true);
      tableRow('Township / Location', property.address ?? '—');
      tableRow('Registered Extent', `${Number(property.landSize).toFixed(4)} ${property.unit ?? 'sqm'}`);
      tableRow('Zoning Classification', (property.zoningType ?? '—').replace(/_/g, ' '));
      tableRow('Title Deed Reference', property.titleDeedNumber ?? '—');
      doc.moveDown(0.3);

      // ── Section 3: Blockchain Record ──────────────────────────────────────
      sectionHeader('3.  BLOCKCHAIN RECORD');
      tableRow('BlockLand Property Token ID', property.tokenId ? `#${property.tokenId}` : 'Not registered');
      tableRow('Registration TX Hash', property.blockchainTxHash ?? '—');
      tableRow('Blockchain Network', network);
      tableRow('IPFS Document CID', property.ipfsHash?.match(/^(Qm|bafy)/) ? property.ipfsHash : 'Pending upload');
      doc.moveDown(0.3);

      // ── Section 4: Registration Audit Trail ───────────────────────────────
      sectionHeader('4.  REGISTRATION AUDIT TRAIL');

      // Table header
      doc.rect(LEFT, doc.y, RIGHT - LEFT, 14).fill('#eef0f7');
      const thY = doc.y - 10;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#333');
      doc.text('STEP', LEFT + 4, thY, { width: 30 });
      doc.text('ACTION', LEFT + 40, thY, { width: 160 });
      doc.text('ACTOR', LEFT + 210, thY, { width: 120 });
      doc.text('ON-CHAIN?', LEFT + 340, thY, { width: 80 });
      doc.fillColor('#000').moveDown(0.5);

      const auditRow = (step: string, action: string, actor: string, onChain: string) => {
        const ry = doc.y;
        doc.fontSize(7).font('Helvetica-Bold').fillColor(NAVY).text(step,   LEFT + 4,  ry, { width: 30 });
        doc.fontSize(7).font('Helvetica').fillColor('#000').text(action,     LEFT + 40, ry, { width: 160 });
        doc.text(actor,    LEFT + 210, ry, { width: 120 });
        doc.fontSize(7).font('Helvetica-Bold')
          .fillColor(onChain.startsWith('YES') ? '#15803d' : '#64748b')
          .text(onChain,   LEFT + 340, ry, { width: 80 });
        doc.fillColor('#000').moveDown(0.55);
        doc.moveTo(LEFT, doc.y - 2).lineTo(RIGHT, doc.y - 2).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      };

      auditRow('1', 'Property Submitted', owner.fullName ?? 'Owner', 'No (DB)');
      auditRow('2', 'Documents Verified', 'Deeds Registrar', 'No (DB)');
      auditRow('3', 'Registrar Approved', 'Deeds Registrar', 'No (DB)');
      auditRow('4', 'Blockchain Registration', 'Smart Contract', property.blockchainTxHash?.match(/^[0-9a-f]{64}$/) ? 'YES — Confirmed' : 'Simulated');
      doc.moveDown(0.5);

      // ── Section 5: Declaration ────────────────────────────────────────────
      sectionHeader('5.  DECLARATION');
      doc.fontSize(8).font('Helvetica').fillColor('#333')
        .text(
          `This is to certify that ${(owner.fullName ?? '').toUpperCase()} is the duly registered owner ` +
          `of the property described herein, as recorded in the BlockLand Zimbabwe Digital Land Registry ` +
          `on ${fmt(property.registrationDate ?? property.createdAt)}. This certificate is issued under ` +
          `the authority of the Registrar of Deeds in accordance with the Deeds Registries Act [Chapter 20:05].`,
          { lineGap: 3 },
        );
      doc.moveDown(1.0);

      // Signature blocks
      const sigY = doc.y;
      doc.moveTo(LEFT, sigY + 30).lineTo(LEFT + 150, sigY + 30).strokeColor('#000').lineWidth(0.5).stroke();
      doc.moveTo(RIGHT - 150, sigY + 30).lineTo(RIGHT, sigY + 30).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#555')
        .text('Signature — Registered Owner', LEFT, sigY + 33, { width: 150 });
      doc.text('Signature — Registrar of Deeds', RIGHT - 150, sigY + 33, { width: 150, align: 'right' });
      doc.moveDown(3.5);

      // ── Footer ────────────────────────────────────────────────────────────
      rule(GOLD);
      doc.rect(LEFT, doc.y, RIGHT - LEFT, 28).fill(NAVY);
      const footY = doc.y - 23;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(GOLD)
        .text('DEEDS REGISTRY — ZIMBABWE — OFFICIAL REGISTRATION', LEFT, footY, { align: 'center', width: RIGHT - LEFT });
      doc.fontSize(7).font('Helvetica').fillColor('#ccd6f6')
        .text(
          `Certificate of Title Deed No. ${property.titleDeedNumber ?? '—'} · Registered pursuant to Deeds Registries Act [Chapter 20:05] · BlockLand Zimbabwe`,
          LEFT, footY + 13, { align: 'center', width: RIGHT - LEFT },
        );

      doc.end();
    });
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
