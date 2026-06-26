import { z } from 'zod';
import { MONITORING_POINT_SYSTEM_TYPES } from './monitoring-point-forms.types';

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));
const optionalStringList = (maxItemLength: number, maxItems: number) =>
  z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') return [];
        if (Array.isArray(value)) {
          return value
            .map((item) => (typeof item === 'string' ? item.trim() : item))
            .filter(Boolean);
        }
        if (typeof value === 'string') {
          return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        return value;
      },
      z.array(requiredText(maxItemLength)).max(maxItems),
    )
    .default([]);
const parameterListSchema = optionalStringList(255, 100);
const legalAnnexListSchema = optionalStringList(32, 12);
const optionalNumber = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') return null;
    return value;
  }, z.coerce.number().finite().nonnegative().nullable())
  .optional()
  .default(null);
const optionalCoordinate = (min: number, max: number) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    }, z.coerce.number().finite().min(min).max(max).nullable())
    .optional()
    .default(null);

export const saveMonitoringPointFormSchema = z
  .object({
    factory: z
      .object({
        factoryName: optionalText(500),
        factoryRegistrationNoNew: optionalText(64),
        factoryRegistrationNoOld: optionalText(64),
        provinceName: optionalText(128),
        factoryTypeMain: optionalText(128),
        factoryTypeSub: optionalText(128),
        operationStatus: optionalText(128),
        eiaInfo: optionalText(255),
        address: optionalText(1000),
        businessActivity: optionalText(4000),
        machineryHorsepower: optionalNumber,
        latitude: optionalCoordinate(-90, 90),
        longitude: optionalCoordinate(-180, 180),
      })
      .strict(),
    points: z
      .array(
        z
          .object({
            id: z.coerce.number().int().positive().optional(),
            systemType: z.enum(MONITORING_POINT_SYSTEM_TYPES),
            pointCode: optionalText(64),
            pointName: optionalText(255),
            productionUnitType: optionalText(255),
            productionCapacity: optionalText(255),
            cemsInstallationRequiredBy: optionalText(255),
            cemsInstallationRequiredOther: optionalText(255),
            legalAnnexNo: legalAnnexListSchema,
            accountingConnectionStatus: optionalText(255),
            eligibleParameters: parameterListSchema,
            exemptedParameters: parameterListSchema,
            connectedParameters: parameterListSchema,
            pendingParameters: parameterListSchema,
            primaryFuel: optionalText(255),
            primaryFuelOther: optionalText(255),
            secondaryFuel: optionalText(255),
            secondaryFuelOther: optionalText(255),
            details: z.record(z.string(), z.unknown()).optional().nullable().default(null),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict();

export const monitoringPointFormIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const listMonitoringPointFormsQuerySchema = z
  .object({
    factoryRegistrationNoNew: z.string().trim().min(1).max(64).optional(),
    systemType: z.enum(MONITORING_POINT_SYSTEM_TYPES).optional(),
  })
  .strict();
