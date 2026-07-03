import { z } from 'zod';
import { KWP_FORM_STATUSES, KWP_FORM_TYPES } from './kwp-form-reports.types';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const listKwpFormRequestsQuerySchema = z
  .object({
    formType: z.preprocess(emptyStringToUndefined, z.enum(KWP_FORM_TYPES).optional()),
    status: z.preprocess(emptyStringToUndefined, z.enum(KWP_FORM_STATUSES).optional()),
    factoryId: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  })
  .strict();
