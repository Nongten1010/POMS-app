import { z } from 'zod';
import { FAQ_CATEGORIES } from './faqs.types';

const supportedDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine(isSupportedCalendarDate, 'Date must be a real date from 1900-01-01 to 9999-12-31');

const faqPayloadShape = {
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1),
  category: z.enum(FAQ_CATEGORIES),
  updatedDate: supportedDateOnlySchema,
  links: z
    .array(
      z
        .string()
        .trim()
        .max(2048)
        .url()
        .refine((value) => {
          try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
          } catch {
            return false;
          }
        }, 'URL must use HTTP or HTTPS without credentials'),
    )
    .max(20)
    .optional(),
};

const attachmentIds = z
  .array(z.string().uuid())
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length, 'Attachment ids must be unique');
export const createFaqSchema = z
  .object({
    ...faqPayloadShape,
    attachmentIds: attachmentIds
      .refine((ids) => ids.length === 0, 'Cannot retain attachments on create')
      .optional(),
  })
  .strict();
export const updateFaqSchema = z
  .object({ ...faqPayloadShape, attachmentIds: attachmentIds.optional() })
  .strict();

export const faqAttachmentParamsSchema = z
  .object({ id: z.string().uuid(), attachmentId: z.string().uuid() })
  .strict();

export const faqIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const faqListQuerySchema = z.object({}).strict();

function isSupportedCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 9999) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
