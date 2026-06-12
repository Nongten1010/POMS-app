import { z } from 'zod';

export const sendEmailTestSchema = z
  .object({
    subject: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export type SendEmailTestSchemaInput = z.infer<typeof sendEmailTestSchema>;
