// =============================================================================
// src/lib/schemas/index.ts — BlockLand Zimbabwe Zod Validation Schemas
// =============================================================================

import { z } from 'zod';

const stacksPrincipal = z
  .string()
  .regex(/^S[PT][A-Z0-9]{38,39}$/, {
    message: 'Must be a valid Stacks wallet address (starts with SP or ST)',
  });

const strongPassword = z
  .string()
  .min(8,  { message: 'Password must be at least 8 characters' })
  .max(32, { message: 'Password must be at most 32 characters' });

const zimPhone = z
  .string()
  .regex(/^[0-9]{10,15}$/, {
    message: 'Phone number must be 10–15 digits (no spaces or dashes)',
  });

const fullName = z
  .string()
  .min(3,   { message: 'Full name must be at least 3 characters' })
  .max(100, { message: 'Full name must be at most 100 characters' })
  .regex(/^[a-zA-Z\s'-]+$/, {
    message: 'Full name may only contain letters, spaces, hyphens, and apostrophes',
  });

const latitude = z.coerce
  .number({ invalid_type_error: 'GPS latitude must be a number' })
  .min(-90,  { message: 'Latitude must be between -90 and 90' })
  .max(90,   { message: 'Latitude must be between -90 and 90' })
  .optional();

const longitude = z.coerce
  .number({ invalid_type_error: 'GPS longitude must be a number' })
  .min(-180, { message: 'Longitude must be between -180 and 180' })
  .max(180,  { message: 'Longitude must be between -180 and 180' })
  .optional();

export const loginSchema = z.object({
  email:    z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName:        fullName,
  nationalId:      z
    .string()
    .min(5,  { message: 'National ID must be at least 5 characters' })
    .max(20, { message: 'National ID must be at most 20 characters' })
    .regex(/^[0-9]{2}-?[0-9]{6}[A-Za-z]-?[0-9]{2}$/, {
      message: 'Enter a valid Zimbabwe National ID (e.g. 63-123456A-00)',
    }),
  email:           z.string().email({ message: 'Please enter a valid email address' }).max(100),
  phone:           zimPhone,
  password:        strongPassword,
  confirmPassword: z.string(),
  walletAddress:   stacksPrincipal.optional().or(z.literal('')).transform(v => v || undefined),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});
export type RegisterFormData = z.infer<typeof registerSchema>;

export const updateProfileSchema = z.object({
  fullName: fullName.optional(),
  phone:    zimPhone.optional(),
}).refine((d) => d.fullName || d.phone, {
  message: 'At least one field must be provided',
});
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword:     strongPassword,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const linkWalletSchema = z.object({
  walletAddress: stacksPrincipal,
});
export type LinkWalletFormData = z.infer<typeof linkWalletSchema>;

export const ZONING_TYPES    = ['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL'] as const;
export const LAND_SIZE_UNITS = ['SQM', 'HECTARE', 'ACRE'] as const;

export const createPropertySchema = z.object({
  plotNumber: z.string()
    .min(3,  { message: 'Plot number must be at least 3 characters' })
    .max(20, { message: 'Plot number must be at most 20 characters' })
    .regex(/^[a-zA-Z0-9\-\/]+$/, { message: 'Plot number must be alphanumeric (hyphens allowed)' }),
  titleDeedNumber: z.string()
    .min(5,  { message: 'Title deed number must be at least 5 characters' })
    .max(30, { message: 'Title deed number must be at most 30 characters' }),
  address: z.string()
    .min(5,   { message: 'Address must be at least 5 characters' })
    .max(150, { message: 'Address must be at most 150 characters' }),
  gpsLat:  latitude,
  gpsLng:  longitude,
  landSize: z.coerce
    .number({ invalid_type_error: 'Land size must be a number' })
    .positive({ message: 'Land size must be a positive number' }),
  unit: z.enum(LAND_SIZE_UNITS, {
    errorMap: () => ({ message: 'Please select a valid unit (SQM, HECTARE, or ACRE)' }),
  }),
  zoningType: z.enum(ZONING_TYPES, {
    errorMap: () => ({ message: 'Please select a valid zoning type' }),
  }),
  registrationDate: z.string()
    .min(1, { message: 'Registration date is required' })
    .refine((d) => new Date(d) <= new Date(), {
      message: 'Registration date cannot be in the future',
    }),
  notes: z.string().max(500, { message: 'Notes must be at most 500 characters' }).optional(),
});
export type CreatePropertyFormData = z.infer<typeof createPropertySchema>;

export const initiateTransferSchema = z.object({
  propertyId: z.string().uuid({ message: 'Please select a valid property' }),
  buyerId:    z.string().uuid({ message: 'Please select a valid buyer' }),
  saleValue:  z.coerce
    .number()
    .positive({ message: 'Sale value must be a positive number' })
    .optional()
    .or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes: z.string().max(500).optional(),
});
export type InitiateTransferFormData = z.infer<typeof initiateTransferSchema>;

export const transferActionSchema = z.object({
  notes: z.string().max(500, { message: 'Notes must be at most 500 characters' }).optional(),
});
export type TransferActionFormData = z.infer<typeof transferActionSchema>;

export const DISPUTE_TYPES = [
  'OWNERSHIP_CLAIM', 'BOUNDARY_DISPUTE', 'FRAUD', 'OTHER',
] as const;

export const createDisputeSchema = z.object({
  propertyId:  z.string().uuid({ message: 'Please select a valid property' }),
  disputeType: z.enum(DISPUTE_TYPES, {
    errorMap: () => ({ message: 'Please select a valid dispute type' }),
  }),
  description: z.string()
    .min(20,   { message: 'Description must be at least 20 characters' })
    .max(1000, { message: 'Description must be at most 1000 characters' }),
});
export type CreateDisputeFormData = z.infer<typeof createDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolutionNotes: z.string()
    .min(20,   { message: 'Resolution notes must be at least 20 characters' })
    .max(2000, { message: 'Resolution notes must be at most 2000 characters' }),
});
export type ResolveDisputeFormData = z.infer<typeof resolveDisputeSchema>;

export const verificationSchema = z.object({
  searchType:  z.enum(['plotNumber', 'titleDeedNumber', 'ownerId'] as const),
  searchValue: z.string().min(1, { message: 'Search value is required' }).max(100),
}).refine(
  (data) => {
    if (data.searchType === 'ownerId') {
      return z.string().uuid().safeParse(data.searchValue).success;
    }
    return true;
  },
  { message: 'Owner ID must be a valid UUID', path: ['searchValue'] }
);
export type VerificationFormData = z.infer<typeof verificationSchema>;

export const FILE_MAX_SIZE      = 5 * 1024 * 1024;
export const FILE_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function validateFile(file: File): string | null {
  if (!FILE_ALLOWED_TYPES.includes(file.type)) {
    return 'Only PDF, JPG, and PNG files are accepted.';
  }
  if (file.size > FILE_MAX_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return `File is ${mb}MB. Maximum allowed size is 5MB.`;
  }
  return null;
}
