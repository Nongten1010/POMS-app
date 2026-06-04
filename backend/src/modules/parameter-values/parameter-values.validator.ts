import { z } from 'zod';
import { PARAMETER_VALUE_INTERVALS } from './parameter-values.types';

const stationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'stationId must be a safe SQL identifier fragment');

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: 'date must be valid',
  });

export const listParameterValuesQuerySchema = z
  .object({
    stationId: stationIdSchema,
    interval: z.enum(PARAMETER_VALUE_INTERVALS).default('real'),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .strict()
  .refine((query) => query.startDate <= query.endDate, {
    message: 'startDate must be less than or equal to endDate',
    path: ['startDate'],
  });

export const latestParameterValueQuerySchema = z
  .object({
    stationId: stationIdSchema,
    interval: z.enum(PARAMETER_VALUE_INTERVALS).default('real'),
  })
  .strict();

export type ListParameterValuesQuerySchemaInput = z.infer<typeof listParameterValuesQuerySchema>;
export type LatestParameterValueQuerySchemaInput = z.infer<typeof latestParameterValueQuerySchema>;
