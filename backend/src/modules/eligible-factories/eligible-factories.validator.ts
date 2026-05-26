import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const requiredNullableTrimmedString = (max: number) => trimmedString(max).nullable();
const nullableNumber = z.number().nullable();
const nullableBoolean = z.boolean().nullable();

function joinFactoryTypeSequence(factoryClass?: string | null, factorySubclass?: string | null) {
  return (
    [factoryClass, factorySubclass]
      .filter((value): value is string => Boolean(value))
      .join(' / ') || null
  );
}

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

export const listEligibleFactoriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
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

export const listEligibleFactoryCandidatesQuerySchema = z.object({}).strict();

export const eligibleFactoryIdParamsSchema = z
  .object({
    id: z.coerce.number().int().min(1),
  })
  .strict();

export type CreateEligibleFactorySchemaInput = z.infer<typeof createEligibleFactorySchema>;
export type ListEligibleFactoriesQuerySchemaInput = z.infer<
  typeof listEligibleFactoriesQuerySchema
>;
export type ListEligibleFactoryCandidatesQuerySchemaInput = z.infer<
  typeof listEligibleFactoryCandidatesQuerySchema
>;
export type EligibleFactoryIdParamsSchemaInput = z.infer<typeof eligibleFactoryIdParamsSchema>;
