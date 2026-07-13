import { z } from 'zod';
import { OFFICER_NOTIFICATION_RECIPIENT_TYPES } from './officer-notification-email-recipients.types';

const emailListSchema = z
  .array(z.string().trim().email().max(255))
  .min(1)
  .max(20)
  .transform((emails) => [...new Set(emails.map((email) => email.toLowerCase()))]);

export const createOfficerNotificationEmailRecipientSchema = z
  .object({
    recipientType: z.enum(OFFICER_NOTIFICATION_RECIPIENT_TYPES),
    provinceName: z.string().trim().min(1).max(128).nullable().optional(),
    emails: emailListSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.recipientType === 'PROVINCE' && !input.provinceName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provinceName'],
        message: 'Province name is required for province recipients',
      });
    }
    if (input.recipientType === 'INDUSTRIAL_ESTATE' && input.provinceName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provinceName'],
        message: 'Province name is not allowed for industrial-estate recipients',
      });
    }
  })
  .transform((input) => ({
    ...input,
    provinceName: input.provinceName ?? null,
  }));

export const officerNotificationEmailRecipientIdParamsSchema = z
  .object({ id: z.coerce.number().int().positive() })
  .strict();

export const addOfficerNotificationEmailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((email) => email.toLowerCase()),
  })
  .strict();
