import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const nullableTrimmedString = (max: number) => trimmedString(max).nullable().optional();

export const createEligibleFactorySchema = z
  .object({
    sourceSystem: trimmedString(64).default('external_factory_db'),
    sourceFactoryId: nullableTrimmedString(64),
    factoryName: trimmedString(500),
    factoryRegistrationNoNew: trimmedString(64),
    factoryRegistrationNoOld: nullableTrimmedString(64),
    factoryTypeSequence: nullableTrimmedString(128),
    address: nullableTrimmedString(1000),
    provinceName: trimmedString(128),
    industrialEstateName: nullableTrimmedString(255),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .strict()
      .nullable()
      .optional(),
    businessActivity: nullableTrimmedString(4000),
    operationStatus: trimmedString(64),
    capitalAmount: z.number().nonnegative().nullable().optional(),
    machineryHorsepower: z.number().nonnegative().nullable().optional(),
    productionCapacity: nullableTrimmedString(500),
    wastewaterDischargeInfo: nullableTrimmedString(4000),
    boilerCount: z.number().int().min(0).max(10000).nullable().optional(),
    boilerSizeEach: nullableTrimmedString(500),
    fuelUsed: nullableTrimmedString(500),
    hasEia: z.boolean().nullable().optional(),
    selectedReason: nullableTrimmedString(1000),
  })
  .strict();

export const listEligibleFactoriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(128).optional(),
    provinceName: z.string().trim().min(1).max(128).optional(),
    operationStatus: z.string().trim().min(1).max(64).optional(),
    hasEia: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict()
  .transform((query) => {
    const shouldPaginate = query.page !== undefined || query.perPage !== undefined;
    if (!shouldPaginate) return query;
    return {
      ...query,
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    };
  });

export const listEligibleFactoryCandidatesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(128).optional(),
    provinceName: z.string().trim().min(1).max(128).optional(),
    operationStatus: z.string().trim().min(1).max(64).optional(),
    hasEia: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict()
  .transform((query) => {
    const shouldPaginate = query.page !== undefined || query.perPage !== undefined;
    if (!shouldPaginate) return query;
    return {
      ...query,
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    };
  });

export type CreateEligibleFactorySchemaInput = z.infer<typeof createEligibleFactorySchema>;
export type ListEligibleFactoriesQuerySchemaInput = z.infer<
  typeof listEligibleFactoriesQuerySchema
>;
export type ListEligibleFactoryCandidatesQuerySchemaInput = z.infer<
  typeof listEligibleFactoryCandidatesQuerySchema
>;
