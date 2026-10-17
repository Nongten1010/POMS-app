import { z } from 'zod';
import { CHAT_TOPICS } from './chat.types';

export const chatIdSchema = z.coerce.number().int().min(1).max(2147483647);
export const chatMessageTextSchema = z.string().trim().min(1).max(2000);
export const chatIdempotencyKeySchema = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const topic = z.enum(CHAT_TOPICS.map((item) => item.code));
export const chatFactoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce
      .number()
      .pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
      .default(25),
    q: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export const chatTicketQuerySchema = chatFactoryQuerySchema
  .extend({
    status: z.enum(['open', 'closed']).optional(),
    topicCode: topic.optional(),
    eligibleFactoryId: chatIdSchema.optional(),
    regionName: z.string().trim().min(1).max(100).optional(),
    provinceName: z.string().trim().min(1).max(128).optional(),
    from: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString())
      .optional(),
    to: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString())
      .optional(),
    sort: z
      .enum([
        'lastMessageAt',
        'ticketNo',
        'topic',
        'factoryName',
        'registrationNo',
        'regionName',
        'provinceName',
        'status',
      ])
      .default('lastMessageAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ['to'],
    message: 'to must not be earlier than from',
  });
export const createChatTicketSchema = z
  .object({
    eligibleFactoryId: z.number().int().min(1).max(2147483647),
    measurementPoint: z
      .object({
        kind: z.enum(['eligible', 'connected']),
        id: z.number().int().min(1).max(2147483647),
      })
      .strict()
      .nullable()
      .default(null),
    topicCode: topic,
    message: chatMessageTextSchema,
  })
  .strict();
export const sendChatMessageSchema = z.object({ message: chatMessageTextSchema }).strict();
export const closeChatTicketSchema = z.object({}).strict();
export const chatMessageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    olderCursor: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    afterMessageId: chatIdSchema.optional(),
  })
  .strict()
  .refine((query) => !(query.olderCursor && query.afterMessageId), {
    message: 'Use either olderCursor or afterMessageId',
  });
