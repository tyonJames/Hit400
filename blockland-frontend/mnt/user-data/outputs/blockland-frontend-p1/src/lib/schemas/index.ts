// =============================================================================
// src/lib/schemas/index.ts — BlockLand Zimbabwe Zod Validation Schemas
// =============================================================================
//
// PURPOSE: Defines every form validation schema using Zod. These schemas:
//   1. Mirror the backend class-validator rules exactly (same min/max lengths,
//      same regex patterns) — ensuring client and server agree on valid input
//   2. Are consumed by React Hook Form via zodResolver()
//   3. Provide friendly, context-specific error messages (not raw Zod output)
//
// USAGE WITH REACT HOOK FORM:
//   import { useForm } from 'react-hook-form';
//   import { zodResolver } from '@hookform/resolvers/zod';
//   import { loginSchema, type LoginFormData } from '@/lib/schemas';
//
//   const form = useForm<LoginFormData>({
//     resolver: zodResolver(loginSchema),
//     defaultValues: { email: '', password: '' },
//   });
//
// STACKS WALLET FORMAT:
//   Stacks principals start with SP (mainnet) or ST (testnet).
//   Format: S[PT][A-Z0-9]{38,39}
//   Example testnet: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
// =============================================================================

import { z } from 'zod';

// =============================================================================
// REUSABLE FIELD VALIDATORS
// =============================================================================
// Define once, compose everywhere — avoids copy-paste drift between schemas.

/** Stacks wallet address — mainnet (SP) or testnet (ST) */
const stacksPrincipal = z
  .string()
  .regex(/^S[PT][A-Z0-9]{38,39}$/, {
    message: 'Must be a valid Stacks wallet address (starts with SP or ST)',
  });

/** Strong password: 8–32 chars, uppercase, lowercase, number, special char */
const strongPassword = z
  .string()
  .min(8,  { message: 'Password must be at least 8 characters' })
  .max(32, { message: 'Password must be at most 32 characters' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[@$!%*?&._\-#]/, {
    message: 'Password must contain at least one special character (@$!%*?&._-#)',
  });

/** Zimbabwe phone: 10–15 digits only */
const zimPhone = z
  .string()
  .regex(/^[0-9]{10,15}$/, {
    message: 'Phone number must be 10–15 digits (no spaces or dashes)',
  });

/** Full name: letters, spaces, hyphens, apostrophes — 3–100 chars */
const fullName = z
  .string()
  .min(3,   { message: 'Full name must be at least 3 characters' })
  .max(100, { message: 'Full name must be at most 100 characters' })
  .regex(/^[a-zA-Z\s'-]+$/, {
    message: 'Full name may only contain letters, spaces, hyphens, and apostrophes',
  });

/** GPS latitude: -90 to +90 */
const latitude = z.coerce
  .number({ invalid_type_error: 'GPS latitude must be a number' })
  .min(-90,  { message: 'Latitude must be between -90 and 90' })
  .max(90,   { message: 'Latitude must be between -90 and 90' })
  .optional();

/** GPS longitude: -180 to +180 */
const longitude = z.coerce
  .number({ invalid_type_error: 'GPS longitude must be a number' })
  .min(-180, { message: 'Longitude must be between -180 and 180' })
  .max(180,  { message: 'Longitude must be between -180 and 180' })
  .optional();

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

/** POST /api/v1/auth/login */
export const loginSchema = z.object({
  email:    z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});
export type LoginFormData = z.infer<typeof loginSchema>;

/** POST /api/v1/auth/register */
export const registerSchema = z.object({
  fullName:      fullName,
  nationalId:    z.string().min(5, { message: 'National ID must be at least 5 characters' }).max(20),
  email:         z.string().email({ message: 'Please enter a valid email address' }).max(100),
  phone:         zimPhone,
  password:      strongPassword,
  confirmPassword: z.string(),
  walletAddress: stacksPrincipal.optional().or(z.literal('')).transform(v => v || undefined),
}).refine((data) => data.password === data.confirmPassword, {
  message:  'Passwords do not match',
  path:     ['confirmPassword'],
});
export type RegisterFormData = z.infer<typeof registerSchema>;

/** POST /api/v1/auth/forgot-password */
export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/** POST /api/v1/auth/reset-password */
export const resetPasswordSchema = z.object({
  token:           z.string().min(1),
  newPassword:     strongPassword,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/** PATCH /api/v1/users/me */
export const updateProfileSchema = z.object({
  fullName: fullName.optional(),
  phone:    zimPhone.optional(),
}).refine((d) => d.fullName || d.phone, {
  message: 'At least one field must be provided',
});
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/** PATCH /api/v1/users/me/password */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword:     strongPassword,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

/** PATCH /api/v1/users/me/wallet */
export const linkWalletSchema = z.object({
  walletAddress: stacksPrincipal,
});
export type LinkWalletFormData = z.infer<typeof linkWalletSchema>;

// =============================================================================
// PROPERTY SCHEMAS
// =============================================================================

export const ZONING_TYPES    = ['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL'] as const;
export const LAND_SIZE_UNITS = ['SQM', 'HECTARE', 'ACRE'] as const;

/** POST /api/v1/properties — multipart, but we validate the fields separately */
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

  ownerNationalId: z.string()
    .min(5,  { message: 'Owner national ID must be at least 5 characters' })
    .max(20, { message: 'Owner national ID must be at most 20 characters' }),

  notes: z.string().max(500, { message: 'Notes must be at most 500 characters' }).optional(),
});
export type CreatePropertyFormData = z.infer<typeof createPropertySchema>;

// =============================================================================
// TRANSFER SCHEMAS
// =============================================================================

/** POST /api/v1/transfers */
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

/** PATCH /transfers/:id/buyer-approve or cancel */
export const transferActionSchema = z.object({
  notes: z.string().max(500, { message: 'Notes must be at most 500 characters' }).optional(),
});
export type TransferActionFormData = z.infer<typeof transferActionSchema>;

// =============================================================================
// DISPUTE SCHEMAS
// =============================================================================

export const DISPUTE_TYPES = [
  'OWNERSHIP_CLAIM', 'BOUNDARY_DISPUTE', 'FRAUD', 'OTHER',
] as const;

/** POST /api/v1/disputes */
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

/** PATCH /disputes/:id/resolve */
export const resolveDisputeSchema = z.object({
  resolutionNotes: z.string()
    .min(20,   { message: 'Resolution notes must be at least 20 characters' })
    .max(2000, { message: 'Resolution notes must be at most 2000 characters' }),
});
export type ResolveDisputeFormData = z.infer<typeof resolveDisputeSchema>;

// =============================================================================
// VERIFICATION SCHEMA
// =============================================================================

/** GET /api/v1/verify — public search form */
export const verificationSchema = z.object({
  searchType: z.enum(['plotNumber', 'titleDeedNumber', 'ownerId'] as const),
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

// =============================================================================
// FILE UPLOAD VALIDATION (client-side)
// =============================================================================

export const FILE_MAX_SIZE     = 5 * 1024 * 1024; // 5MB
export const FILE_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function validateFile(file: File): string | null {
  if (!FILE_ALLOWED_TYPES.includes(file.type)) {
    return 'Only PDF, JPG, and PNG files are accepted.';
  }
  if (file.size > FILE_MAX_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return `File is ${mb}MB. Maximum allowed size is 5MB.`;
  }
  return null; // null = valid
}
