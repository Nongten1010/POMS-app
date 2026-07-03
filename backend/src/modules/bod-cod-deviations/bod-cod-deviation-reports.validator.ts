import { z } from 'zod';
import { BOD_COD_DEVIATION_REPORT_STATUSES } from './bod-cod-deviation-reports.types';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const listBodCodDeviationReportsQuerySchema = z
  .object({
    status: z.preprocess(
      emptyStringToUndefined,
      z.enum(BOD_COD_DEVIATION_REPORT_STATUSES).optional(),
    ),
    parameterCode: z.preprocess(emptyStringToUndefined, z.enum(['BOD', 'COD']).optional()),
    factoryId: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  })
  .strict();
