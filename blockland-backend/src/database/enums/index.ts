// src/database/enums/index.ts — BlockLand Zimbabwe Database Enums

export enum UserRole {
  REGISTRAR = 'REGISTRAR',
  USER      = 'USER',
  PUBLIC    = 'PUBLIC',
  ADMIN     = 'ADMIN',
}

export enum PropertyStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE           = 'ACTIVE',
  PENDING_TRANSFER = 'PENDING_TRANSFER',
  DISPUTED         = 'DISPUTED',
  INACTIVE         = 'INACTIVE',
  DECLINED         = 'DECLINED',
}

export enum LandSizeUnit {
  SQM     = 'SQM',
  HECTARE = 'HECTARE',
  ACRE    = 'ACRE',
}

export enum ZoningType {
  RESIDENTIAL  = 'RESIDENTIAL',
  COMMERCIAL   = 'COMMERCIAL',
  AGRICULTURAL = 'AGRICULTURAL',
  INDUSTRIAL   = 'INDUSTRIAL',
}

export enum FileType {
  PDF = 'PDF',
  JPG = 'JPG',
  PNG = 'PNG',
}

export enum DocumentCategory {
  IMAGE    = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
}

export enum DocumentType {
  TITLE_DEED      = 'TITLE_DEED',
  SURVEY_DIAGRAM  = 'SURVEY_DIAGRAM',
  BUILDING_PLAN   = 'BUILDING_PLAN',
  OTHER           = 'OTHER',
  PHOTO           = 'PHOTO',
}

export enum AcquisitionType {
  INITIAL_REGISTRATION = 'INITIAL_REGISTRATION',
  TRANSFER             = 'TRANSFER',
  DISPUTE_RESOLUTION   = 'DISPUTE_RESOLUTION',
}

export enum TransferStatus {
  PENDING_BUYER     = 'PENDING_BUYER',
  PENDING_REGISTRAR = 'PENDING_REGISTRAR',
  CONFIRMED         = 'CONFIRMED',
  CANCELLED         = 'CANCELLED',
}

export enum ApproverRole {
  BUYER     = 'BUYER',
  REGISTRAR = 'REGISTRAR',
}

export enum ApprovalAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DisputeType {
  OWNERSHIP_CLAIM  = 'OWNERSHIP_CLAIM',
  BOUNDARY_DISPUTE = 'BOUNDARY_DISPUTE',
  FRAUD            = 'FRAUD',
  OTHER            = 'OTHER',
}

export enum DisputeStatus {
  OPEN         = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED     = 'RESOLVED',
  DISMISSED    = 'DISMISSED',
}

export enum VerificationQueryType {
  PROPERTY_ID = 'PROPERTY_ID',
  TITLE_DEED  = 'TITLE_DEED',
  OWNER_ID    = 'OWNER_ID',
}

export enum VerificationResultStatus {
  VERIFIED  = 'VERIFIED',
  MISMATCH  = 'MISMATCH',
  NOT_FOUND = 'NOT_FOUND',
}
