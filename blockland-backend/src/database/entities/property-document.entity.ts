import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  CreateDateColumn,
} from 'typeorm';
import { Property }        from './property.entity';
import { User }            from './user.entity';
import { FileType, DocumentCategory, DocumentType } from '../enums';

@Entity('property_documents')
@Index('IDX_prop_docs_property_id', ['propertyId'])
@Index('IDX_prop_docs_uploaded_by', ['uploadedById'])
@Index('IDX_prop_docs_ipfs_hash',   ['ipfsHash'])
@Check('CHK_prop_docs_file_size', `file_size_bytes > 0 AND file_size_bytes <= 5242880`)
export class PropertyDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedById: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_type', type: 'enum', enum: FileType })
  fileType: FileType;

  @Column({ name: 'category', type: 'enum', enum: DocumentCategory, default: DocumentCategory.DOCUMENT })
  category: DocumentCategory;

  @Column({ name: 'document_type', type: 'enum', enum: DocumentType, default: DocumentType.OTHER })
  documentType: DocumentType;

  @Column({ name: 'file_size_bytes', type: 'integer' })
  fileSizeBytes: number;

  @Column({ name: 'ipfs_hash', type: 'varchar', length: 100 })
  ipfsHash: string;

  @Column({ name: 'file_hash', type: 'char', length: 64 })
  fileHash: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Property, (prop) => prop.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;
}
