import { z } from 'zod';

export const integrationFactoryDashboardParamsSchema = z
  .object({
    registrationNo: z
      .string()
      .trim()
      .regex(/^\d{14}$/, 'Factory registration number must contain exactly 14 digits'),
  })
  .strict();
