import { z } from 'zod';
import {
  ALERT_EVENT_ALERT_TYPES,
  ALERT_EVENT_DISPLAY_SYSTEM_TYPES,
  ALERT_EVENT_NOTIFICATION_STATUSES,
  ALERT_EVENT_POINT_TYPES,
  ALERT_EVENT_SYSTEM_TYPES,
  ALERT_EVENT_THRESHOLD_TYPES,
  INTEGRATION_ALERT_EVENT_ALERT_TYPES,
} from './alert-events.types';

const safeCodeSchema = z.string().trim().regex(/^[A-Za-z0-9_-]+$/).max(128);
const nonEmptyTextSchema = z.string().trim().min(1).max(500);
const optionalTextSchema = z.string().trim().max(1000).optional().nullable();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().datetime({ offset: true });

export const createIntegrationAlertEventSchema = z
  .object({
    idempotencyKey: z.string().trim().min(10).max(220),
    systemType: z.enum(ALERT_EVENT_SYSTEM_TYPES),
    displaySystemType: z.enum(ALERT_EVENT_DISPLAY_SYSTEM_TYPES),
    alertType: z.enum(INTEGRATION_ALERT_EVENT_ALERT_TYPES),
    factoryId: optionalTextSchema,
    factoryName: optionalTextSchema,
    factoryRegistrationNo: optionalTextSchema,
    stationId: safeCodeSchema,
    pointCode: safeCodeSchema.optional().nullable(),
    pointName: nonEmptyTextSchema,
    pointType: z.enum(ALERT_EVENT_POINT_TYPES).optional().nullable(),
    parameterCode: safeCodeSchema.transform((value) => value.toLowerCase()),
    parameterName: nonEmptyTextSchema,
    parameterLabel: nonEmptyTextSchema,
    unit: nonEmptyTextSchema.max(64),
    eventDate: isoDateSchema,
    startedAt: dateTimeSchema,
    endedAt: dateTimeSchema,
    measuredValue: z.coerce.number().finite(),
    thresholdValue: z.coerce.number().finite(),
    thresholdType: z.enum(ALERT_EVENT_THRESHOLD_TYPES),
    notificationStatus: z.enum(ALERT_EVENT_NOTIFICATION_STATUSES).default('AUTO'),
    sourcePayload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.alertType === 'STANDARD_EXCEEDED' && value.thresholdType !== 'STANDARD') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['thresholdType'],
        message: 'thresholdType must be STANDARD when alertType is STANDARD_EXCEEDED',
      });
    }

    if (value.alertType === 'EIA_EXCEEDED' && value.thresholdType !== 'EIA') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['thresholdType'],
        message: 'thresholdType must be EIA when alertType is EIA_EXCEEDED',
      });
    }

    if (Date.parse(value.startedAt) > Date.parse(value.endedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endedAt'],
        message: 'endedAt must be after startedAt',
      });
    }
  });

export const listAlertEventsQuerySchema = z
  .object({
    systemType: z.enum(ALERT_EVENT_SYSTEM_TYPES).optional(),
    displaySystemType: z.enum(ALERT_EVENT_DISPLAY_SYSTEM_TYPES).optional(),
    alertType: z.enum(ALERT_EVENT_ALERT_TYPES).optional(),
    thresholdType: z.enum(ALERT_EVENT_THRESHOLD_TYPES).optional(),
    factoryId: z.string().trim().max(128).optional(),
    stationId: safeCodeSchema.optional(),
    parameterCode: safeCodeSchema.transform((value) => value.toLowerCase()).optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateTo'],
        message: 'dateTo must be on or after dateFrom',
      });
    }
  });

export const alertEventIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateAlertEventStatusSchema = z
  .object({
    notificationStatus: z.enum(ALERT_EVENT_NOTIFICATION_STATUSES),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
