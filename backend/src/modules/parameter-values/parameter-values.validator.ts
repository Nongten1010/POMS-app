import { z } from 'zod';
import { PARAMETER_VALUE_INTERVALS } from './parameter-values.types';

const stationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'stationId must be a safe SQL identifier fragment');

export const listParameterValuesQuerySchema = z
  .object({
    stationId: stationIdSchema,
    interval: z.enum(PARAMETER_VALUE_INTERVALS).default('real'),
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const latestParameterValueQuerySchema = z
  .object({
    stationId: stationIdSchema,
    interval: z.enum(PARAMETER_VALUE_INTERVALS).default('real'),
  })
  .strict()
  .transform((query) => ({
    ...query,
    limit: 1,
    offset: 0,
  }));

export type ListParameterValuesQuerySchemaInput = z.infer<typeof listParameterValuesQuerySchema>;
export type LatestParameterValueQuerySchemaInput = z.infer<typeof latestParameterValueQuerySchema>;
