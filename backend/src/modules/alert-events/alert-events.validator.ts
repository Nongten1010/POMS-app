import { z } from 'zod';
import { isAnnualMonitoringPointCode } from '../../shared/utils/monitoring-point-code';
import {
  ALERT_EVENT_ALERT_TYPES,
  ALERT_EVENT_DISPLAY_SYSTEM_TYPES,
  ALERT_EVENT_NOTIFICATION_STATUSES,
  ALERT_EVENT_SYSTEM_TYPES,
  ALERT_EVENT_THRESHOLD_TYPES,
} from './alert-events.types';
import type {
  AlertEventThresholdType,
  IntegrationAlertEventAlertType,
} from './alert-events.types';

const safeCodeSchema = z.string().trim().regex(/^[A-Za-z0-9_-]+$/).max(128);
const monitoringPointCodeSchema = z
  .string()
  .trim()
  .max(128)
  .refine(
    (value) => /^[A-Za-z0-9_-]+$/.test(value) || isAnnualMonitoringPointCode(value),
    'stationId must be a legacy safe identifier or an annual monitoring point code',
  );
const unitSchema = z.string().trim().min(1).max(64);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const createIntegrationAlertEventSchema = z
  .object({
    systemType: z.enum(ALERT_EVENT_SYSTEM_TYPES),
    stationId: monitoringPointCodeSchema,
    pointCode: monitoringPointCodeSchema.optional().nullable(),
    parameterCode: safeCodeSchema.transform((value) => value.toLowerCase()),
    unit: unitSchema,
    eventDate: isoDateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    measuredValue: z.coerce.number().finite(),
    thresholdValue: z.coerce.number().finite(),
    thresholdType: z.enum(ALERT_EVENT_THRESHOLD_TYPES),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (timeToMinutes(value.startTime) > timeToMinutes(value.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be on or after startTime',
      });
    }
  })
  .transform((value) => {
    const alertType = alertTypeFor(value.thresholdType);
    const parameterName = value.parameterCode.toUpperCase();
    const startedAt = `${value.eventDate}T${value.startTime}:00+07:00`;
    const endedAt = `${value.eventDate}T${value.endTime}:59+07:00`;

    return {
      ...value,
      idempotencyKey: [
        value.systemType,
        value.stationId,
        value.parameterCode,
        alertType,
        startedAt,
      ].join(':'),
      displaySystemType: displaySystemTypeFor(value.systemType),
      alertType,
      pointName: value.pointCode ?? value.stationId,
      pointType: null,
      parameterName,
      parameterLabel: `${parameterName} (${value.unit})`,
      startedAt,
      endedAt,
      notificationStatus: 'AUTO' as const,
      sourcePayload: value,
    };
  });

export const createIntegrationAlertEventBatchSchema = z
  .object({
    events: z.array(createIntegrationAlertEventSchema).min(1).max(500),
  })
  .strict();

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function displaySystemTypeFor(systemType: (typeof ALERT_EVENT_SYSTEM_TYPES)[number]) {
  return (systemType === 'CEMS' ? 'CEMS' : 'BOD_COD_ONLINE') as
    (typeof ALERT_EVENT_DISPLAY_SYSTEM_TYPES)[number];
}

function alertTypeFor(thresholdType: AlertEventThresholdType): IntegrationAlertEventAlertType {
  return thresholdType === 'STANDARD' ? 'STANDARD_EXCEEDED' : 'EIA_EXCEEDED';
}

export const listAlertEventsQuerySchema = z
  .object({
    systemType: z.enum(ALERT_EVENT_SYSTEM_TYPES).optional(),
    displaySystemType: z.enum(ALERT_EVENT_DISPLAY_SYSTEM_TYPES).optional(),
    alertType: z.enum(ALERT_EVENT_ALERT_TYPES).optional(),
    thresholdType: z.enum(ALERT_EVENT_THRESHOLD_TYPES).optional(),
    factoryId: z.string().trim().max(128).optional(),
    stationId: monitoringPointCodeSchema.optional(),
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
