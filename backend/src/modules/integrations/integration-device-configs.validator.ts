import { z } from 'zod';

export const integrationDeviceConfigParamsSchema = z
  .object({
    stationId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'stationId contains unsupported characters'),
  })
  .strict();
