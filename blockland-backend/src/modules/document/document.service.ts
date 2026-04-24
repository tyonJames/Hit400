import { Injectable, NotFoundException, BadRequestException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import * as crypto          from 'crypto';
import * as fs              from 'fs';
import * as path            from 'path';
import { PropertyDocument } from '../../database/entities/property-document.entity';
import { Property }         from '../../database/entities/property.entity';
import { FileType }         from '../../database/enums';

// Simple Pinata IPFS upload via fetch
async function uploadToPinata(
  buffer: Buffer,
  fileName: string,
  apiKey: string,
  secretKey: string,
  gatewayUrl: string,
): Promise<string> {
  const FormData = require('form-data');
  const form     = new FormData();
  form.append('file', buffer, { filename: fileName });

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method:  'POST',
    headers: { pinata_api_key: apiKey, pinata_secret_api_key: secretKey, ...form.getHeaders() },
    body:    form,
  });
  if (!response.ok) throw new BadRequestException('IPFS upload failed.');
  const json: any = await response.json();
  return json.IpfsHash as string;
}

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(PropertyDocument) private docRepo: Repository<PropertyDocument>,
    @InjectRepository(Property)         private propRepo: Repository<Property>,
    private configService: ConfigService,
  ) {}

  async uploadForProperty(
    propertyId: string,
    uploadedById: string,
    file: Express.Multer.File,
  ) {
    const property = await this.propRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found.');

    const ext      = file.originalname.split('.').pop()?.toUpperCase() as FileType;
    const fileType = Object.values(FileType).includes(ext) ? ext : null;
    if (!fileType) throw new BadRequestException('Unsupported file type. Allowed: PDF, JPG, PNG.');

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const apiKey    = this.configService.get<string>('PINATA_API_KEY', '');
    const secretKey = this.configService.get<string>('PINATA_SECRET_API_KEY', '');
    const gateway   = this.configService.get<string>('PINATA_GATEWAY_URL', 'https://gateway.pinata.cloud');

    const ipfsHash = await uploadToPinata(file.buffer, file.originalname, apiKey, secretKey, gateway);

    const doc = this.docRepo.create({
      propertyId,
      uploadedById,
      fileName:      file.originalname,
      fileType,
      fileSizeBytes: file.size,
      ipfsHash,
      fileHash,
    });
    return this.docRepo.save(doc);
  }

  async getForProperty(propertyId: string) {
    const property = await this.propRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    return this.docRepo.find({ where: { propertyId }, order: { uploadedAt: 'DESC' } });
  }

  async serveFile(docId: string, res: any): Promise<StreamableFile> {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found.');

    const ext      = doc.fileType.toLowerCase();
    const filePath = path.resolve(process.cwd(), 'uploads', `${doc.fileHash}.${ext}`);

    if (!fs.existsSync(filePath)) throw new NotFoundException('File content not available on this server.');

    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    };
    res.set({
      'Content-Type':        mimeMap[ext] ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${doc.fileName}"`,
    });
    return new StreamableFile(fs.createReadStream(filePath));
  }
}
