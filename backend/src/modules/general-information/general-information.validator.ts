import { z } from 'zod';

export const generalInformationQuerySchema = z
  .object({ systemType: z.enum(['CEMS', 'WPMS']) })
  .strict();
export type GeneralInformationSystemType = z.infer<
  typeof generalInformationQuerySchema
>['systemType'];
