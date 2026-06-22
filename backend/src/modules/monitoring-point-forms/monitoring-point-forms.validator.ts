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
const parameterListSchema = z.array(requiredText(255)).max(100).default([]);
const legalAnnexListSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value;
  }, z.array(requiredText(32)).max(12))
  .default([]);

export const saveMonitoringPointFormSchema = z
  .object({
    factory: z
      .object({
        factoryName: requiredText(500),
        factoryRegistrationNoNew: requiredText(64),
        factoryRegistrationNoOld: optionalText(64),
        provinceName: optionalText(128),
        factoryTypeMain: optionalText(128),
        factoryTypeSub: optionalText(128),
        operationStatus: optionalText(128),
        eiaInfo: optionalText(255),
        address: optionalText(1000),
        businessActivity: optionalText(4000),
      })
      .strict(),
    points: z
      .array(
        z
          .object({
            id: z.coerce.number().int().positive().optional(),
            systemType: z.enum(MONITORING_POINT_SYSTEM_TYPES),
            pointCode: optionalText(64),
            pointName: requiredText(255),
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
      .min(1)
      .max(100),
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
