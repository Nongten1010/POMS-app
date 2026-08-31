import { z } from 'zod';
import { joinFactoryTypeSequence } from './factory-type-sequence';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const requiredNullableTrimmedString = (max: number) => trimmedString(max).nullable();
const nullableNumber = z.number().nullable();
const nullableBoolean = z.boolean().nullable();

export const createEligibleFactorySchema = z
  .object({
    factoryName: trimmedString(500),
    factoryId: trimmedString(64),
    factoryRegistrationNo: trimmedString(64),
    factoryClass: requiredNullableTrimmedString(64),
    factorySubclass: requiredNullableTrimmedString(64),
    address: requiredNullableTrimmedString(1000),
    provinceName: trimmedString(128),
    industrialEstateName: requiredNullableTrimmedString(255),
    longitude: z.number().min(-180).max(180).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    businessActivity: requiredNullableTrimmedString(4000),
    operationStatus: trimmedString(64),
    capitalAmount: nullableNumber,
    machineryHorsepower: nullableNumber,
    productionCapacity: requiredNullableTrimmedString(500),
    wastewaterDischargeInfo: requiredNullableTrimmedString(4000),
    boilerCount: z.number().int().min(0).max(10000).nullable(),
    boilerSizeEach: requiredNullableTrimmedString(500),
    fuelUsed: requiredNullableTrimmedString(500),
    hasEia: nullableBoolean,
  })
  .strict()
  .transform((candidate) => ({
    sourceSystem: 'diw.fac_import',
    sourceFactoryId: candidate.factoryId,
    factoryName: candidate.factoryName,
    factoryRegistrationNoNew: candidate.factoryRegistrationNo,
    factoryRegistrationNoOld: null,
    factoryTypeSequence: joinFactoryTypeSequence(candidate.factoryClass, candidate.factorySubclass),
    address: candidate.address ?? null,
    provinceName: candidate.provinceName,
    industrialEstateName: candidate.industrialEstateName ?? null,
    coordinates:
      candidate.latitude === null ||
      candidate.latitude === undefined ||
      candidate.longitude === null ||
      candidate.longitude === undefined
        ? null
        : {
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          },
    businessActivity: candidate.businessActivity ?? null,
    operationStatus: candidate.operationStatus,
    capitalAmount: candidate.capitalAmount ?? null,
    machineryHorsepower: candidate.machineryHorsepower ?? null,
    productionCapacity: candidate.productionCapacity ?? null,
    wastewaterDischargeInfo: candidate.wastewaterDischargeInfo ?? null,
    boilerCount: candidate.boilerCount ?? null,
    boilerSizeEach: candidate.boilerSizeEach ?? null,
    fuelUsed: candidate.fuelUsed ?? null,
    hasEia: candidate.hasEia ?? null,
    selectedReason: null,
  }));

export const createEligibleFactoryAddRequestSchema = z
  .object({
    factoryId: trimmedString(64),
    reason: trimmedString(1000),
  })
  .strict();

export const listEligibleFactoriesQuerySchema = z.object({}).strict();
export const listEligibleFactoryAddRequestsQuerySchema = z
  .object({
    status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).default('PENDING_REVIEW'),
    search: z.string().trim().min(1).max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(200).default(25),
  })
  .strict();

export const reviewEligibleFactoryAddRequestSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    officerNote: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.decision === 'REJECT' && !input.officerNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['officerNote'],
        message: 'officerNote is required when decision is REJECT',
      });
    }
  });

export const listEligibleFactoryCandidatesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((query, ctx) => {
    if ((query.page === undefined) !== (query.perPage === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'page and perPage must be provided together',
      });
    }
  });

export const eligibleFactoryIdParamsSchema = z
  .object({
    id: z.coerce.number().int().min(1),
  })
  .strict();

export const eligibleFactoryAddRequestIdParamsSchema = eligibleFactoryIdParamsSchema;

export type CreateEligibleFactorySchemaInput = z.infer<typeof createEligibleFactorySchema>;
export type CreateEligibleFactoryAddRequestSchemaInput = z.infer<
  typeof createEligibleFactoryAddRequestSchema
>;
export type ListEligibleFactoriesQuerySchemaInput = z.infer<
  typeof listEligibleFactoriesQuerySchema
>;
export type ListEligibleFactoryAddRequestsQuerySchemaInput = z.infer<
  typeof listEligibleFactoryAddRequestsQuerySchema
>;
export type ReviewEligibleFactoryAddRequestSchemaInput = z.infer<
  typeof reviewEligibleFactoryAddRequestSchema
>;
export type ListEligibleFactoryCandidatesQuerySchemaInput = z.infer<
  typeof listEligibleFactoryCandidatesQuerySchema
>;
export type EligibleFactoryIdParamsSchemaInput = z.infer<typeof eligibleFactoryIdParamsSchema>;
